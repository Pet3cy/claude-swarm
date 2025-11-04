# frozen_string_literal: true

require "test_helper"

module SwarmSDK
  class LogCollectorTest < Minitest::Test
    def setup
      LogCollector.reset!
    end

    def teardown
      LogCollector.reset!
    end

    def test_on_log_registers_callback
      events = []
      LogCollector.on_log { |event| events << event }

      LogCollector.emit(type: "test", data: "value")

      assert_equal(1, events.size)
      assert_equal("test", events.first[:type])
    end

    def test_on_log_registers_multiple_callbacks
      events1 = []
      events2 = []

      LogCollector.on_log { |event| events1 << event }
      LogCollector.on_log { |event| events2 << event }

      LogCollector.emit(type: "test", data: "value")

      assert_equal(1, events1.size)
      assert_equal(1, events2.size)
      assert_equal(events1.first, events2.first)
    end

    def test_emit_with_no_callbacks_does_not_crash
      # Should not raise error when no callbacks registered
      # emit returns the result of Array(@callbacks).each, which is []
      result = LogCollector.emit(type: "test")

      assert_empty(result)
    end

    def test_reset_clears_callbacks
      events = []
      LogCollector.on_log { |event| events << event }

      LogCollector.reset!

      # After reset, should be able to register new callbacks
      LogCollector.on_log { |event| events << event }
      LogCollector.emit(type: "test")

      # Only new callback should be called
      assert_equal(1, events.size)
    end

    def test_callbacks_receive_entry_with_timestamp
      received = nil
      LogCollector.on_log { |event| received = event }

      entry = { type: "test", agent: :backend, data: "value" }
      LogCollector.emit(entry)

      # Should include all original fields
      assert_equal("test", received[:type])
      assert_equal(:backend, received[:agent])
      assert_equal("value", received[:data])

      # Should have auto-added timestamp
      assert(received.key?(:timestamp), "Missing timestamp")
      assert_match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z/, received[:timestamp])
    end

    def test_existing_timestamps_are_preserved
      received = nil
      LogCollector.on_log { |event| received = event }

      custom_timestamp = "2025-01-01T12:00:00Z"
      entry = { type: "test", timestamp: custom_timestamp }
      LogCollector.emit(entry)

      # Should preserve the custom timestamp
      assert_equal(custom_timestamp, received[:timestamp])
    end
  end
end
