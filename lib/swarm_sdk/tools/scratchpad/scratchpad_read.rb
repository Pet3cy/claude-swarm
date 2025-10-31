# frozen_string_literal: true

module SwarmSDK
  module Tools
    module Scratchpad
      # Tool for reading content from scratchpad storage
      #
      # Retrieves content stored by any agent using scratchpad_write.
      # All agents in the swarm share the same scratchpad.
      class ScratchpadRead < RubyLLM::Tool
        define_method(:name) { "ScratchpadRead" }

        description <<~DESC
          Read content from scratchpad.

          ## When to Use ScratchpadRead

          Use ScratchpadRead to:
          - Retrieve previously stored content and outputs
          - Access detailed analysis or results from earlier steps
          - Read messages or notes left by other agents
          - Access cached computed data
          - Retrieve content that was too long for direct responses

          ## Best Practices

          - Any agent can read any scratchpad content
          - Content is returned with line numbers for easy reference
          - Use ScratchpadList first if you don't know what's stored
          - Scratchpad data is temporary and lost when swarm ends
          - For persistent data, use MemoryRead instead

          ## Examples

          - Read status: file_path='status'
          - Read analysis: file_path='api_analysis'
          - Read agent notes: file_path='notes/backend'
        DESC

        param :file_path,
          desc: "Path to read from scratchpad (e.g., 'status', 'result', 'notes/agent_x')",
          required: true

        class << self
          # Create a ScratchpadRead tool for a specific scratchpad storage instance
          #
          # @param scratchpad_storage [Stores::ScratchpadStorage] Shared scratchpad storage instance
          # @return [ScratchpadRead] Tool instance
          def create_for_scratchpad(scratchpad_storage)
            new(scratchpad_storage)
          end
        end

        # Initialize with scratchpad storage instance
        #
        # @param scratchpad_storage [Stores::ScratchpadStorage] Shared scratchpad storage instance
        def initialize(scratchpad_storage)
          super() # Call RubyLLM::Tool's initialize
          @scratchpad_storage = scratchpad_storage
        end

        # Execute the tool
        #
        # @param file_path [String] Path to read from
        # @return [String] Content at the path with line numbers, or error message
        def execute(file_path:)
          content = scratchpad_storage.read(file_path: file_path)
          format_with_line_numbers(content)
        rescue ArgumentError => e
          validation_error(e.message)
        end

        private

        attr_reader :scratchpad_storage

        def validation_error(message)
          "<tool_use_error>InputValidationError: #{message}</tool_use_error>"
        end

        # Format content with line numbers (same format as Read tool)
        #
        # @param content [String] Content to format
        # @return [String] Content with line numbers
        def format_with_line_numbers(content)
          lines = content.lines
          output_lines = lines.each_with_index.map do |line, idx|
            line_number = idx + 1
            display_line = line.chomp
            "#{line_number.to_s.rjust(6)}→#{display_line}"
          end
          output_lines.join("\n")
        end
      end
    end
  end
end
