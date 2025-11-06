# frozen_string_literal: true

require "test_helper"

module SwarmSDK
  class LogStreamTest < Minitest::Test
    # Mock emitter for testing
    class MockEmitter
      attr_reader :events

      def initialize
        @events = []
      end

      def emit(entry)
        @events << entry
      end
    end

    def setup
      LogStream.reset!
    end

    def teardown
      LogStream.reset!
    end

    def test_emit_with_no_emitter_does_not_crash
      # Should not raise error when no emitter configured
      assert_nil(LogStream.emit(type: "test", data: "value"))
    end

    def test_emit_with_emitter_forwards_event
      emitter = MockEmitter.new

      LogStream.emitter = emitter
      LogStream.emit(type: "test", agent: :backend, data: "value")

      assert_equal(1, emitter.events.size)
      event = emitter.events.first

      assert_equal("test", event[:type])
      assert_equal(:backend, event[:agent])
      assert_equal("value", event[:data])
    end

    def test_emit_adds_timestamp
      emitter = MockEmitter.new

      LogStream.emitter = emitter

      Time.now.utc.iso8601
      LogStream.emit(type: "test")
      Time.now.utc.iso8601

      event = emitter.events.first

      assert(event.key?(:timestamp))
      assert_instance_of(String, event[:timestamp])

      # Timestamp should be in ISO8601 format
      assert_match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/, event[:timestamp])
    end

    def test_emit_compacts_nil_values
      emitter = MockEmitter.new

      LogStream.emitter = emitter
      LogStream.emit(type: "test", data: "value", empty: nil)

      event = emitter.events.first

      refute(event.key?(:empty), "Expected nil values to be removed")
      assert(event.key?(:data))
    end

    def test_reset_clears_emitter
      LogStream.emitter = Object.new

      assert_predicate(LogStream, :enabled?)

      LogStream.reset!

      refute_predicate(LogStream, :enabled?)
    end

    def test_enabled_returns_true_when_emitter_set
      refute_predicate(LogStream, :enabled?)

      LogStream.emitter = Object.new

      assert_predicate(LogStream, :enabled?)
    end

    def test_enabled_returns_false_when_no_emitter
      LogStream.reset!

      refute_predicate(LogStream, :enabled?)
    end

    def test_emitter_accessor_allows_reading
      emitter = Object.new
      LogStream.emitter = emitter

      assert_same(emitter, LogStream.emitter)
    end

    # Test thread safety: simulates concurrent requests in Puma
    # Each thread should have its own isolated emitter (no cross-thread contamination)
    def test_concurrent_threads_have_isolated_emitters
      thread_count = 5
      events_per_thread = 10

      # Create separate emitters for each thread
      emitters = thread_count.times.map { MockEmitter.new }

      # Simulate concurrent requests (like Puma thread pool)
      threads = thread_count.times.map do |i|
        Thread.new do
          # Each thread sets its own emitter (simulating swarm.execute with block)
          LogStream.emitter = emitters[i]

          # Verify emitter is correctly set for this thread
          assert_same(
            emitters[i],
            LogStream.emitter,
            "Thread #{i} should have its own emitter",
          )

          # Emit multiple events
          events_per_thread.times do |j|
            LogStream.emit(
              type: "test_event",
              thread_id: i,
              event_number: j,
              message: "Thread #{i}, Event #{j}",
            )

            # Small random sleep to increase chance of interleaving
            sleep(rand * 0.01)
          end

          # Cleanup (simulating swarm.execute ensure block)
          LogStream.reset!
        end
      end

      # Wait for all threads to complete
      threads.each(&:join)

      # After threads complete, verify each emitter received exactly its own events
      thread_count.times do |i|
        emitter = emitters[i]

        assert_equal(
          events_per_thread,
          emitter.events.size,
          "Thread #{i}'s emitter should have received exactly #{events_per_thread} events",
        )

        # Verify all events belong to this thread
        emitter.events.each_with_index do |event, j|
          assert_equal(
            i,
            event[:thread_id],
            "Event #{j} in thread #{i}'s emitter should have thread_id=#{i}",
          )
          assert_equal(
            j,
            event[:event_number],
            "Event #{j} in thread #{i}'s emitter should have event_number=#{j}",
          )
        end

        # Verify no cross-thread contamination
        # (emitter should only have events from its own thread)
        thread_ids = emitter.events.map { |e| e[:thread_id] }.uniq

        assert_equal(
          [i],
          thread_ids,
          "Emitter #{i} should only have events from thread #{i}, but had: #{thread_ids}",
        )
      end
    end

    # Test that child fibers inherit parent's emitter
    def test_child_fibers_inherit_emitter
      emitter = MockEmitter.new
      LogStream.emitter = emitter

      # Emit from parent fiber
      LogStream.emit(type: "parent_event", source: "parent")

      # Create child fiber and emit
      Async do
        # Child fiber should inherit parent's emitter
        assert_same(
          emitter,
          LogStream.emitter,
          "Child fiber should inherit parent's emitter",
        )

        LogStream.emit(type: "child_event", source: "child")
      end.wait

      # Both events should be in the same emitter
      assert_equal(2, emitter.events.size)
      assert_equal("parent", emitter.events[0][:source])
      assert_equal("child", emitter.events[1][:source])
    end
  end
end
