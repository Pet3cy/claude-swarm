# frozen_string_literal: true

module SwarmSDK
  # Restores swarm conversation state from snapshots
  #
  # Unified implementation that works for both Swarm and NodeOrchestrator.
  # Validates compatibility between snapshot and current configuration,
  # restores conversation history, context state, scratchpad contents, and
  # read tracking information.
  #
  # Handles configuration mismatches gracefully by skipping agents that
  # don't exist in the current swarm and returning warnings in RestoreResult.
  #
  # @example Restore a swarm
  #   swarm = SwarmSDK.build { ... }  # Same config as snapshot
  #   snapshot_data = JSON.parse(File.read("session.json"), symbolize_names: true)
  #   result = swarm.restore(snapshot_data)
  #   if result.success?
  #     puts "All agents restored"
  #   else
  #     puts result.summary
  #   end
  class StateRestorer
    # Initialize state restorer
    #
    # @param orchestration [Swarm, NodeOrchestrator] Swarm or orchestrator to restore into
    # @param snapshot [Snapshot, Hash, String] Snapshot object, hash, or JSON string
    def initialize(orchestration, snapshot)
      @orchestration = orchestration
      @type = orchestration.is_a?(SwarmSDK::NodeOrchestrator) ? :node_orchestrator : :swarm

      # Handle different input types
      @snapshot_data = case snapshot
      when Snapshot
        snapshot.to_hash
      when String
        JSON.parse(snapshot, symbolize_names: true)
      when Hash
        snapshot
      else
        raise ArgumentError, "snapshot must be a Snapshot object, Hash, or JSON string"
      end

      validate_version!
      validate_type_match!
    end

    # Restore state from snapshot
    #
    # Three-phase process:
    # 1. Validate compatibility (which agents can be restored)
    # 2. Restore state (only for matched agents)
    # 3. Return result with warnings about skipped agents
    #
    # @return [RestoreResult] Result with warnings about partial restores
    def restore
      # Phase 1: Validate compatibility
      validation = validate_compatibility

      # Phase 2: Restore state (only for matched agents)
      restore_metadata
      restore_agent_conversations(validation.restorable_agents)
      restore_delegation_conversations(validation.restorable_delegations)
      restore_scratchpad
      restore_read_tracking
      restore_memory_read_tracking

      # Phase 3: Return result with warnings
      SwarmSDK::RestoreResult.new(
        warnings: validation.warnings,
        skipped_agents: validation.skipped_agents,
        skipped_delegations: validation.skipped_delegations,
      )
    end

    private

    # Validate snapshot version
    #
    # @raise [StateError] if version is unsupported
    def validate_version!
      version = @snapshot_data[:version] || @snapshot_data["version"]
      unless version == "1.0.0"
        raise StateError, "Unsupported snapshot version: #{version}"
      end
    end

    # Validate snapshot type matches orchestration type
    #
    # @raise [StateError] if types don't match
    def validate_type_match!
      snapshot_type = (@snapshot_data[:type] || @snapshot_data["type"]).to_sym
      unless snapshot_type == @type
        raise StateError, "Snapshot type '#{snapshot_type}' doesn't match orchestration type '#{@type}'"
      end
    end

    # Validate compatibility between snapshot and current configuration
    #
    # Checks which agents from the snapshot exist in current configuration
    # and generates warnings for any that don't match.
    #
    # @return [ValidationResult] Validation results
    def validate_compatibility
      warnings = []
      skipped_agents = []
      restorable_agents = []
      skipped_delegations = []
      restorable_delegations = []

      # Get current agent names from configuration
      current_agents = Set.new(@orchestration.agent_definitions.keys)

      # Check each snapshot agent
      snapshot_agents = @snapshot_data[:agents] || @snapshot_data["agents"]
      snapshot_agents.keys.each do |agent_name|
        agent_name_sym = agent_name.to_sym

        if current_agents.include?(agent_name_sym)
          restorable_agents << agent_name_sym
        else
          skipped_agents << agent_name_sym
          warnings << {
            type: :agent_not_found,
            agent: agent_name,
            message: "Agent '#{agent_name}' in snapshot not found in current configuration. " \
              "Conversation will not be restored.",
          }
        end
      end

      # Check delegation instances
      delegation_instances = @snapshot_data[:delegation_instances] || @snapshot_data["delegation_instances"]
      delegation_instances&.each do |instance_name, _data|
        base_name, delegator_name = instance_name.split("@")

        if restorable_agents.include?(base_name.to_sym) &&
            restorable_agents.include?(delegator_name.to_sym)
          restorable_delegations << instance_name
        else
          skipped_delegations << instance_name
          warnings << {
            type: :delegation_instance_not_restorable,
            instance: instance_name,
            message: "Delegation instance '#{instance_name}' cannot be restored " \
              "(base agent or delegator not in current swarm).",
          }
        end
      end

      SwarmSDK::ValidationResult.new(
        warnings: warnings,
        skipped_agents: skipped_agents,
        restorable_agents: restorable_agents,
        skipped_delegations: skipped_delegations,
        restorable_delegations: restorable_delegations,
      )
    end

    # Restore orchestration metadata
    #
    # For Swarm: restores first_message_sent flag
    # For NodeOrchestrator: no additional metadata to restore
    #
    # @return [void]
    def restore_metadata
      # Restore type-specific metadata
      if @type == :swarm
        # Restore first_message_sent flag for Swarm only
        swarm_data = @snapshot_data[:swarm] || @snapshot_data["swarm"]
        first_sent = swarm_data[:first_message_sent] || swarm_data["first_message_sent"]
        @orchestration.first_message_sent = first_sent
      end
      # NodeOrchestrator has no additional metadata to restore
    end

    # Restore agent conversations
    #
    # @param restorable_agents [Array<Symbol>] Agents that can be restored
    # @return [void]
    def restore_agent_conversations(restorable_agents)
      restorable_agents.each do |agent_name|
        # Get agent chat from appropriate source
        agent_chat = if @type == :swarm
          # Swarm: agents are lazily initialized, access triggers init
          @orchestration.agent(agent_name)
        else
          # NodeOrchestrator: agents are cached lazily during node execution
          # If restoring before first execution, cache will be empty
          # We need to create agents now so they can be injected later
          cache = @orchestration.agent_instance_cache[:primary]
          unless cache[agent_name]
            # For NodeOrchestrator, we can't easily create agents here
            # because we'd need the full swarm setup (initializer, etc.)
            # Skip this agent if it's not in cache yet
            next
          end

          cache[agent_name]
        end

        # Get agent snapshot data - handle both symbol and string keys
        agents_data = @snapshot_data[:agents] || @snapshot_data["agents"]
        snapshot_data = agents_data[agent_name] || agents_data[agent_name.to_s]
        next unless snapshot_data # Skip if agent not in snapshot (shouldn't happen due to validation)

        # Clear existing messages
        messages = agent_chat.messages
        messages.clear

        # Restore messages
        conversation = snapshot_data[:conversation] || snapshot_data["conversation"]
        conversation.each do |msg_data|
          message = deserialize_message(msg_data)
          messages << message
        end

        # Restore context state
        context_state = snapshot_data[:context_state] || snapshot_data["context_state"]
        restore_context_state(agent_chat, context_state)
      end
    end

    # Deserialize a message from snapshot data
    #
    # Handles Content objects and tool calls properly.
    #
    # @param msg_data [Hash] Message data from snapshot
    # @return [RubyLLM::Message] Deserialized message
    def deserialize_message(msg_data)
      # Handle Content objects
      content = if msg_data[:content].is_a?(Hash) && (msg_data[:content].key?(:text) || msg_data[:content].key?("text"))
        content_data = msg_data[:content]
        # Handle both symbol and string keys from JSON
        text = content_data[:text] || content_data["text"]
        attachments = content_data[:attachments] || content_data["attachments"] || []

        # Recreate Content object
        # NOTE: Attachments are hashes from JSON - RubyLLM::Content constructor handles this
        RubyLLM::Content.new(text, attachments)
      else
        # Plain string content
        msg_data[:content]
      end

      # Handle tool calls - deserialize from hash array
      # IMPORTANT: RubyLLM expects tool_calls to be Hash<String, ToolCall>, not Array!
      tool_calls_hash = if msg_data[:tool_calls] && !msg_data[:tool_calls].empty?
        msg_data[:tool_calls].each_with_object({}) do |tc_data, hash|
          # Handle both symbol and string keys from JSON
          id = tc_data[:id] || tc_data["id"]
          name = tc_data[:name] || tc_data["name"]
          arguments = tc_data[:arguments] || tc_data["arguments"] || {}

          # Use ID as hash key (convert to string for consistency)
          hash[id.to_s] = RubyLLM::ToolCall.new(
            id: id,
            name: name,
            arguments: arguments,
          )
        end
      end

      RubyLLM::Message.new(
        role: (msg_data[:role] || msg_data["role"]).to_sym,
        content: content,
        tool_calls: tool_calls_hash,
        tool_call_id: msg_data[:tool_call_id] || msg_data["tool_call_id"],
        input_tokens: msg_data[:input_tokens] || msg_data["input_tokens"],
        output_tokens: msg_data[:output_tokens] || msg_data["output_tokens"],
        model_id: msg_data[:model_id] || msg_data["model_id"],
      )
    end

    # Restore context state for an agent
    #
    # @param agent_chat [Agent::Chat] Agent chat instance
    # @param context_state [Hash] Context state data
    # @return [void]
    def restore_context_state(agent_chat, context_state)
      # Access via public accessors
      context_manager = agent_chat.context_manager
      agent_context = agent_chat.agent_context

      # Restore warning thresholds (Set - add one by one)
      if context_state[:warning_thresholds_hit] || context_state["warning_thresholds_hit"]
        thresholds_array = context_state[:warning_thresholds_hit] || context_state["warning_thresholds_hit"]
        thresholds_set = agent_context.warning_thresholds_hit
        thresholds_array.each { |t| thresholds_set.add(t) }
      end

      # Restore compression flag using public setter
      compression = context_state[:compression_applied] || context_state["compression_applied"]
      context_manager.compression_applied = compression

      # Restore TodoWrite tracking using public setter
      todowrite_index = context_state[:last_todowrite_message_index] || context_state["last_todowrite_message_index"]
      agent_chat.last_todowrite_message_index = todowrite_index

      # Restore active skill path using public setter
      skill_path = context_state[:active_skill_path] || context_state["active_skill_path"]
      agent_chat.active_skill_path = skill_path
    end

    # Restore delegation instance conversations
    #
    # @param restorable_delegations [Array<String>] Delegation instances that can be restored
    # @return [void]
    def restore_delegation_conversations(restorable_delegations)
      restorable_delegations.each do |instance_name|
        # Get delegation chat from appropriate source
        delegation_chat = if @type == :swarm
          @orchestration.delegation_instances[instance_name]
        else
          cache = @orchestration.agent_instance_cache[:delegations]
          unless cache[instance_name]
            # Skip if delegation not in cache yet (NodeOrchestrator)
            next
          end

          cache[instance_name]
        end
        next unless delegation_chat

        # Get delegation snapshot data - handle both symbol and string keys
        delegations_data = @snapshot_data[:delegation_instances] || @snapshot_data["delegation_instances"]
        snapshot_data = delegations_data[instance_name.to_sym] || delegations_data[instance_name.to_s] || delegations_data[instance_name]
        next unless snapshot_data # Skip if delegation not in snapshot (shouldn't happen due to validation)

        # Clear existing messages
        messages = delegation_chat.messages
        messages.clear

        # Restore messages
        conversation = snapshot_data[:conversation] || snapshot_data["conversation"]
        conversation.each do |msg_data|
          message = deserialize_message(msg_data)
          messages << message
        end

        # Restore context state
        context_state = snapshot_data[:context_state] || snapshot_data["context_state"]
        restore_context_state(delegation_chat, context_state)
      end
    end

    # Restore scratchpad contents (Swarm only)
    #
    # @return [void]
    def restore_scratchpad
      # Swarm ONLY - NodeOrchestrator doesn't have persistent scratchpad
      return if @type == :node_orchestrator

      scratchpad_data = @snapshot_data[:scratchpad] || @snapshot_data["scratchpad"]
      return unless scratchpad_data&.any?

      scratchpad = @orchestration.scratchpad_storage
      return unless scratchpad

      # Use new public API: restore_entries handles all the details
      scratchpad.restore_entries(scratchpad_data)
    end

    # Restore read tracking state
    #
    # @return [void]
    def restore_read_tracking
      read_tracking_data = @snapshot_data[:read_tracking] || @snapshot_data["read_tracking"]
      return unless read_tracking_data

      # Restore tracking for each agent using new API
      # read_tracking_data format: { agent_name => { file_path => digest } }
      read_tracking_data.each do |agent_name, files_with_digests|
        agent_sym = agent_name.to_sym
        Tools::Stores::ReadTracker.restore_read_files(agent_sym, files_with_digests)
      end
    end

    # Restore memory read tracking state
    #
    # @return [void]
    def restore_memory_read_tracking
      memory_tracking_data = @snapshot_data[:memory_read_tracking] || @snapshot_data["memory_read_tracking"]
      return unless memory_tracking_data
      return unless defined?(SwarmMemory::Core::StorageReadTracker)

      # Restore tracking for each agent using new API
      # memory_tracking_data format: { agent_name => { entry_path => digest } }
      memory_tracking_data.each do |agent_name, entries_with_digests|
        agent_sym = agent_name.to_sym
        SwarmMemory::Core::StorageReadTracker.restore_read_entries(agent_sym, entries_with_digests)
      end
    end
  end
end
