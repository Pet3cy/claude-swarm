# frozen_string_literal: true

module SwarmSDK
  module Agent
    class Chat < RubyLLM::Chat
      # Manages context tracking, delegation tracking, and logging callbacks
      #
      # Responsibilities:
      # - Register RubyLLM callbacks for logging
      # - Track tool executions
      # - Track delegations (which tool calls are delegations)
      # - Emit log events via LogStream
      # - Check context warnings
      #
      # This is a stateful helper that's instantiated per Agent::Chat instance.
      class ContextTracker
        include LoggingHelpers

        attr_reader :agent_context

        def initialize(chat, agent_context)
          @chat = chat
          @agent_context = agent_context
          @tool_executions = []
          @finish_reason_override = nil
        end

        # Set a custom finish reason for the next agent_stop event
        #
        # This is used when finish_agent or finish_swarm terminates execution early.
        #
        # @param reason [String] Custom finish reason (e.g., "finish_agent", "finish_swarm")
        attr_writer :finish_reason_override

        # Setup logging callbacks
        #
        # Registers RubyLLM callbacks to collect data and emit log events.
        # Should only be called when LogStream.emitter is set.
        #
        # @return [void]
        def setup_logging
          register_logging_callbacks
        end

        # Extract agent name from delegation tool name
        #
        # Converts "DelegateTaskTo[AgentName]" to "agent_name"
        # Example: "DelegateTaskToWorker" -> "worker"
        #
        # @param tool_name [String] Delegation tool name
        # @return [String] Agent name
        def extract_delegate_agent_name(tool_name)
          # Remove "DelegateTaskTo" prefix and lowercase first letter
          agent_name = tool_name.to_s.sub(/^DelegateTaskTo/, "")
          # Convert from PascalCase to lowercase (e.g., "Worker" -> "worker", "BackendDev" -> "backendDev")
          agent_name[0] = agent_name[0].downcase unless agent_name.empty?
          agent_name
        end

        # Check if context usage has crossed warning thresholds and emit warnings
        #
        # This should be called after each LLM response to check if we've crossed
        # any warning thresholds (80%, 90%, etc.)
        #
        # @return [void]
        def check_context_warnings
          current_percentage = @chat.context_usage_percentage

          Context::CONTEXT_WARNING_THRESHOLDS.each do |threshold|
            # Only warn once per threshold
            next if @agent_context.warning_threshold_hit?(threshold)
            next if current_percentage < threshold

            # Mark threshold as hit and emit warning
            @agent_context.hit_warning_threshold?(threshold)

            LogStream.emit(
              type: "context_limit_warning",
              agent: @agent_context.name,
              model: @chat.model.id,
              threshold: "#{threshold}%",
              current_usage: "#{current_percentage}%",
              tokens_used: @chat.cumulative_total_tokens,
              tokens_remaining: @chat.tokens_remaining,
              context_limit: @chat.context_limit,
              metadata: @agent_context.metadata,
            )
          end
        end

        private

        # Extract usage information from an assistant message
        #
        # @param message [RubyLLM::Message] Assistant message with usage data
        # @return [Hash] Usage information
        def extract_usage_info(message)
          cost_info = calculate_cost(message)
          context_usage = if @chat.respond_to?(:cumulative_input_tokens)
            {
              cumulative_input_tokens: @chat.cumulative_input_tokens,
              cumulative_output_tokens: @chat.cumulative_output_tokens,
              cumulative_total_tokens: @chat.cumulative_total_tokens,
              context_limit: @chat.context_limit,
              tokens_used_percentage: "#{@chat.context_usage_percentage}%",
              tokens_remaining: @chat.tokens_remaining,
            }
          else
            {}
          end

          {
            input_tokens: message.input_tokens,
            output_tokens: message.output_tokens,
            total_tokens: (message.input_tokens || 0) + (message.output_tokens || 0),
            input_cost: cost_info[:input_cost],
            output_cost: cost_info[:output_cost],
            total_cost: cost_info[:total_cost],
          }.merge(context_usage)
        end

        # Register RubyLLM chat callbacks to collect data and trigger logging
        #
        # This sets up low-level RubyLLM callbacks for technical plumbing (tracking state,
        # collecting tool results), then emits log events via LogStream.
        #
        # @return [void]
        def register_logging_callbacks
          # Collect tool execution results (technical plumbing)
          @chat.on_tool_result do |result|
            @tool_executions << {
              result: serialize_result(result),
              completed_at: Time.now.utc.iso8601,
            }
          end

          # Track delegations and emit agent_step/agent_stop events
          @chat.on_end_message do |message|
            next unless message

            case message.role
            when :assistant
              if message.tool_call?
                # Assistant made tool calls - emit agent_step event
                trigger_agent_step(message, tool_executions: @tool_executions) if @chat.hook_executor
                @tool_executions.clear
              elsif @chat.hook_executor
                # Final response (finish_reason: "stop") - fire agent_stop
                trigger_agent_stop(message, tool_executions: @tool_executions)
              end
            when :tool
              # Handle delegation tracking and logging (technical plumbing)
              if @agent_context.delegation?(call_id: message.tool_call_id)
                delegate_from = @agent_context.delegation_target(call_id: message.tool_call_id)

                # Emit delegation result log event
                LogStream.emit(
                  type: "delegation_result",
                  agent: @agent_context.name,
                  delegate_from: delegate_from,
                  tool_call_id: message.tool_call_id,
                  result: serialize_result(message.content),
                  metadata: @agent_context.metadata,
                )

                @agent_context.clear_delegation(call_id: message.tool_call_id)
              end
            end
          end

          # Track delegations when tool calls are made
          @chat.on_tool_call do |tool_call|
            if @agent_context.delegation_tool?(tool_call.name)
              # Extract agent name from tool name (DelegateTaskTo[AgentName] -> agent_name)
              agent_name = extract_delegate_agent_name(tool_call.name)

              @agent_context.track_delegation(call_id: tool_call.id, target: agent_name)

              # Emit delegation log event
              LogStream.emit(
                type: "agent_delegation",
                agent: @agent_context.name,
                tool_call_id: tool_call.id,
                delegate_to: agent_name,
                arguments: tool_call.arguments,
                metadata: @agent_context.metadata,
              )
            end
          end
        end

        # Trigger agent_step callback
        #
        # This fires when the agent makes an intermediate response with tool calls.
        # The agent hasn't finished yet - it's requesting tools to continue processing.
        #
        # @param message [RubyLLM::Message] Assistant message with tool calls
        # @param tool_executions [Array<Hash>] Tool execution results (should be empty for steps)
        # @return [void]
        def trigger_agent_step(message, tool_executions: [])
          return unless @chat.hook_executor

          usage_info = extract_usage_info(message)

          context = Hooks::Context.new(
            event: :agent_step,
            agent_name: @agent_context.name,
            swarm: @chat.hook_swarm,
            metadata: {
              model: message.model_id,
              content: message.content,
              tool_calls: format_tool_calls(message.tool_calls),
              finish_reason: "tool_calls",
              usage: usage_info,
              tool_executions: tool_executions.empty? ? nil : tool_executions,
              timestamp: Time.now.utc.iso8601,
            },
          )

          agent_hooks = @chat.hook_agent_hooks[:agent_step] || []

          @chat.hook_executor.execute_safe(
            event: :agent_step,
            context: context,
            callbacks: agent_hooks,
          )
        end

        # Trigger agent_stop callback
        #
        # This fires when the agent completes with a final response (no more tool calls).
        #
        # @param message [RubyLLM::Message] Assistant message with final content
        # @param tool_executions [Array<Hash>] Tool execution results (if any)
        # @return [void]
        def trigger_agent_stop(message, tool_executions: [])
          return unless @chat.hook_executor

          usage_info = extract_usage_info(message)

          # Use override if set (e.g., "finish_agent"), otherwise default to "stop"
          finish_reason = @finish_reason_override || "stop"
          @finish_reason_override = nil # Clear after use

          context = Hooks::Context.new(
            event: :agent_stop,
            agent_name: @agent_context.name,
            swarm: @chat.hook_swarm,
            metadata: {
              model: message.model_id,
              content: message.content,
              tool_calls: nil, # Final response has no tool calls
              finish_reason: finish_reason,
              usage: usage_info,
              tool_executions: tool_executions.empty? ? nil : tool_executions,
              timestamp: Time.now.utc.iso8601,
            },
          )

          agent_hooks = @chat.hook_agent_hooks[:agent_stop] || []

          @chat.hook_executor.execute_safe(
            event: :agent_stop,
            context: context,
            callbacks: agent_hooks,
          )
        end
      end
    end
  end
end
