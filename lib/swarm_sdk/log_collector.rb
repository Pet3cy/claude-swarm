# frozen_string_literal: true

module SwarmSDK
  # LogCollector manages subscriber callbacks for log events.
  #
  # This module acts as an emitter implementation that forwards events
  # to user-registered callbacks. It's designed to be set as the LogStream
  # emitter during swarm execution.
  #
  # ## Thread Safety for Multi-Threaded Environments (Puma, Sidekiq)
  #
  # Callbacks are stored in Fiber-local storage (Fiber[:log_callbacks]) instead
  # of class instance variables. This ensures callbacks registered in the parent
  # thread/fiber are accessible to child fibers created by Async reactor.
  #
  # Why: In Puma/Sidekiq, class instance variables (@callbacks) are thread-isolated
  # and don't properly propagate to child fibers. Using Fiber-local storage ensures
  # events emitted from within Async blocks can reach registered callbacks.
  #
  # Child fibers inherit parent fiber-local storage automatically, so events
  # emitted from agent callbacks (on_tool_call, on_end_message, etc.) executing
  # in child fibers can still reach the parent's registered callbacks.
  #
  # ## Usage
  #
  #   # Register a callback (before execution starts)
  #   LogCollector.on_log do |event|
  #     puts JSON.generate(event)
  #   end
  #
  #   # During execution, LogStream calls emit
  #   LogCollector.emit(type: "user_prompt", agent: :backend)
  #
  #   # After execution, reset for next use
  #   LogCollector.reset!
  #
  module LogCollector
    class << self
      # Register a callback to receive log events
      #
      # Stores callback in Fiber-local storage to ensure accessibility
      # from child fibers in multi-threaded environments.
      #
      # @yield [Hash] Log event entry
      def on_log(&block)
        Fiber[:log_callbacks] ||= []
        Fiber[:log_callbacks] << block
      end

      # Emit an event to all registered callbacks
      #
      # Automatically adds a timestamp if one doesn't exist.
      # Reads callbacks from Fiber-local storage to support multi-threaded execution.
      #
      # @param entry [Hash] Log event entry
      # @return [void]
      def emit(entry)
        # Ensure timestamp exists (LogStream adds it, but direct calls might not)
        entry_with_timestamp = entry.key?(:timestamp) ? entry : entry.merge(timestamp: Time.now.utc.iso8601)

        # Read callbacks from Fiber-local storage (set by on_log in parent fiber)
        callbacks = Fiber[:log_callbacks] || []
        callbacks.each do |callback|
          callback.call(entry_with_timestamp)
        end
      end

      # Reset the collector (clears callbacks for next execution)
      #
      # @return [void]
      def reset!
        Fiber[:log_callbacks] = []
      end
    end
  end
end
