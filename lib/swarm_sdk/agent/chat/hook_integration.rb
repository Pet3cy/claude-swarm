# frozen_string_literal: true

module SwarmSDK
  module Agent
    class Chat < RubyLLM::Chat
      # Integrates SwarmSDK's hook system with Agent::Chat
      #
      # Responsibilities:
      # - Setup hook system (registry, executor, agent hooks)
      # - Provide trigger methods for all hook events
      # - Wrap ask() to inject user_prompt hooks
      # - Handle hook results (halt, replace, continue, reprompt)
      #
      # This module is included in Agent::Chat and provides methods for triggering hooks.
      # It overrides ask() to inject user_prompt hooks, but does NOT override
      # handle_tool_calls (that's handled in Agent::Chat with explicit hook calls).
      module HookIntegration
        # Expose hook system components for ContextTracker
        attr_reader :hook_executor, :hook_swarm, :hook_agent_hooks

        # Setup the hook system for this agent chat
        #
        # This must be called after setup_context and before the first ask/complete.
        # It wires up the hook system to trigger at the right times.
        #
        # @param registry [Hooks::Registry] Shared registry for named hooks and swarm defaults
        # @param agent_definition [Agent::Definition] Agent configuration with hooks
        # @param swarm [Swarm, nil] Reference to swarm for context
        # @return [void]
        def setup_hooks(registry:, agent_definition:, swarm: nil)
          @hook_registry = registry
          @hook_swarm = swarm
          @hook_executor = Hooks::Executor.new(registry, logger: RubyLLM.logger)

          # Extract agent hooks based on format
          hooks = agent_definition.hooks || {}

          # Check if hooks are pre-parsed HookDefinition objects (from DSL)
          # or raw YAML hash (to be processed by Hooks::Adapter in pass_5)
          @hook_agent_hooks = if hooks.is_a?(Hash) && hooks.values.all? { |v| v.is_a?(Array) && v.all? { |item| item.is_a?(Hooks::Definition) } }
            # DSL hooks - already parsed, use them
            hooks
          else
            # YAML hooks - raw hash, will be processed in pass_5 by Hooks::Adapter
            # For now, use empty hash (pass_5 will add them later)
            {}
          end
        end

        # Add a hook programmatically at runtime
        #
        # This allows agents to add hooks dynamically, which is useful for
        # implementing adaptive behavior or runtime monitoring.
        #
        # @param event [Symbol] Event type (e.g., :pre_tool_use)
        # @param matcher [String, Regexp, nil] Optional regex pattern for tool names
        # @param priority [Integer] Execution priority (higher = earlier)
        # @param block [Proc] Hook implementation
        def add_hook(event, matcher: nil, priority: 0, &block)
          raise ArgumentError, "Hooks not set up. Call setup_hooks first." unless @hook_executor

          definition = Hooks::Definition.new(
            event: event,
            matcher: matcher,
            priority: priority,
            proc: block,
          )

          @hook_agent_hooks[event] ||= []
          @hook_agent_hooks[event] << definition
          @hook_agent_hooks[event].sort_by! { |cb| -cb.priority }
        end

        # Override ask to trigger user_prompt hooks
        #
        # This wraps the Agent::Chat#ask implementation to inject hooks AFTER
        # system reminders are handled.
        #
        # @param prompt [String] User prompt
        # @param options [Hash] Additional options
        # @return [RubyLLM::Message] LLM response
        def ask(prompt, **options)
          # Trigger user_prompt hook before sending to LLM (can halt or modify prompt)
          if @hook_executor
            hook_result = trigger_user_prompt(prompt)

            # Check if hook halted execution
            if hook_result[:halted]
              # Return a halted message instead of calling LLM
              return RubyLLM::Message.new(
                role: :assistant,
                content: hook_result[:halt_message],
                model_id: model.id,
              )
            end

            # Use modified prompt if hook provided one (stdout injection)
            prompt = hook_result[:modified_prompt] if hook_result[:modified_prompt]
          end

          # Call original ask implementation (Agent::Chat handles system reminders)
          super(prompt, **options)
        end

        # Override check_context_warnings to trigger our hook system
        #
        # This wraps the default context warning behavior to also trigger hooks.
        def check_context_warnings
          return unless respond_to?(:context_usage_percentage)

          current_percentage = context_usage_percentage

          Context::CONTEXT_WARNING_THRESHOLDS.each do |threshold|
            # Only warn once per threshold
            next if @agent_context.warning_threshold_hit?(threshold)
            next if current_percentage < threshold

            # Mark threshold as hit
            @agent_context.hit_warning_threshold?(threshold)

            # Emit existing log event (for backward compatibility)
            LogStream.emit(
              type: "context_limit_warning",
              agent: @agent_context.name,
              model: model.id,
              threshold: "#{threshold}%",
              current_usage: "#{current_percentage}%",
              tokens_used: cumulative_total_tokens,
              tokens_remaining: tokens_remaining,
              context_limit: context_limit,
              metadata: @agent_context.metadata,
            )

            # Trigger hook system
            trigger_context_warning(threshold, current_percentage) if @hook_executor
          end
        end

        # Trigger pre_tool_use hooks
        #
        # Should be called by Agent::Chat before tool execution.
        # Returns a hash indicating whether to proceed and any custom result.
        #
        # @param tool_call [RubyLLM::ToolCall] Tool call from LLM
        # @return [Hash] { proceed: true/false, custom_result: result (if any) }
        def trigger_pre_tool_use(tool_call)
          return { proceed: true } unless @hook_executor

          context = build_hook_context(
            event: :pre_tool_use,
            tool_call: wrap_tool_call_to_hooks(tool_call),
          )

          agent_hooks = @hook_agent_hooks[:pre_tool_use] || []

          result = @hook_executor.execute_safe(
            event: :pre_tool_use,
            context: context,
            callbacks: agent_hooks,
          )

          # Return custom result if hook provides one
          if result.replace?
            { proceed: false, custom_result: result.value }
          elsif result.halt?
            { proceed: false, custom_result: result.value || "Tool execution blocked by hook" }
          elsif result.finish_agent?
            # Finish agent execution immediately with this message
            { proceed: false, finish_agent: true, custom_result: result.value }
          elsif result.finish_swarm?
            # Finish entire swarm execution immediately with this message
            { proceed: false, finish_swarm: true, custom_result: result.value }
          else
            { proceed: true }
          end
        end

        # Trigger post_tool_use hooks
        #
        # Should be called by Agent::Chat after tool execution.
        # Returns modified result if hook replaces it, or a special marker for finish actions.
        #
        # @param result [String, Object] Tool execution result
        # @param tool_call [RubyLLM::ToolCall] Tool call object with full context
        # @return [Object, Hash] Modified result if hook replaces it, hash with :finish_agent or :finish_swarm if finishing, otherwise original result
        def trigger_post_tool_use(result, tool_call:)
          return result unless @hook_executor

          context = build_hook_context(
            event: :post_tool_use,
            tool_result: wrap_tool_result(tool_call.id, tool_call.name, result),
          )

          agent_hooks = @hook_agent_hooks[:post_tool_use] || []

          hook_result = @hook_executor.execute_safe(
            event: :post_tool_use,
            context: context,
            callbacks: agent_hooks,
          )

          # Return modified result or finish markers
          if hook_result.replace?
            hook_result.value
          elsif hook_result.finish_agent?
            { __finish_agent__: true, message: hook_result.value }
          elsif hook_result.finish_swarm?
            { __finish_swarm__: true, message: hook_result.value }
          else
            result
          end
        end

        private

        # Trigger context_warning hooks
        #
        # Hooks have access to the chat instance via metadata[:chat]
        # to access and manipulate the messages array.
        #
        # @param threshold [Integer] Warning threshold percentage
        # @param current_usage [Float] Current usage percentage
        # @return [void]
        def trigger_context_warning(threshold, current_usage)
          return unless @hook_executor

          context = build_hook_context(
            event: :context_warning,
            metadata: {
              chat: self, # Provide access to chat instance (for messages array)
              threshold: threshold,
              percentage: current_usage,
              tokens_used: cumulative_total_tokens,
              tokens_remaining: tokens_remaining,
              context_limit: context_limit,
            },
          )

          agent_hooks = @hook_agent_hooks[:context_warning] || []

          @hook_executor.execute_safe(
            event: :context_warning,
            context: context,
            callbacks: agent_hooks,
          )
        end

        # Trigger user_prompt hooks
        #
        # This fires before sending a user message to the LLM.
        # Can halt execution or append hook stdout to prompt.
        #
        # @param prompt [String] User's message/prompt
        # @return [Hash] { halted: bool, halt_message: String, modified_prompt: String }
        def trigger_user_prompt(prompt)
          return { halted: false, modified_prompt: prompt } unless @hook_executor

          # Filter out delegation tools from tools list
          actual_tools = if respond_to?(:tools) && @agent_context
            tools.keys.reject { |tool_name| @agent_context.delegation_tool?(tool_name.to_s) }
          else
            []
          end

          # Extract agent names from delegation tool names
          delegate_agents = if @agent_context&.delegation_tools
            @agent_context.delegation_tools.map { |tool_name| @context_tracker.extract_delegate_agent_name(tool_name) }
          else
            []
          end

          context = build_hook_context(
            event: :user_prompt,
            metadata: {
              prompt: prompt,
              message_count: messages.size,
              model: model.id,
              provider: model.provider,
              tools: actual_tools,
              delegates_to: delegate_agents,
              timestamp: Time.now.utc.iso8601,
            },
          )

          agent_hooks = @hook_agent_hooks[:user_prompt] || []

          result = @hook_executor.execute_safe(
            event: :user_prompt,
            context: context,
            callbacks: agent_hooks,
          )

          # Handle hook result
          if result.halt?
            # Hook blocked execution
            { halted: true, halt_message: result.value }
          elsif result.replace?
            # Hook provided stdout to append to prompt (exit code 0)
            modified_prompt = "#{prompt}\n\n<hook-context>\n#{result.value}\n</hook-context>"
            { halted: false, modified_prompt: modified_prompt }
          else
            # Normal continue
            { halted: false, modified_prompt: prompt }
          end
        end

        # Build a hook context object
        #
        # @param event [Symbol] Event type
        # @param tool_call [Hooks::ToolCall, nil] Tool call object
        # @param tool_result [Hooks::ToolResult, nil] Tool result object
        # @param metadata [Hash] Additional metadata
        # @return [Hooks::Context] Context object
        def build_hook_context(event:, tool_call: nil, tool_result: nil, metadata: {})
          Hooks::Context.new(
            event: event,
            agent_name: @agent_context&.name || "unknown",
            agent_definition: nil, # Could store this in setup_hooks if needed
            swarm: @hook_swarm,
            tool_call: tool_call,
            tool_result: tool_result,
            metadata: metadata,
          )
        end

        # Wrap a RubyLLM tool call in our Hooks::ToolCall value object
        #
        # @param tool_call [RubyLLM::ToolCall] RubyLLM tool call
        # @return [Hooks::ToolCall] Our wrapped tool call
        def wrap_tool_call_to_hooks(tool_call)
          Hooks::ToolCall.new(
            id: tool_call.id,
            name: tool_call.name,
            parameters: tool_call.arguments,
          )
        end

        # Wrap a tool result in our Hooks::ToolResult value object
        #
        # @param tool_call_id [String] Tool call ID
        # @param tool_name [String] Tool name
        # @param result [Object] Tool execution result
        # @return [Hooks::ToolResult] Our wrapped result
        def wrap_tool_result(tool_call_id, tool_name, result)
          success = !result.is_a?(StandardError)
          error = result.is_a?(StandardError) ? result.message : nil

          Hooks::ToolResult.new(
            tool_call_id: tool_call_id,
            tool_name: tool_name,
            content: success ? result : nil,
            success: success,
            error: error,
          )
        end

        # Check if a tool call is a delegation tool
        #
        # Delegation tools fire their own pre_delegation/post_delegation events
        # and should NOT fire pre_tool_use/post_tool_use events.
        #
        # @param tool_call [RubyLLM::ToolCall] Tool call to check
        # @return [Boolean] true if this is a delegation tool
        def delegation_tool_call?(tool_call)
          return false unless @agent_context

          @agent_context.delegation_tool?(tool_call.name)
        end
      end
    end
  end
end
