# frozen_string_literal: true

require "test_helper"

module OpenAI
  class IntegrationTest < Minitest::Test
    def create_mock_executor
      mock_logger = Minitest::Mock.new
      def mock_logger.info(*args); end
      def mock_logger.error(*args); end
      def mock_logger.warn(*args); end
      def mock_logger.debug(*args); end
      def mock_logger.log(*args); end

      mock_executor = Minitest::Mock.new
      mock_executor.expect(:logger, mock_logger)
      # Make logger callable multiple times
      def mock_executor.logger
        @mock_logger ||= begin
          logger = Minitest::Mock.new
          def logger.info(*args); end
          def logger.error(*args); end
          def logger.warn(*args); end
          def logger.debug(*args); end
          def logger.log(*args); end
          logger
        end
      end
      mock_executor
    end

    def test_chat_completion_simple_message
      # Create mock executor with logger
      mock_executor = create_mock_executor

      mock_mcp_client = Minitest::Mock.new
      mock_openai_client = Minitest::Mock.new

      api = ClaudeSwarm::OpenAI::ChatCompletion.new(
        openai_client: mock_openai_client,
        mcp_client: mock_mcp_client,
        available_tools: [],
        executor: mock_executor,
        instance_name: "test",
        model: "gpt-4o",
      )

      # Mock the chat call
      mock_response = {
        "choices" => [{
          "message" => {
            "role" => "assistant",
            "content" => "Hello world!",
          },
        }],
      }

      mock_openai_client.expect(:chat, mock_response) do |params|
        params[:parameters][:messages].last[:content] == "Hello"
      end

      result = api.execute("Hello")

      assert_equal("Hello world!", result)

      mock_openai_client.verify
    end

    def test_chat_completion_with_reasoning_effort
      # Create mock executor with logger
      mock_executor = create_mock_executor

      mock_mcp_client = Minitest::Mock.new
      mock_openai_client = Minitest::Mock.new

      api = ClaudeSwarm::OpenAI::ChatCompletion.new(
        openai_client: mock_openai_client,
        mcp_client: mock_mcp_client,
        available_tools: [],
        executor: mock_executor,
        instance_name: "test",
        model: "o3-pro",
        reasoning_effort: "high",
      )

      # Mock the chat call - verify reasoning_effort appears in request
      mock_response = {
        "choices" => [{
          "message" => {
            "role" => "assistant",
            "content" => "Hello world with reasoning!",
          },
        }],
      }

      mock_openai_client.expect(:chat, mock_response) do |params|
        # Verify request contains reasoning_effort parameter and message content
        params[:parameters][:messages].last[:content] == "Hello" &&
          params[:parameters][:reasoning_effort] == "high"
      end

      result = api.execute("Hello")

      # Verify response is properly processed
      assert_equal("Hello world with reasoning!", result)

      mock_openai_client.verify
    end

    def test_chat_completion_with_all_o_series_models
      ["o1", "o1 Preview", "o1-mini", "o1-pro", "o3", "o3-mini", "o3-pro", "o3-deep-research", "o4-mini", "o4-mini-deep-research"].each do |model|
        # Create mock executor with logger
        mock_executor = create_mock_executor

        mock_mcp_client = Minitest::Mock.new
        mock_openai_client = Minitest::Mock.new

        api = ClaudeSwarm::OpenAI::ChatCompletion.new(
          openai_client: mock_openai_client,
          mcp_client: mock_mcp_client,
          available_tools: [],
          executor: mock_executor,
          instance_name: "test",
          model: model,
          reasoning_effort: "medium",
        )

        # Mock the chat call - verify reasoning_effort appears in request
        mock_response = {
          "choices" => [{
            "message" => {
              "role" => "assistant",
              "content" => "Response from #{model}",
            },
          }],
        }

        mock_openai_client.expect(:chat, mock_response) do |params|
          params[:parameters][:model] == model &&
            params[:parameters][:reasoning_effort] == "medium"
        end

        result = api.execute("Test")

        assert_equal("Response from #{model}", result)

        mock_openai_client.verify
      end
    end

    def test_chat_completion_without_reasoning_effort_parameter
      # Create mock executor with logger
      mock_executor = create_mock_executor

      mock_mcp_client = Minitest::Mock.new
      mock_openai_client = Minitest::Mock.new

      api = ClaudeSwarm::OpenAI::ChatCompletion.new(
        openai_client: mock_openai_client,
        mcp_client: mock_mcp_client,
        available_tools: [],
        executor: mock_executor,
        instance_name: "test",
        model: "gpt-4o",
        reasoning_effort: nil,
      )

      # Mock the chat call - verify reasoning_effort is NOT in request
      mock_response = {
        "choices" => [{
          "message" => {
            "role" => "assistant",
            "content" => "Hello world!",
          },
        }],
      }

      mock_openai_client.expect(:chat, mock_response) do |params|
        params[:parameters][:messages].last[:content] == "Hello" &&
          !params[:parameters].key?(:reasoning_effort)
      end

      result = api.execute("Hello")

      assert_equal("Hello world!", result)

      mock_openai_client.verify
    end

    def test_responses_api_simple_message
      # Create mock executor with logger
      mock_executor = create_mock_executor

      mock_mcp_client = Minitest::Mock.new
      mock_openai_client = Minitest::Mock.new
      mock_responses_api = Minitest::Mock.new

      # Set up OpenAI client to return responses API
      mock_openai_client.expect(:responses, mock_responses_api)

      api = ClaudeSwarm::OpenAI::Responses.new(
        openai_client: mock_openai_client,
        mcp_client: mock_mcp_client,
        available_tools: [],
        executor: mock_executor,
        instance_name: "test",
        model: "o3-pro",
      )

      # Mock the create call
      mock_response = {
        "id" => "resp_123",
        "output" => [{
          "type" => "message",
          "content" => [{
            "type" => "text",
            "text" => "Hello from responses API!",
          }],
        }],
      }

      mock_responses_api.expect(:create, mock_response) do |params|
        params[:parameters][:input] == "Hello"
      end

      result = api.execute("Hello")

      assert_equal("Hello from responses API!", result)

      mock_openai_client.verify
      mock_responses_api.verify
    end

    def test_responses_api_with_reasoning_effort
      # Create mock executor with logger
      mock_executor = create_mock_executor

      mock_mcp_client = Minitest::Mock.new
      mock_openai_client = Minitest::Mock.new
      mock_responses_api = Minitest::Mock.new

      # Set up OpenAI client to return responses API
      mock_openai_client.expect(:responses, mock_responses_api)

      api = ClaudeSwarm::OpenAI::Responses.new(
        openai_client: mock_openai_client,
        mcp_client: mock_mcp_client,
        available_tools: [],
        executor: mock_executor,
        instance_name: "test",
        model: "o3-pro",
        reasoning_effort: "medium",
      )

      # Mock the create call
      mock_response = {
        "id" => "resp_123",
        "output" => [{
          "type" => "message",
          "content" => [{
            "type" => "text",
            "text" => "Hello from responses API with reasoning!",
          }],
        }],
      }

      mock_responses_api.expect(:create, mock_response) do |params|
        # Verify request contains reasoning parameter with correct format for responses API
        params[:parameters][:input] == "Hello" &&
          params[:parameters][:reasoning] == { effort: "medium" }
      end

      result = api.execute("Hello")

      assert_equal("Hello from responses API with reasoning!", result)

      mock_openai_client.verify
      mock_responses_api.verify
    end

    def test_responses_api_without_reasoning_effort_parameter
      # Create mock executor with logger
      mock_executor = create_mock_executor

      mock_mcp_client = Minitest::Mock.new
      mock_openai_client = Minitest::Mock.new
      mock_responses_api = Minitest::Mock.new

      # Set up OpenAI client to return responses API
      mock_openai_client.expect(:responses, mock_responses_api)

      api = ClaudeSwarm::OpenAI::Responses.new(
        openai_client: mock_openai_client,
        mcp_client: mock_mcp_client,
        available_tools: [],
        executor: mock_executor,
        instance_name: "test",
        model: "o3-pro",
        reasoning_effort: nil,
      )

      # Mock the create call
      mock_response = {
        "id" => "resp_123",
        "output" => [{
          "type" => "message",
          "content" => [{
            "type" => "text",
            "text" => "Hello from responses API!",
          }],
        }],
      }

      mock_responses_api.expect(:create, mock_response) do |params|
        params[:parameters][:input] == "Hello" &&
          !params[:parameters].key?(:reasoning)
      end

      result = api.execute("Hello")

      assert_equal("Hello from responses API!", result)

      mock_openai_client.verify
      mock_responses_api.verify
    end

    def test_responses_api_with_all_o_series_models
      ["o1", "o1 Preview", "o1-mini", "o1-pro", "o3", "o3-mini", "o3-pro", "o3-deep-research", "o4-mini", "o4-mini-deep-research"].each do |model|
        # Create mock executor with logger
        mock_executor = create_mock_executor

        mock_mcp_client = Minitest::Mock.new
        mock_openai_client = Minitest::Mock.new
        mock_responses_api = Minitest::Mock.new

        # Set up OpenAI client to return responses API
        mock_openai_client.expect(:responses, mock_responses_api)

        api = ClaudeSwarm::OpenAI::Responses.new(
          openai_client: mock_openai_client,
          mcp_client: mock_mcp_client,
          available_tools: [],
          executor: mock_executor,
          instance_name: "test",
          model: model,
          reasoning_effort: "low",
        )

        # Mock the create call
        mock_response = {
          "id" => "resp_#{model}",
          "output" => [{
            "type" => "message",
            "content" => [{
              "type" => "text",
              "text" => "Response from #{model} with reasoning",
            }],
          }],
        }

        mock_responses_api.expect(:create, mock_response) do |params|
          params[:parameters][:model] == model &&
            params[:parameters][:reasoning] == { effort: "low" }
        end

        result = api.execute("Test")

        assert_equal("Response from #{model} with reasoning", result)

        mock_openai_client.verify
        mock_responses_api.verify
      end
    end

    def test_chat_completion_with_tools
      # Create mock executor with logger
      mock_executor = create_mock_executor

      mock_mcp_client = Minitest::Mock.new
      mock_openai_client = Minitest::Mock.new

      # Create a mock tool
      mock_tool = Struct.new(:name, :description, :schema).new(
        "TestTool",
        "A test tool",
        { "type" => "object", "properties" => {} },
      )

      api = ClaudeSwarm::OpenAI::ChatCompletion.new(
        openai_client: mock_openai_client,
        mcp_client: mock_mcp_client,
        available_tools: [mock_tool],
        executor: mock_executor,
        instance_name: "test",
        model: "gpt-4o",
      )

      # Mock MCP client's to_openai_tools method (called multiple times)
      2.times do
        mock_mcp_client.expect(:to_openai_tools, [{
          type: "function",
          function: {
            name: "TestTool",
            description: "A test tool",
            parameters: { "type" => "object", "properties" => {} },
          },
        }])
      end

      # First response with tool call
      first_response = {
        "choices" => [{
          "message" => {
            "role" => "assistant",
            "tool_calls" => [{
              "id" => "call_123",
              "type" => "function",
              "function" => {
                "name" => "TestTool",
                "arguments" => "{}",
              },
            }],
          },
        }],
      }

      mock_openai_client.expect(:chat, first_response) do |params|
        params[:parameters][:tools]&.any?
      end

      # Mock tool execution
      mock_mcp_client.expect(
        :call_tool,
        {
          "content" => [{ "type" => "text", "text" => "Tool result" }],
        },
        ["TestTool", {}],
      )

      # Second response after tool execution
      second_response = {
        "choices" => [{
          "message" => {
            "role" => "assistant",
            "content" => "Tool executed successfully",
          },
        }],
      }

      mock_openai_client.expect(:chat, second_response) do |params|
        params[:parameters][:messages].any? { |m| m[:role] == "tool" }
      end

      result = api.execute("Use the test tool")

      assert_equal("Tool executed successfully", result)

      mock_openai_client.verify
      mock_mcp_client.verify
    end

    def test_chat_completion_with_tools_and_reasoning_effort
      # Create mock executor with logger
      mock_executor = create_mock_executor

      mock_mcp_client = Minitest::Mock.new
      mock_openai_client = Minitest::Mock.new

      # Create a mock tool
      mock_tool = Struct.new(:name, :description, :schema).new(
        "TestTool",
        "A test tool",
        { "type" => "object", "properties" => {} },
      )

      api = ClaudeSwarm::OpenAI::ChatCompletion.new(
        openai_client: mock_openai_client,
        mcp_client: mock_mcp_client,
        available_tools: [mock_tool],
        executor: mock_executor,
        instance_name: "test",
        model: "o3",
        reasoning_effort: "low",
      )

      # Mock MCP client's to_openai_tools method (called multiple times)
      2.times do
        mock_mcp_client.expect(:to_openai_tools, [{
          type: "function",
          function: {
            name: "TestTool",
            description: "A test tool",
            parameters: { "type" => "object", "properties" => {} },
          },
        }])
      end

      # First response with tool call
      first_response = {
        "choices" => [{
          "message" => {
            "role" => "assistant",
            "tool_calls" => [{
              "id" => "call_123",
              "type" => "function",
              "function" => {
                "name" => "TestTool",
                "arguments" => "{}",
              },
            }],
          },
        }],
      }

      mock_openai_client.expect(:chat, first_response) do |params|
        params[:parameters][:tools]&.any? &&
          params[:parameters][:reasoning_effort] == "low"
      end

      # Mock tool execution
      mock_mcp_client.expect(
        :call_tool,
        {
          "content" => [{ "type" => "text", "text" => "Tool result" }],
        },
        ["TestTool", {}],
      )

      # Second response after tool execution
      second_response = {
        "choices" => [{
          "message" => {
            "role" => "assistant",
            "content" => "Tool executed successfully with reasoning",
          },
        }],
      }

      mock_openai_client.expect(:chat, second_response) do |params|
        params[:parameters][:messages].any? { |m| m[:role] == "tool" } &&
          params[:parameters][:reasoning_effort] == "low"
      end

      result = api.execute("Use the test tool")

      assert_equal("Tool executed successfully with reasoning", result)

      mock_openai_client.verify
      mock_mcp_client.verify
    end

    def test_responses_api_with_tools
      # Create mock executor with logger
      mock_executor = create_mock_executor

      mock_mcp_client = Minitest::Mock.new
      mock_openai_client = Minitest::Mock.new
      mock_responses_api = Minitest::Mock.new

      # Set up OpenAI client to return responses API (called twice - once in init, once per API call)
      2.times do
        mock_openai_client.expect(:responses, mock_responses_api)
      end

      # Create a mock tool
      mock_tool = Struct.new(:name, :description, :schema).new(
        "TestTool",
        "A test tool",
        { "type" => "object", "properties" => {} },
      )

      api = ClaudeSwarm::OpenAI::Responses.new(
        openai_client: mock_openai_client,
        mcp_client: mock_mcp_client,
        available_tools: [mock_tool],
        executor: mock_executor,
        instance_name: "test",
        model: "o3-pro",
      )

      # First response with function call
      first_response = {
        "id" => "resp_1",
        "output" => [{
          "type" => "function_call",
          "name" => "TestTool",
          "arguments" => "{}",
          "call_id" => "call_123",
          "id" => "fc_123",
        }],
      }

      mock_responses_api.expect(:create, first_response) do |params|
        params[:parameters][:tools]&.any?
      end

      # Mock tool execution
      mock_mcp_client.expect(
        :call_tool,
        {
          "content" => [{ "type" => "text", "text" => "Tool result" }],
        },
        ["TestTool", {}],
      )

      # Second response after tool execution
      second_response = {
        "id" => "resp_2",
        "output" => [{
          "type" => "message",
          "content" => [{
            "type" => "text",
            "text" => "Tool executed via responses API",
          }],
        }],
        "previous_response_id" => "resp_1",
      }

      mock_responses_api.expect(:create, second_response) do |actual_params|
        # Just check that it has the right structure
        actual_params[:parameters][:input].is_a?(Array) &&
          actual_params[:parameters][:previous_response_id] == "resp_1"
      end

      result = api.execute("Use the test tool")

      assert_equal("Tool executed via responses API", result)

      mock_openai_client.verify
      mock_responses_api.verify
      mock_mcp_client.verify
    end

    def test_responses_api_with_tools_and_reasoning_effort
      # Create mock executor with logger
      mock_executor = create_mock_executor

      mock_mcp_client = Minitest::Mock.new
      mock_openai_client = Minitest::Mock.new
      mock_responses_api = Minitest::Mock.new

      # Set up OpenAI client to return responses API (called twice - once in init, once per API call)
      2.times do
        mock_openai_client.expect(:responses, mock_responses_api)
      end

      # Create a mock tool
      mock_tool = Struct.new(:name, :description, :schema).new(
        "TestTool",
        "A test tool",
        { "type" => "object", "properties" => {} },
      )

      api = ClaudeSwarm::OpenAI::Responses.new(
        openai_client: mock_openai_client,
        mcp_client: mock_mcp_client,
        available_tools: [mock_tool],
        executor: mock_executor,
        instance_name: "test",
        model: "o3-pro",
        reasoning_effort: "high",
      )

      # First response with function call
      first_response = {
        "id" => "resp_1",
        "output" => [{
          "type" => "function_call",
          "name" => "TestTool",
          "arguments" => "{}",
          "call_id" => "call_123",
          "id" => "fc_123",
        }],
      }

      mock_responses_api.expect(:create, first_response) do |params|
        params[:parameters][:tools]&.any? &&
          params[:parameters][:reasoning] == { effort: "high" }
      end

      # Mock tool execution
      mock_mcp_client.expect(
        :call_tool,
        {
          "content" => [{ "type" => "text", "text" => "Tool result" }],
        },
        ["TestTool", {}],
      )

      # Second response after tool execution
      second_response = {
        "id" => "resp_2",
        "output" => [{
          "type" => "message",
          "content" => [{
            "type" => "text",
            "text" => "Tool executed via responses API with reasoning",
          }],
        }],
        "previous_response_id" => "resp_1",
      }

      mock_responses_api.expect(:create, second_response) do |actual_params|
        # Just check that it has the right structure
        actual_params[:parameters][:input].is_a?(Array) &&
          actual_params[:parameters][:previous_response_id] == "resp_1" &&
          actual_params[:parameters][:reasoning] == { effort: "high" }
      end

      result = api.execute("Use the test tool")

      assert_equal("Tool executed via responses API with reasoning", result)

      mock_openai_client.verify
      mock_responses_api.verify
      mock_mcp_client.verify
    end

    # Temperature parameter tests

    def test_chat_completion_with_temperature_for_gpt_model
      # Create mock executor with logger
      mock_executor = create_mock_executor

      mock_mcp_client = Minitest::Mock.new
      mock_openai_client = Minitest::Mock.new

      api = ClaudeSwarm::OpenAI::ChatCompletion.new(
        openai_client: mock_openai_client,
        mcp_client: mock_mcp_client,
        available_tools: [],
        executor: mock_executor,
        instance_name: "test",
        model: "gpt-4",
        temperature: 0.8,
      )

      # Mock the chat call - verify temperature is included for GPT models
      mock_response = {
        "choices" => [{
          "message" => {
            "role" => "assistant",
            "content" => "Hello with temperature!",
          },
        }],
      }

      mock_openai_client.expect(:chat, mock_response) do |params|
        params[:parameters][:temperature] == 0.8 &&
          params[:parameters][:model] == "gpt-4"
      end

      result = api.execute("Hello")

      assert_equal("Hello with temperature!", result)

      mock_openai_client.verify
    end

    def test_chat_completion_without_temperature_for_o_series_model
      # Create mock executor with logger
      mock_executor = create_mock_executor

      mock_mcp_client = Minitest::Mock.new
      mock_openai_client = Minitest::Mock.new

      api = ClaudeSwarm::OpenAI::ChatCompletion.new(
        openai_client: mock_openai_client,
        mcp_client: mock_mcp_client,
        available_tools: [],
        executor: mock_executor,
        instance_name: "test",
        model: "o1",
        temperature: 0.8, # This should be ignored
      )

      # Mock the chat call - verify temperature is NOT included for O series models
      mock_response = {
        "choices" => [{
          "message" => {
            "role" => "assistant",
            "content" => "Hello without temperature!",
          },
        }],
      }

      mock_openai_client.expect(:chat, mock_response) do |params|
        !params[:parameters].key?(:temperature) &&
          params[:parameters][:model] == "o1"
      end

      result = api.execute("Hello")

      assert_equal("Hello without temperature!", result)

      mock_openai_client.verify
    end

    def test_responses_api_with_temperature_for_gpt_model
      # Create mock executor with logger
      mock_executor = create_mock_executor

      mock_mcp_client = Minitest::Mock.new
      mock_openai_client = Minitest::Mock.new
      mock_responses_api = Minitest::Mock.new

      # Set up OpenAI client to return responses API
      mock_openai_client.expect(:responses, mock_responses_api)

      api = ClaudeSwarm::OpenAI::Responses.new(
        openai_client: mock_openai_client,
        mcp_client: mock_mcp_client,
        available_tools: [],
        executor: mock_executor,
        instance_name: "test",
        model: "gpt-4o",
        temperature: 0.7,
      )

      # Mock the create call - verify temperature is included for GPT models
      mock_response = {
        "id" => "resp_123",
        "output" => [{
          "type" => "message",
          "content" => [{
            "type" => "text",
            "text" => "Hello from responses API with temperature!",
          }],
        }],
      }

      mock_responses_api.expect(:create, mock_response) do |params|
        params[:parameters][:temperature] == 0.7 &&
          params[:parameters][:model] == "gpt-4o"
      end

      result = api.execute("Hello")

      assert_equal("Hello from responses API with temperature!", result)

      mock_openai_client.verify
      mock_responses_api.verify
    end

    def test_responses_api_without_temperature_for_o_series_model
      # Create mock executor with logger
      mock_executor = create_mock_executor

      mock_mcp_client = Minitest::Mock.new
      mock_openai_client = Minitest::Mock.new
      mock_responses_api = Minitest::Mock.new

      # Set up OpenAI client to return responses API
      mock_openai_client.expect(:responses, mock_responses_api)

      api = ClaudeSwarm::OpenAI::Responses.new(
        openai_client: mock_openai_client,
        mcp_client: mock_mcp_client,
        available_tools: [],
        executor: mock_executor,
        instance_name: "test",
        model: "o3",
        temperature: 0.9, # This should be ignored
      )

      # Mock the create call - verify temperature is NOT included for O series models
      mock_response = {
        "id" => "resp_123",
        "output" => [{
          "type" => "message",
          "content" => [{
            "type" => "text",
            "text" => "Hello from responses API without temperature!",
          }],
        }],
      }

      mock_responses_api.expect(:create, mock_response) do |params|
        !params[:parameters].key?(:temperature) &&
          params[:parameters][:model] == "o3"
      end

      result = api.execute("Hello")

      assert_equal("Hello from responses API without temperature!", result)

      mock_openai_client.verify
      mock_responses_api.verify
    end

    def test_chat_completion_all_o_series_models_exclude_temperature
      ["o1", "o1 Preview", "o1-mini", "o1-pro", "o3", "o3-mini", "o3-pro", "o3-deep-research", "o4-mini", "o4-mini-deep-research"].each do |model|
        # Create mock executor with logger
        mock_executor = create_mock_executor

        mock_mcp_client = Minitest::Mock.new
        mock_openai_client = Minitest::Mock.new

        api = ClaudeSwarm::OpenAI::ChatCompletion.new(
          openai_client: mock_openai_client,
          mcp_client: mock_mcp_client,
          available_tools: [],
          executor: mock_executor,
          instance_name: "test",
          model: model,
          temperature: 0.5,
        )

        # Mock the chat call
        mock_response = {
          "choices" => [{
            "message" => {
              "role" => "assistant",
              "content" => "Response from #{model}",
            },
          }],
        }

        mock_openai_client.expect(:chat, mock_response) do |params|
          !params[:parameters].key?(:temperature) &&
            params[:parameters][:model] == model
        end

        result = api.execute("Test")

        assert_equal("Response from #{model}", result)

        mock_openai_client.verify
      end
    end

    def test_responses_api_all_o_series_models_exclude_temperature
      ["o1", "o1 Preview", "o1-mini", "o1-pro", "o3", "o3-mini", "o3-pro", "o3-deep-research", "o4-mini", "o4-mini-deep-research"].each do |model|
        # Create mock executor with logger
        mock_executor = create_mock_executor

        mock_mcp_client = Minitest::Mock.new
        mock_openai_client = Minitest::Mock.new
        mock_responses_api = Minitest::Mock.new

        # Set up OpenAI client to return responses API
        mock_openai_client.expect(:responses, mock_responses_api)

        api = ClaudeSwarm::OpenAI::Responses.new(
          openai_client: mock_openai_client,
          mcp_client: mock_mcp_client,
          available_tools: [],
          executor: mock_executor,
          instance_name: "test",
          model: model,
          temperature: 0.5,
        )

        # Mock the create call
        mock_response = {
          "id" => "resp_#{model}",
          "output" => [{
            "type" => "message",
            "content" => [{
              "type" => "text",
              "text" => "Response from #{model}",
            }],
          }],
        }

        mock_responses_api.expect(:create, mock_response) do |params|
          !params[:parameters].key?(:temperature) &&
            params[:parameters][:model] == model
        end

        result = api.execute("Test")

        assert_equal("Response from #{model}", result)

        mock_openai_client.verify
        mock_responses_api.verify
      end
    end

    # Tests for reasoning_effort restriction to O series models

    def test_chat_completion_with_reasoning_effort_for_gpt_model_excludes_it
      # Create mock executor with logger
      mock_executor = create_mock_executor

      mock_mcp_client = Minitest::Mock.new
      mock_openai_client = Minitest::Mock.new

      api = ClaudeSwarm::OpenAI::ChatCompletion.new(
        openai_client: mock_openai_client,
        mcp_client: mock_mcp_client,
        available_tools: [],
        executor: mock_executor,
        instance_name: "test",
        model: "gpt-4",
        reasoning_effort: "high", # This should be ignored for GPT models
      )

      # Mock the chat call - verify reasoning_effort is NOT included for GPT models
      mock_response = {
        "choices" => [{
          "message" => {
            "role" => "assistant",
            "content" => "Hello from GPT-4!",
          },
        }],
      }

      mock_openai_client.expect(:chat, mock_response) do |params|
        !params[:parameters].key?(:reasoning_effort) &&
          params[:parameters][:model] == "gpt-4"
      end

      result = api.execute("Hello")

      assert_equal("Hello from GPT-4!", result)

      mock_openai_client.verify
    end

    def test_responses_api_with_reasoning_effort_for_gpt_model_excludes_it
      # Create mock executor with logger
      mock_executor = create_mock_executor

      mock_mcp_client = Minitest::Mock.new
      mock_openai_client = Minitest::Mock.new
      mock_responses_api = Minitest::Mock.new

      # Set up OpenAI client to return responses API
      mock_openai_client.expect(:responses, mock_responses_api)

      api = ClaudeSwarm::OpenAI::Responses.new(
        openai_client: mock_openai_client,
        mcp_client: mock_mcp_client,
        available_tools: [],
        executor: mock_executor,
        instance_name: "test",
        model: "gpt-4o",
        reasoning_effort: "medium", # This should be ignored for GPT models
      )

      # Mock the create call - verify reasoning is NOT included for GPT models
      mock_response = {
        "id" => "resp_123",
        "output" => [{
          "type" => "message",
          "content" => [{
            "type" => "text",
            "text" => "Hello from GPT-4o responses API!",
          }],
        }],
      }

      mock_responses_api.expect(:create, mock_response) do |params|
        !params[:parameters].key?(:reasoning) &&
          params[:parameters][:model] == "gpt-4o"
      end

      result = api.execute("Hello")

      assert_equal("Hello from GPT-4o responses API!", result)

      mock_openai_client.verify
      mock_responses_api.verify
    end

    def test_chat_completion_includes_reasoning_effort_only_for_o_series
      # Test that reasoning_effort is included for O series model
      mock_executor = create_mock_executor

      mock_mcp_client = Minitest::Mock.new
      mock_openai_client = Minitest::Mock.new

      api = ClaudeSwarm::OpenAI::ChatCompletion.new(
        openai_client: mock_openai_client,
        mcp_client: mock_mcp_client,
        available_tools: [],
        executor: mock_executor,
        instance_name: "test",
        model: "o3",
        reasoning_effort: "low",
      )

      mock_response = {
        "choices" => [{
          "message" => {
            "role" => "assistant",
            "content" => "O3 response with reasoning",
          },
        }],
      }

      mock_openai_client.expect(:chat, mock_response) do |params|
        params[:parameters][:reasoning_effort] == "low" &&
          params[:parameters][:model] == "o3" &&
          !params[:parameters].key?(:temperature) # Also verify no temperature
      end

      result = api.execute("Test")

      assert_equal("O3 response with reasoning", result)

      mock_openai_client.verify
    end

    def test_responses_api_includes_reasoning_only_for_o_series
      # Test that reasoning is included for O series model
      mock_executor = create_mock_executor

      mock_mcp_client = Minitest::Mock.new
      mock_openai_client = Minitest::Mock.new
      mock_responses_api = Minitest::Mock.new

      mock_openai_client.expect(:responses, mock_responses_api)

      api = ClaudeSwarm::OpenAI::Responses.new(
        openai_client: mock_openai_client,
        mcp_client: mock_mcp_client,
        available_tools: [],
        executor: mock_executor,
        instance_name: "test",
        model: "o1-pro",
        reasoning_effort: "high",
      )

      mock_response = {
        "id" => "resp_123",
        "output" => [{
          "type" => "message",
          "content" => [{
            "type" => "text",
            "text" => "O1-pro response with reasoning",
          }],
        }],
      }

      mock_responses_api.expect(:create, mock_response) do |params|
        params[:parameters][:reasoning] == { effort: "high" } &&
          params[:parameters][:model] == "o1-pro" &&
          !params[:parameters].key?(:temperature) # Also verify no temperature
      end

      result = api.execute("Test")

      assert_equal("O1-pro response with reasoning", result)

      mock_openai_client.verify
      mock_responses_api.verify
    end
  end
end
