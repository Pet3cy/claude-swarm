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

      # Add scratchpad (Swarm only - NodeOrchestrator doesn't have persistent scratchpad)
      data[:scratchpad] = snapshot_scratchpad unless @type == :node_orchestrator

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
    # @return [Hash] { agent_name => { conversation:, context_state: } }
    def snapshot_agents
      result = {}

      # Get agents from appropriate source
      agents_hash = if @type == :swarm
        @orchestration.agents
      else
        @orchestration.agent_instance_cache[:primary]
      end

      agents_hash.each do |agent_name, agent_chat|
        result[agent_name.to_s] = {
          conversation: snapshot_conversation(agent_chat),
          context_state: snapshot_context_state(agent_chat),
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
    # @return [Hash] { "delegate@delegator" => { conversation:, context_state: } }
    def snapshot_delegation_instances
      result = {}

      # Get delegation instances from appropriate source
      delegations_hash = if @type == :swarm
        @orchestration.delegation_instances
      else
        @orchestration.agent_instance_cache[:delegations]
      end

      delegations_hash.each do |instance_name, delegation_chat|
        result[instance_name] = {
          conversation: snapshot_conversation(delegation_chat),
          context_state: snapshot_context_state(delegation_chat),
        }
      end

      result
    end

    # Snapshot scratchpad contents (Swarm only)
    #
    # @return [Hash] { path => { content:, title:, updated_at:, size: } }
    def snapshot_scratchpad
      return {} if @type == :node_orchestrator

      scratchpad = @orchestration.scratchpad_storage
      return {} unless scratchpad

      # Use new public API: all_entries returns { path => Entry }
      entries_hash = scratchpad.all_entries
      return {} unless entries_hash

      result = {}
      entries_hash.each do |path, entry|
        result[path] = {
          content: entry.content,
          title: entry.title,
          updated_at: entry.updated_at.iso8601, # Serialize Time as ISO8601 string
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
