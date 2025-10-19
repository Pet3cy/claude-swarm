# frozen_string_literal: true

require "test_helper"

module SwarmSDK
  class DefaultToolsTest < Minitest::Test
    def setup
      # Set fake API keys to avoid RubyLLM configuration errors
      @original_anthropic_key = ENV["ANTHROPIC_API_KEY"]
      @original_openai_key = ENV["OPENAI_API_KEY"]
      ENV["ANTHROPIC_API_KEY"] = "test-key-12345"
      ENV["OPENAI_API_KEY"] = "test-key-12345"
      RubyLLM.configure do |config|
        config.anthropic_api_key = "test-key-12345"
        config.openai_api_key = "test-key-12345"
      end
    end

    def teardown
      # Restore original API keys
      if @original_anthropic_key
        ENV["ANTHROPIC_API_KEY"] = @original_anthropic_key
      else
        ENV.delete("ANTHROPIC_API_KEY")
      end

      if @original_openai_key
        ENV["OPENAI_API_KEY"] = @original_openai_key
      else
        ENV.delete("OPENAI_API_KEY")
      end
    end

    def test_default_tools_constant
      expected_tools = [
        :Read,
        :Grep,
        :Glob,
        :TodoWrite,
        :Think,
        :WebFetch,
      ]

      assert_equal(expected_tools, Swarm::DEFAULT_TOOLS)
    end

    def test_scratchpad_tools_constant
      expected_tools = [
        :ScratchpadWrite,
        :ScratchpadRead,
        :ScratchpadList,
      ]

      assert_equal(expected_tools, Swarm::ToolConfigurator::SCRATCHPAD_TOOLS)
    end

    def test_memory_tools_constant
      expected_tools = [
        :MemoryWrite,
        :MemoryRead,
        :MemoryEdit,
        :MemoryMultiEdit,
        :MemoryGlob,
        :MemoryGrep,
        :MemoryDelete,
      ]

      assert_equal(expected_tools, Swarm::ToolConfigurator::MEMORY_TOOLS)
    end

    def test_agent_includes_default_tools_by_default
      # Use non-persistent scratchpad for testing
      test_scratchpad = Tools::Stores::ScratchpadStorage.new
      swarm = Swarm.new(name: "Test Swarm", scratchpad: test_scratchpad)

      swarm.add_agent(create_agent(
        name: :developer,
        description: "Developer agent",
        model: "gpt-5",
        system_prompt: "You are a developer.",
        tools: [:Write], # Explicitly configured tool
      ))

      agent = swarm.agent(:developer)

      # Should have explicitly configured tools
      assert(agent.tools.key?(:Write), "Should have Write")

      # Should have all default tools
      assert(agent.tools.key?(:Read), "Should have default Read")
      assert(agent.tools.key?(:Grep), "Should have default Grep")
      assert(agent.tools.key?(:Glob), "Should have default Glob")
      assert(agent.tools.key?(:TodoWrite), "Should have default TodoWrite")
      assert(agent.tools.key?(:ScratchpadWrite), "Should have default ScratchpadWrite")
      assert(agent.tools.key?(:ScratchpadRead), "Should have default ScratchpadRead")
      assert(agent.tools.key?(:ScratchpadList), "Should have default ScratchpadList")
      assert(agent.tools.key?(:Think), "Should have default Think")
      assert(agent.tools.key?(:WebFetch), "Should have default WebFetch")
    end

    def test_agent_can_exclude_default_tools
      # Use non-persistent scratchpad for testing
      test_scratchpad = Tools::Stores::ScratchpadStorage.new
      swarm = Swarm.new(name: "Test Swarm", scratchpad: test_scratchpad)

      swarm.add_agent(create_agent(
        name: :developer,
        description: "Developer agent",
        model: "gpt-5",
        system_prompt: "You are a developer.",
        tools: [:Write, :Edit],
        disable_default_tools: true, # Disable defaults
      ))

      agent = swarm.agent(:developer)

      # Should have only explicitly configured tools
      assert(agent.tools.key?(:Write), "Should have Write")
      assert(agent.tools.key?(:Edit), "Should have Edit")

      # Should NOT have any default tools
      refute(agent.tools.key?(:Read), "Should NOT have Read")
      refute(agent.tools.key?(:Grep), "Should NOT have Grep")
      refute(agent.tools.key?(:ScratchpadWrite), "Should NOT have ScratchpadWrite")
    end

    def test_agent_with_no_tools_still_gets_defaults
      # Use non-persistent scratchpad for testing
      test_scratchpad = Tools::Stores::ScratchpadStorage.new
      swarm = Swarm.new(name: "Test Swarm", scratchpad: test_scratchpad)

      swarm.add_agent(create_agent(
        name: :developer,
        description: "Developer agent",
        model: "gpt-5",
        system_prompt: "You are a developer.",
        tools: [], # No explicit tools
      ))

      agent = swarm.agent(:developer)

      # Should have all default tools
      assert(agent.tools.key?(:Read), "Should have default Read")
      assert(agent.tools.key?(:Grep), "Should have default Grep")
      assert(agent.tools.key?(:ScratchpadWrite), "Should have default ScratchpadWrite")
    end

    def test_agent_with_no_tools_and_no_defaults_has_nothing
      # Use non-persistent scratchpad for testing
      test_scratchpad = Tools::Stores::ScratchpadStorage.new
      swarm = Swarm.new(name: "Test Swarm", scratchpad: test_scratchpad)

      swarm.add_agent(create_agent(
        name: :developer,
        description: "Developer agent",
        model: "gpt-5",
        system_prompt: "You are a developer.",
        tools: [],
        disable_default_tools: true,
      ))

      agent = swarm.agent(:developer)

      # Should have NO tools
      assert_empty(agent.tools, "Should have no tools")
    end
  end
end
