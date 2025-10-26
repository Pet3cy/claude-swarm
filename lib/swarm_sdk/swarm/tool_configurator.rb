# frozen_string_literal: true

module SwarmSDK
  class Swarm
    # Handles tool creation, registration, and permissions wrapping
    #
    # Responsibilities:
    # - Register explicit tools for agents
    # - Register default tools (Read, Grep, Glob, etc.)
    # - Create tool instances (with agent context)
    # - Wrap tools with permissions validators
    #
    # This encapsulates all tool-related logic that was previously in Swarm.
    class ToolConfigurator
      # Default tools available to all agents (unless disable_default_tools is set)
      DEFAULT_TOOLS = [
        :Read,
        :Grep,
        :Glob,
        :TodoWrite,
        :Think,
        :WebFetch,
        :Clock,
      ].freeze

      # Scratchpad tools (added if scratchpad is enabled)
      SCRATCHPAD_TOOLS = [
        :ScratchpadWrite,
        :ScratchpadRead,
        :ScratchpadList,
      ].freeze

      def initialize(swarm, scratchpad_storage, plugin_storages = {})
        @swarm = swarm
        @scratchpad_storage = scratchpad_storage
        # Plugin storages: { plugin_name => { agent_name => storage } }
        # e.g., { memory: { agent1: storage1, agent2: storage2 } }
        @plugin_storages = plugin_storages
      end

      # Register all tools for an agent (both explicit and default)
      #
      # @param chat [AgentChat] The chat instance to register tools with
      # @param agent_name [Symbol] Name of the agent
      # @param agent_definition [AgentDefinition] Agent definition object
      def register_all_tools(chat:, agent_name:, agent_definition:)
        register_explicit_tools(chat, agent_definition.tools, agent_name: agent_name, agent_definition: agent_definition)
        register_default_tools(chat, agent_name: agent_name, agent_definition: agent_definition)
      end

      # Create a tool instance by name
      #
      # File tools and TodoWrite require agent context for tracking state.
      # Scratchpad tools require shared scratchpad instance.
      # Plugin tools are delegated to their respective plugins.
      #
      # This method is public for testing delegation from Swarm.
      #
      # @param tool_name [Symbol, String] Tool name
      # @param agent_name [Symbol] Agent name for context
      # @param directory [String] Agent's working directory
      # @param chat [Agent::Chat, nil] Optional chat instance for tools that need it
      # @param agent_definition [Agent::Definition, nil] Optional agent definition
      # @return [RubyLLM::Tool] Tool instance
      def create_tool_instance(tool_name, agent_name, directory, chat: nil, agent_definition: nil)
        tool_name_sym = tool_name.to_sym

        # Check if tool is provided by a plugin
        if PluginRegistry.plugin_tool?(tool_name_sym)
          return create_plugin_tool(tool_name_sym, agent_name, directory, chat, agent_definition)
        end

        case tool_name_sym
        when :Read
          Tools::Read.new(agent_name: agent_name, directory: directory)
        when :Write
          Tools::Write.new(agent_name: agent_name, directory: directory)
        when :Edit
          Tools::Edit.new(agent_name: agent_name, directory: directory)
        when :MultiEdit
          Tools::MultiEdit.new(agent_name: agent_name, directory: directory)
        when :Bash
          Tools::Bash.new(directory: directory)
        when :Glob
          Tools::Glob.new(directory: directory)
        when :Grep
          Tools::Grep.new(directory: directory)
        when :TodoWrite
          Tools::TodoWrite.new(agent_name: agent_name) # TodoWrite doesn't need directory
        when :ScratchpadWrite
          Tools::Scratchpad::ScratchpadWrite.create_for_scratchpad(@scratchpad_storage)
        when :ScratchpadRead
          Tools::Scratchpad::ScratchpadRead.create_for_scratchpad(@scratchpad_storage)
        when :ScratchpadList
          Tools::Scratchpad::ScratchpadList.create_for_scratchpad(@scratchpad_storage)
        when :Think
          Tools::Think.new
        when :Clock
          Tools::Clock.new
        else
          # Regular tools - get class from registry and instantiate
          tool_class = Tools::Registry.get(tool_name_sym)
          raise ConfigurationError, "Unknown tool: #{tool_name}" unless tool_class

          # Check if tool is marked as :special but not handled in case statement
          if tool_class == :special
            raise ConfigurationError,
              "Tool '#{tool_name}' requires special initialization but is not handled in create_tool_instance. " \
                "This is a bug - #{tool_name} should be added to the case statement above."
          end

          tool_class.new
        end
      end

      # Wrap a tool instance with permissions validator if configured
      #
      # This method is public for testing delegation from Swarm.
      #
      # @param tool_instance [RubyLLM::Tool] Tool instance to wrap
      # @param permissions_config [Hash, nil] Permission configuration
      # @param agent_definition [AgentDefinition] Agent definition
      # @return [RubyLLM::Tool] Either the wrapped tool or original tool
      def wrap_tool_with_permissions(tool_instance, permissions_config, agent_definition)
        # Skip wrapping if no permissions or agent bypasses permissions
        return tool_instance unless permissions_config
        return tool_instance if agent_definition.bypass_permissions

        # Create permissions config and wrap tool with validator
        permissions = Permissions::Config.new(
          permissions_config,
          base_directory: agent_definition.directory,
        )

        Permissions::Validator.new(tool_instance, permissions)
      end

      private

      # Register explicitly configured tools
      #
      # @param chat [AgentChat] The chat instance
      # @param tool_configs [Array<Hash>] Tool configurations with optional permissions
      # @param agent_name [Symbol] Agent name
      # @param agent_definition [AgentDefinition] Agent definition
      def register_explicit_tools(chat, tool_configs, agent_name:, agent_definition:)
        tool_configs.each do |tool_config|
          tool_name = tool_config[:name]
          permissions_config = tool_config[:permissions]

          # Create tool instance
          tool_instance = create_tool_instance(tool_name, agent_name, agent_definition.directory)

          # Wrap with permissions validator if configured
          tool_instance = wrap_tool_with_permissions(
            tool_instance,
            permissions_config,
            agent_definition,
          )

          chat.with_tool(tool_instance)
        end
      end

      # Register default tools for agents (unless disabled)
      #
      # Note: Memory tools are registered separately and are NOT affected by
      # disable_default_tools, since they're configured via memory {} block.
      #
      # @param chat [AgentChat] The chat instance
      # @param agent_name [Symbol] Agent name
      # @param agent_definition [AgentDefinition] Agent definition
      def register_default_tools(chat, agent_name:, agent_definition:)
        # Get explicit tool names to avoid duplicates
        explicit_tool_names = agent_definition.tools.map { |t| t[:name] }.to_set

        # Register core default tools (unless disabled)
        if agent_definition.disable_default_tools != true
          DEFAULT_TOOLS.each do |tool_name|
            register_tool_if_not_disabled(chat, tool_name, explicit_tool_names, agent_name, agent_definition)
          end

          # Register scratchpad tools if enabled
          if @swarm.scratchpad_enabled?
            SCRATCHPAD_TOOLS.each do |tool_name|
              register_tool_if_not_disabled(chat, tool_name, explicit_tool_names, agent_name, agent_definition)
            end
          end
        end

        # Register plugin tools if plugin storage is enabled for this agent
        # Plugin tools are NOT affected by disable_default_tools since they're
        # explicitly configured via plugin config blocks (e.g., memory {} block)
        register_plugin_tools(chat, agent_name, agent_definition, explicit_tool_names)
      end

      # Register a tool if not already explicit or disabled
      def register_tool_if_not_disabled(chat, tool_name, explicit_tool_names, agent_name, agent_definition)
        # Skip if already registered explicitly
        return if explicit_tool_names.include?(tool_name)

        # Skip if tool is in the disable list
        return if tool_disabled?(tool_name, agent_definition.disable_default_tools)

        tool_instance = create_tool_instance(tool_name, agent_name, agent_definition.directory)

        # Resolve permissions for default tool
        permissions_config = agent_definition.agent_permissions[tool_name] ||
          agent_definition.default_permissions[tool_name]

        # Wrap with permissions validator if configured
        tool_instance = wrap_tool_with_permissions(
          tool_instance,
          permissions_config,
          agent_definition,
        )

        chat.with_tool(tool_instance)
      end

      # Create a tool instance via plugin
      #
      # @param tool_name [Symbol] Tool name
      # @param agent_name [Symbol] Agent name
      # @param directory [String] Working directory
      # @param chat [Agent::Chat, nil] Chat instance
      # @param agent_definition [Agent::Definition, nil] Agent definition
      # @return [RubyLLM::Tool] Tool instance
      def create_plugin_tool(tool_name, agent_name, directory, chat, agent_definition)
        plugin = PluginRegistry.plugin_for_tool(tool_name)
        raise ConfigurationError, "Tool #{tool_name} is not provided by any plugin" unless plugin

        # Get plugin storage for this agent
        plugin_storages = @plugin_storages[plugin.name] || {}
        storage = plugin_storages[agent_name]

        # Build context for tool creation
        context = {
          agent_name: agent_name,
          directory: directory,
          storage: storage,
          agent_definition: agent_definition,
          chat: chat,
          tool_configurator: self,
        }

        plugin.create_tool(tool_name, context)
      end

      # Register plugin-provided tools for an agent
      #
      # Asks all plugins if they have tools to register for this agent.
      #
      # @param chat [Agent::Chat] Chat instance
      # @param agent_name [Symbol] Agent name
      # @param agent_definition [Agent::Definition] Agent definition
      # @param explicit_tool_names [Set<Symbol>] Already-registered tool names
      def register_plugin_tools(chat, agent_name, agent_definition, explicit_tool_names)
        PluginRegistry.all.each do |plugin|
          # Check if plugin has storage enabled for this agent
          next unless plugin.storage_enabled?(agent_definition)

          # Get plugin storage for this agent
          plugin_storages = @plugin_storages[plugin.name] || {}
          plugin_storages[agent_name]

          # Register each tool provided by the plugin
          plugin.tools.each do |tool_name|
            # Skip if already registered explicitly
            next if explicit_tool_names.include?(tool_name)

            tool_instance = create_tool_instance(
              tool_name,
              agent_name,
              agent_definition.directory,
              chat: chat,
              agent_definition: agent_definition,
            )

            # Resolve permissions for plugin tool
            permissions_config = agent_definition.agent_permissions[tool_name] ||
              agent_definition.default_permissions[tool_name]

            # Wrap with permissions validator if configured
            tool_instance = wrap_tool_with_permissions(
              tool_instance,
              permissions_config,
              agent_definition,
            )

            chat.with_tool(tool_instance)
          end
        end
      end

      # Check if a tool should be disabled based on disable_default_tools config
      #
      # @param tool_name [Symbol] Tool name to check
      # @param disable_config [nil, Boolean, Array<Symbol>] Disable configuration
      # @return [Boolean] True if tool should be disabled
      def tool_disabled?(tool_name, disable_config)
        return false if disable_config.nil?

        if disable_config == true
          # Disable all default tools
          true
        elsif disable_config.is_a?(Array)
          # Disable only tools in the array
          disable_config.include?(tool_name)
        else
          false
        end
      end

      # Register agent delegation tools
      #
      # Creates delegation tools that allow one agent to call another.
      #
      # @param chat [AgentChat] The chat instance
      # @param delegate_names [Array<Symbol>] Names of agents to delegate to
      # @param agent_name [Symbol] Name of the agent doing the delegating
      def register_delegation_tools(chat, delegate_names, agent_name:)
        return if delegate_names.empty?

        delegate_names.each do |delegate_name|
          delegate_name = delegate_name.to_sym

          unless @agents.key?(delegate_name)
            raise ConfigurationError, "Agent delegates to unknown agent '#{delegate_name}'"
          end

          # Create a tool that delegates to the specified agent
          delegate_agent = @agents[delegate_name]
          delegate_definition = @agent_definitions[delegate_name]

          tool = Tools::Delegate.new(
            delegate_name: delegate_name.to_s,
            delegate_description: delegate_definition.description,
            delegate_chat: delegate_agent,
            agent_name: agent_name,
            swarm: @swarm,
            hook_registry: @hook_registry,
            delegating_chat: chat,
          )

          chat.with_tool(tool)
        end
      end

      # Pass 4: Configure hook system
      #
      # Setup the callback system for each agent.
      def pass_4_configure_hooks
        @agents.each do |agent_name, chat|
          agent_definition = @agent_definitions[agent_name]

          chat.setup_hooks(
            registry: @hook_registry,
            agent_definition: agent_definition,
            swarm: @swarm,
          ) if chat.respond_to?(:setup_hooks)
        end
      end

      # Pass 5: Apply YAML hooks if present
      #
      # If loaded from YAML, apply agent-specific hooks.
      def pass_5_apply_yaml_hooks
        return unless @config_for_hooks

        @agents.each do |agent_name, chat|
          agent_def = @config_for_hooks.agents[agent_name]
          next unless agent_def&.hooks

          HooksAdapter.apply_agent_hooks(chat, agent_name, agent_def.hooks, @swarm.name)
        end
      end

      # Create an AgentChat instance
      #
      # NOTE: This is dead code, left over from refactoring. AgentInitializer
      # now handles agent creation. This should be removed in a cleanup pass.
      #
      # @param agent_name [Symbol] Agent name
      # @param agent_definition [AgentDefinition] Agent definition
      # @param tool_configurator [ToolConfigurator] Tool configurator
      # @return [AgentChat] Configured chat instance
      def create_agent_chat(agent_name, agent_definition, tool_configurator)
        chat = AgentChat.new(
          definition: agent_definition.to_h,
          global_semaphore: @global_semaphore,
        )

        # Set agent name on provider for logging (if provider supports it)
        chat.provider.agent_name = agent_name if chat.provider.respond_to?(:agent_name=)

        # Register tools
        tool_configurator.register_all_tools(
          chat: chat,
          agent_name: agent_name,
          agent_definition: agent_definition,
        )

        # Register MCP servers if any
        if agent_definition.mcp_servers.any?
          mcp_configurator = McpConfigurator.new(@swarm)
          mcp_configurator.register_mcp_servers(chat, agent_definition.mcp_servers, agent_name: agent_name)
        end

        chat
      end
    end
  end
end
