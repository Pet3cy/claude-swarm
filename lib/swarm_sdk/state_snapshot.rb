# frozen_string_literal: true

module SwarmSDK
  # Creates snapshots of swarm conversation state
  #
  # Unified implementation that works for both Swarm and NodeOrchestrator.
  # Captures conversation history, context state, scratchpad contents, and
  # read tracking information.
  #
  # The snapshot is a plain Ruby hash that can be serialized to JSON or any
  # other format. Configuration (agent definitions, tools, prompts) stays in
  # your YAML/DSL and is not included in snapshots.
  #
  # @example Snapshot a swarm
  #   swarm = SwarmSDK.build { ... }
  #   swarm.execute("Build authentication")
  #   snapshot = swarm.snapshot
  #   File.write("session.json", JSON.pretty_generate(snapshot))
  #
  # @example Snapshot a node orchestrator
  #   orchestrator = NodeOrchestrator.new(...)
  #   orchestrator.execute("Build feature")
  #   snapshot = orchestrator.snapshot
  #   redis.set("session:#{user_id}", JSON.generate(snapshot))
  class StateSnapshot
    # Initialize snapshot creator
    #
    # @param orchestration [Swarm, NodeOrchestrator] Swarm or orchestrator to snapshot
    def initialize(orchestration)
      @orchestration = orchestration
      @type = orchestration.is_a?(SwarmSDK::NodeOrchestrator) ? :node_orchestrator : :swarm
    end

    # Create snapshot of current state
    #
    # Returns a Snapshot object that encapsulates the snapshot data with
    # convenient methods for serialization and file I/O.
    #
    # @return [Snapshot] Snapshot object
    def snapshot
      data = {
        version: "1.0.0",
        type: @type.to_s,
        snapshot_at: Time.now.utc.iso8601,
        swarm_sdk_version: SwarmSDK::VERSION,
        agents: snapshot_agents,
        delegation_instances: snapshot_delegation_instances,
        read_tracking: snapshot_read_tracking,
        memory_read_tracking: snapshot_memory_read_tracking,
      }

      # Add scratchpad for both Swarm and NodeOrchestrator (shared across nodes)
      data[:scratchpad] = snapshot_scratchpad

      # Add type-specific metadata
      if @type == :swarm
        data[:swarm] = snapshot_swarm_metadata
      else
        data[:orchestrator] = snapshot_orchestrator_metadata
      end

      # Wrap in Snapshot object
      SwarmSDK::Snapshot.new(data)
    end

    private

    # Snapshot swarm-specific metadata
    #
    # @return [Hash] Swarm metadata
    def snapshot_swarm_metadata
      {
        id: @orchestration.swarm_id,
        parent_id: @orchestration.parent_swarm_id,
        first_message_sent: @orchestration.first_message_sent?,
      }
    end

    # Snapshot orchestrator-specific metadata
    #
    # @return [Hash] Orchestrator metadata
    def snapshot_orchestrator_metadata
      {
        id: @orchestration.swarm_id || generate_orchestrator_id,
        parent_id: nil, # NodeOrchestrator doesn't support parent_id
      }
    end

    # Generate orchestrator ID if not set
    #
    # @return [String] Generated ID
    def generate_orchestrator_id
      name = @orchestration.swarm_name.to_s.gsub(/[^a-z0-9_-]/i, "_").downcase
      "#{name}_#{SecureRandom.hex(4)}"
    end

    # Snapshot all agent conversations and context state
    #
    # @return [Hash] { agent_name => { conversation:, context_state:, system_prompt: } }
    def snapshot_agents
      result = {}

      # Get agents from appropriate source
      agents_hash = if @type == :swarm
        @orchestration.agents
      else
        @orchestration.agent_instance_cache[:primary]
      end

      agents_hash.each do |agent_name, agent_chat|
        # Get system prompt from agent definition
        agent_definition = @orchestration.agent_definitions[agent_name]
        system_prompt = agent_definition&.system_prompt

        result[agent_name.to_s] = {
          conversation: snapshot_conversation(agent_chat),
          context_state: snapshot_context_state(agent_chat),
          system_prompt: system_prompt,
        }
      end

      result
    end

    # Snapshot conversation messages for an agent
    #
    # @param agent_chat [Agent::Chat] Agent chat instance
    # @return [Array<Hash>] Serialized messages
    def snapshot_conversation(agent_chat)
      messages = agent_chat.messages
      messages.map { |msg| serialize_message(msg) }
    end

    # Serialize a single message
    #
    # Handles RubyLLM::Message serialization with proper handling of:
    # - Content objects (text + attachments)
    # - Tool calls (must manually call .to_h on each)
    # - Tool call IDs, tokens, model IDs
    #
    # @param msg [RubyLLM::Message] Message to serialize
    # @return [Hash] Serialized message
    def serialize_message(msg)
      hash = { role: msg.role }

      # Handle content - check msg.content directly, not from msg.to_h
      # msg.to_h converts Content to String when no attachments present
      hash[:content] = if msg.content.is_a?(RubyLLM::Content)
        # Content object: serialize with text + attachments
        msg.content.to_h
      else
        # Plain string content
        msg.content
      end

      # Handle tool calls - must manually extract fields
      # RubyLLM::ToolCall#to_h doesn't reliably serialize id/name fields
      # msg.tool_calls is a Hash<String, ToolCall>, so we need .values
      if msg.tool_calls && !msg.tool_calls.empty?
        hash[:tool_calls] = msg.tool_calls.values.map do |tc|
          {
            id: tc.id,
            name: tc.name,
            arguments: tc.arguments,
          }
        end
      end

      # Handle other fields
      hash[:tool_call_id] = msg.tool_call_id if msg.tool_call_id
      hash[:input_tokens] = msg.input_tokens if msg.input_tokens
      hash[:output_tokens] = msg.output_tokens if msg.output_tokens
      hash[:model_id] = msg.model_id if msg.model_id

      hash
    end

    # Snapshot context state for an agent
    #
    # @param agent_chat [Agent::Chat] Agent chat instance
    # @return [Hash] Context state
    def snapshot_context_state(agent_chat)
      context_manager = agent_chat.context_manager
      agent_context = agent_chat.agent_context

      {
        warning_thresholds_hit: agent_context.warning_thresholds_hit.to_a,
        # NOTE: @compression_applied initializes to nil, not false
        compression_applied: context_manager.compression_applied,
        last_todowrite_message_index: agent_chat.last_todowrite_message_index,
        active_skill_path: agent_chat.active_skill_path,
      }
    end

    # Snapshot delegation instance conversations
    #
    # @return [Hash] { "delegate@delegator" => { conversation:, context_state:, system_prompt: } }
    def snapshot_delegation_instances
      result = {}

      # Get delegation instances from appropriate source
      delegations_hash = if @type == :swarm
        @orchestration.delegation_instances
      else
        @orchestration.agent_instance_cache[:delegations]
      end

      delegations_hash.each do |instance_name, delegation_chat|
        # Extract base agent name from instance name (e.g., "backend@lead" -> "backend")
        base_name = instance_name.to_s.split("@").first.to_sym

        # Get system prompt from base agent definition
        agent_definition = @orchestration.agent_definitions[base_name]
        system_prompt = agent_definition&.system_prompt

        result[instance_name] = {
          conversation: snapshot_conversation(delegation_chat),
          context_state: snapshot_context_state(delegation_chat),
          system_prompt: system_prompt,
        }
      end

      result
    end

    # Snapshot scratchpad contents
    #
    # For Swarm: uses scratchpad_storage (returns flat hash)
    # For NodeOrchestrator: returns structured hash with metadata
    #   - Enabled mode: { shared: true, data: { path => entry } }
    #   - Per-node mode: { shared: false, data: { node_name => { path => entry } } }
    #
    # @return [Hash] Scratchpad snapshot data
    def snapshot_scratchpad
      if @type == :node_orchestrator
        snapshot_node_orchestrator_scratchpad
      else
        snapshot_swarm_scratchpad
      end
    end

    # Snapshot scratchpad for NodeOrchestrator
    #
    # @return [Hash] Structured scratchpad data with mode metadata
    def snapshot_node_orchestrator_scratchpad
      all_scratchpads = @orchestration.all_scratchpads
      return {} unless all_scratchpads&.any?

      if @orchestration.shared_scratchpad?
        # Enabled mode: single shared scratchpad
        shared_scratchpad = all_scratchpads[:shared]
        return {} unless shared_scratchpad

        entries = serialize_scratchpad_entries(shared_scratchpad.all_entries)
        return {} if entries.empty?

        {
          shared: true,
          data: entries,
        }
      else
        # Per-node mode: separate scratchpads per node
        node_data = {}
        all_scratchpads.each do |node_name, scratchpad|
          next unless scratchpad

          entries = serialize_scratchpad_entries(scratchpad.all_entries)
          node_data[node_name.to_s] = entries unless entries.empty?
        end

        return {} if node_data.empty?

        {
          shared: false,
          data: node_data,
        }
      end
    end

    # Snapshot scratchpad for Swarm
    #
    # @return [Hash] Flat scratchpad entries
    def snapshot_swarm_scratchpad
      scratchpad = @orchestration.scratchpad_storage
      return {} unless scratchpad

      entries_hash = scratchpad.all_entries
      return {} unless entries_hash&.any?

      serialize_scratchpad_entries(entries_hash)
    end

    # Serialize scratchpad entries to snapshot format
    #
    # @param entries_hash [Hash] { path => Entry }
    # @return [Hash] { path => { content:, title:, updated_at:, size: } }
    def serialize_scratchpad_entries(entries_hash)
      return {} unless entries_hash

      result = {}
      entries_hash.each do |path, entry|
        result[path] = {
          content: entry.content,
          title: entry.title,
          updated_at: entry.updated_at.iso8601,
          size: entry.size,
        }
      end
      result
    end

    # Snapshot read tracking state
    #
    # @return [Hash] { agent_name => { file_path => digest } }
    def snapshot_read_tracking
      result = {}

      # Get all agents (primary + delegations)
      agent_names = all_agent_names

      agent_names.each do |agent_name|
        files_with_digests = Tools::Stores::ReadTracker.get_read_files(agent_name)
        next if files_with_digests.empty?

        result[agent_name.to_s] = files_with_digests
      end

      result
    end

    # Snapshot memory read tracking state
    #
    # @return [Hash] { agent_name => { entry_path => digest } }
    def snapshot_memory_read_tracking
      return {} unless defined?(SwarmMemory::Core::StorageReadTracker)

      result = {}

      # Get all agents (primary + delegations)
      agent_names = all_agent_names

      agent_names.each do |agent_name|
        entries_with_digests = SwarmMemory::Core::StorageReadTracker.get_read_entries(agent_name)
        next if entries_with_digests.empty?

        result[agent_name.to_s] = entries_with_digests
      end

      result
    end

    # All agent names (primary + delegations)
    #
    # @return [Array<Symbol>] All agent names
    def all_agent_names
      # Get primary agent names - both types use agent_definitions
      agents_hash = @orchestration.agent_definitions.keys

      # Add delegation instance names
      delegations_hash = if @type == :swarm
        @orchestration.delegation_instances.keys
      else
        @orchestration.agent_instance_cache[:delegations].keys
      end

      agents_hash + delegations_hash.map(&:to_sym)
    end
  end
end
