# frozen_string_literal: true

module SwarmSDK
  module Tools
    # Lazy-loading wrapper for MCP tools
    #
    # Creates minimal tool stub without calling tools/list.
    # Schema is fetched on-demand when LLM needs it.
    #
    # ## Boot Optimization
    #
    # When MCP server tools are pre-specified in configuration:
    # - Boot time: Create stubs instantly (no RPC)
    # - First LLM request: Fetch schema lazily (~100ms one-time cost)
    # - Subsequent requests: Use cached schema (instant)
    #
    # ## Thread Safety
    #
    # Schema loading is protected by Async::Semaphore with double-check pattern
    # to ensure only one fiber fetches the schema even under concurrent access.
    #
    # @example Creating a stub
    #   coordinator = RubyLLM::MCP::Coordinator.new(client)
    #   stub = McpToolStub.new(
    #     coordinator: coordinator,
    #     name: "search_code",
    #     description: "Search code in repository"
    #   )
    #
    # @example Schema is fetched lazily
    #   stub.params_schema  # First access triggers tools/list RPC
    #   stub.params_schema  # Cached, instant
    class McpToolStub < Base
      removable true # MCP tools can be controlled by skills

      attr_reader :name, :client

      # Create a new MCP tool stub
      #
      # @param client [RubyLLM::MCP::Client] MCP client instance
      # @param name [String] Tool name
      # @param description [String, nil] Tool description (optional, fetched if nil)
      # @param schema [Hash, nil] Tool input schema (optional, fetched if nil)
      #
      # @example Minimal stub (lazy description + schema)
      #   McpToolStub.new(client: client, name: "search")
      #
      # @example With description (lazy schema only)
      #   McpToolStub.new(
      #     client: client,
      #     name: "search",
      #     description: "Search the codebase"
      #   )
      #
      # @example Fully specified (no lazy loading)
      #   McpToolStub.new(
      #     client: client,
      #     name: "search",
      #     description: "Search the codebase",
      #     schema: { type: "object", properties: {...} }
      #   )
      def initialize(client:, name:, description: nil, schema: nil)
        super()
        @client = client
        @name = name
        @mcp_name = name
        @description = description || "MCP tool: #{name}"
        @input_schema = schema
        @schema_loaded = !schema.nil?
        @schema_mutex = Async::Semaphore.new(1) # Thread-safe schema loading
      end

      # Get tool description
      #
      # @return [String]
      attr_reader :description

      # Get parameter schema (lazy-loaded on first access)
      #
      # This method is called by RubyLLM when building tool schemas for LLM requests.
      # On first access, it triggers a tools/list RPC to fetch the schema.
      #
      # @return [Hash, nil] JSON Schema for tool parameters
      def params_schema
        ensure_schema_loaded!
        @input_schema
      end

      # Execute the MCP tool
      #
      # Calls the MCP server's tools/call endpoint with the provided parameters.
      # Schema is NOT required for execution - the server validates parameters.
      #
      # @param params [Hash] Tool parameters
      # @return [String, Hash] Tool result content or error hash
      def execute(**params)
        # Use client.call_tool (client has internal coordinator)
        result = @client.call_tool(
          name: @mcp_name,
          arguments: params,
        )

        # client.call_tool returns the result content directly
        result
      end

      private

      # Lazy-load schema on first access (when LLM needs it)
      #
      # Thread-safe via semaphore with double-check pattern.
      # Multiple concurrent fibers will only trigger one fetch.
      #
      # @return [void]
      def ensure_schema_loaded!
        return if @schema_loaded

        @schema_mutex.acquire do
          return if @schema_loaded # Double-check after acquiring lock

          # Fetch tool info from client (calls tools/list if not cached)
          tool_info = @client.tool_info(@mcp_name)

          if tool_info
            @description = tool_info["description"] || @description
            @input_schema = tool_info["inputSchema"]
          else
            # Tool doesn't exist on server - schema remains nil
            RubyLLM.logger.warn("SwarmSDK: MCP tool '#{@mcp_name}' not found on server during schema fetch")
          end

          @schema_loaded = true
        end
      end
    end
  end
end
