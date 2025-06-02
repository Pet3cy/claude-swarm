# frozen_string_literal: true

require "fast_mcp"
require "json"
require_relative "claude_code_executor"
require_relative "task_tool"
require_relative "session_info_tool"
require_relative "reset_session_tool"

module ClaudeSwarm
  class ClaudeMcpServer
    # Class variables to share state with tool classes
    class << self
      attr_accessor :executor, :instance_config, :logger, :session_timestamp, :calling_instance
    end

    def initialize(instance_config, calling_instance:)
      @instance_config = instance_config
      @calling_instance = calling_instance
      @executor = ClaudeCodeExecutor.new(
        working_directory: instance_config[:directory],
        model: instance_config[:model],
        mcp_config: instance_config[:mcp_config_path],
        vibe: instance_config[:vibe],
        instance_name: instance_config[:name],
        calling_instance: calling_instance
      )

      # Set class variables so tools can access them
      self.class.executor = @executor
      self.class.instance_config = @instance_config
      self.class.logger = @executor.logger
      self.class.session_timestamp = @executor.session_timestamp
      self.class.calling_instance = @calling_instance
    end

    def start
      server = FastMcp::Server.new(
        name: @instance_config[:name],
        version: "1.0.0"
      )

      # Set dynamic description for TaskTool based on instance config
      if @instance_config[:description]
        TaskTool.description "Execute a task using Agent #{@instance_config[:name]}. #{@instance_config[:description]}"
      else
        TaskTool.description "Execute a task using Agent #{@instance_config[:name]}"
      end

      # Register tool classes (not instances)
      server.register_tool(TaskTool)
      server.register_tool(SessionInfoTool)
      server.register_tool(ResetSessionTool)

      # Start the stdio server
      server.start
    end
  end
end
