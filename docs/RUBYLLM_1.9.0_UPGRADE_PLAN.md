# RubyLLM 1.9.0 Upgrade Plan

**Current**: RubyLLM 1.8.2
**Target**: RubyLLM 1.9.0
**Date**: 2025-11-04
**Risk**: MEDIUM (Custom provider needs code change)
**Time**: 3-4 hours

---

## Executive Summary

**VERIFIED BY**: Testing against actual 1.8.2 codebase + GitHub diff analysis

RubyLLM 1.9.0 adds `tool.params_schema` method for unified tool schema generation. Our custom `OpenAIWithResponses` provider manually builds schemas and **MUST** be updated.

### Critical Change Required

**File**: `lib/swarm_sdk/providers/openai_with_responses.rb:382-404`

```ruby
# CURRENT (1.8.2) - Manually builds schema
def responses_tool_for(tool)
  {
    type: "function",
    name: tool.name,
    description: tool.description,
    parameters: {
      type: "object",
      properties: tool.parameters.transform_values { |param| param_schema(param) },
      required: tool.parameters.select { |_, p| p.required }.keys,
    },
  }
end

def param_schema(param)
  { type: param.type, description: param.description }.compact
end
```

```ruby
# REQUIRED (1.9.0) - Use unified schema API
def responses_tool_for(tool)
  parameters_schema = tool.params_schema || empty_parameters_schema

  {
    type: "function",
    name: tool.name,
    description: tool.description,
    parameters: parameters_schema,
  }
end

def empty_parameters_schema
  {
    "type" => "object",
    "properties" => {},
    "required" => [],
    "additionalProperties" => false,
    "strict" => true,
  }
end
```

**Remove**: `param_schema(param)` method (no longer needed)

### Why This Change

1. **New API**: `tool.params_schema` returns complete JSON Schema hash
2. **Proper formatting**: Includes `strict: true`, `additionalProperties: false`
3. **Type normalization**: Converts `:integer` → `"integer"`, handles arrays with items
4. **Future-proof**: Works with new `params` DSL, supports `with_params` for caching
5. **Consistency**: Matches how all RubyLLM providers generate schemas in 1.9.0

### What's Safe (Verified)

✅ **All 24 tools** - `param` helper unchanged, fully supported
✅ **Parameter validation** - Uses `tool.parameters` (stable API)
✅ **Chat extensions** - `agent/chat.rb`, `chat_extension.rb` compatible
✅ **Message serialization** - Handles new `cached_tokens` fields via `.compact`
✅ **Faraday** - Connection API unchanged
✅ **Media.format_content** - Additive change (Content::Raw support)

---

## Verified Changes from GitHub Diffs

### 1. New `tool.params_schema` Method

**Added in**: `lib/ruby_llm/tool.rb` (1.9.0)

```ruby
def params_schema
  return @params_schema if defined?(@params_schema)

  @params_schema = begin
    definition = self.class.params_schema_definition
    if definition&.present?
      definition.json_schema  # From new params DSL
    elsif parameters.any?
      SchemaDefinition.from_parameters(parameters)&.json_schema  # From param helper
    end
  end
end
```

**Returns**: Complete JSON Schema hash (memoized)
**Works with**: Both old `param` helper and new `params` DSL

### 2. SchemaDefinition.from_parameters

**Added in**: `lib/ruby_llm/tool.rb:117-154` (1.9.0)

Converts old-style `param` declarations to proper JSON Schema:

```ruby
def self.from_parameters(parameters)
  properties = parameters.to_h do |name, param|
    schema = {
      type: map_type(param.type),  # Normalizes types
      description: param.description
    }.compact

    schema[:items] = { type: 'string' } if schema[:type] == 'array'

    [name.to_s, schema]  # STRING keys (not symbols)
  end

  required = parameters.select { |_, param| param.required }.keys.map(&:to_s)

  {
    type: 'object',
    properties: properties,
    required: required,
    additionalProperties: false,  # NEW
    strict: true                   # NEW
  }
end
```

**Type mapping**:
- `:integer` / `:int` → `"integer"`
- `:number` / `:float` / `:double` → `"number"`
- `:boolean` → `"boolean"`
- `:array` → `"array"` (with `items: {type: "string"}`)
- everything else → `"string"`

### 3. Official Provider Changes

**File**: `lib/ruby_llm/providers/openai/tools.rb`

```ruby
# OLD (1.8.2)
def tool_for(tool)
  {
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: {
        type: 'object',
        properties: tool.parameters.transform_values { |param| param_schema(param) },
        required: tool.parameters.select { |_, p| p.required }.keys
      }
    }
  }
end

# NEW (1.9.0)
def tool_for(tool)
  parameters_schema = parameters_schema_for(tool)

  definition = {
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: parameters_schema
    }
  }

  return definition if tool.provider_params.empty?
  RubyLLM::Utils.deep_merge(definition, tool.provider_params)
end

def parameters_schema_for(tool)
  tool.params_schema || schema_from_parameters(tool.parameters)
end
```

**Same pattern in**: Anthropic, Gemini, all providers

### 4. Cached Token Fields

**File**: `lib/ruby_llm/message.rb`

```ruby
# NEW attributes
attr_reader :cached_tokens, :cache_creation_tokens

# Added to initialize
@cached_tokens = options[:cached_tokens]
@cache_creation_tokens = options[:cache_creation_tokens]

# Added to to_h
def to_h
  {
    # ...existing fields...
    cached_tokens: cached_tokens,
    cache_creation_tokens: cache_creation_tokens
  }.compact  # Removes nil values
end
```

**Usage**: OpenAI reports cached tokens automatically (prompts >1024 tokens), Anthropic/Bedrock expose cache control

### 5. Content::Raw Support

**File**: `lib/ruby_llm/content.rb`

```ruby
class Content::Raw
  attr_reader :value

  def initialize(value)
    raise ArgumentError, 'Raw content payload cannot be nil' if value.nil?
    @value = value
  end
end
```

**File**: `lib/ruby_llm/providers/openai/media.rb`

```ruby
def format_content(content)
  return content.value if content.is_a?(RubyLLM::Content::Raw)  # NEW
  # ...existing code...
end
```

**Impact**: Additive only - doesn't affect our code unless we use Content::Raw

---

## Upgrade Steps

### Phase 1: Update OpenAIWithResponses (1 hour)

#### Step 1.1: Update tool schema method

**File**: `lib/swarm_sdk/providers/openai_with_responses.rb`

**Replace lines 382-404**:

```ruby
# Convert tool to Responses API format (flat structure)
#
# Responses API uses a flat format with type at top level:
# { type: "function", name: "...", description: "...", parameters: {...} }
#
# @param tool [RubyLLM::Tool] Tool to convert
# @return [Hash] Tool definition in Responses API format
def responses_tool_for(tool)
  # Use tool.params_schema for unified schema generation
  # This returns a complete JSON Schema hash that works with both
  # old param helper and new params DSL
  parameters_schema = tool.params_schema || empty_parameters_schema

  {
    type: "function",
    name: tool.name,
    description: tool.description,
    parameters: parameters_schema,
  }
end

# Empty parameter schema for tools with no parameters
#
# @return [Hash] Empty JSON Schema matching OpenAI's format
def empty_parameters_schema
  {
    "type" => "object",
    "properties" => {},
    "required" => [],
    "additionalProperties" => false,
    "strict" => true,
  }
end
```

**Delete lines 395-404** (old `param_schema` method)

#### Step 1.2: Quick verification

```bash
# Check syntax
ruby -c lib/swarm_sdk/providers/openai_with_responses.rb

# Verify method exists
grep -A5 "def responses_tool_for" lib/swarm_sdk/providers/openai_with_responses.rb
grep "def param_schema" lib/swarm_sdk/providers/openai_with_responses.rb  # Should be empty
```

### Phase 2: Update Dependencies (5 min)

```bash
# Update gemspec
# In swarm-sdk.gemspec:
spec.add_dependency "ruby_llm", "~> 1.9.0"

# Update bundle
bundle update ruby_llm

# Verify
bundle list | grep ruby_llm
# Expected: ruby_llm (1.9.0)
```

### Phase 3: Testing (2-3 hours)

#### Step 3.1: Verify params_schema exists

```ruby
# Test in console
require "swarm_sdk"

class TestTool < RubyLLM::Tool
  description "Test"
  param :name, desc: "Name", required: true

  def execute(name:)
    "Hello"
  end
end

tool = TestTool.new

# Should work now (didn't exist in 1.8.2)
puts tool.params_schema
# Expected: Hash with type, properties, required, additionalProperties, strict

# Verify structure
schema = tool.params_schema
raise unless schema["type"] == "object"
raise unless schema["properties"]["name"]["type"] == "string"
raise unless schema["required"] == ["name"]
raise unless schema["additionalProperties"] == false
raise unless schema["strict"] == true

puts "✓ params_schema works correctly"
```

#### Step 3.2: Test all 24 tools

```ruby
# Create comprehensive tool test
cat > test_tools_schema.rb <<'RUBY'
require "swarm_sdk"
require "swarm_memory"

tools = [
  # SwarmSDK (12 tools)
  SwarmSDK::Tools::Read,
  SwarmSDK::Tools::Write,
  SwarmSDK::Tools::Edit,
  SwarmSDK::Tools::MultiEdit,
  SwarmSDK::Tools::Bash,
  SwarmSDK::Tools::Glob,
  SwarmSDK::Tools::Grep,
  SwarmSDK::Tools::WebFetch,
  SwarmSDK::Tools::Think,
  SwarmSDK::Tools::TodoWrite,
  SwarmSDK::Tools::Clock,
  SwarmSDK::Tools::Delegate,
  # Scratchpad (3 tools)
  SwarmSDK::Tools::Scratchpad::ScratchpadWrite,
  SwarmSDK::Tools::Scratchpad::ScratchpadRead,
  SwarmSDK::Tools::Scratchpad::ScratchpadList,
  # SwarmMemory (9 tools)
  SwarmMemory::Tools::MemoryWrite,
  SwarmMemory::Tools::MemoryRead,
  SwarmMemory::Tools::MemoryEdit,
  SwarmMemory::Tools::MemoryMultiEdit,
  SwarmMemory::Tools::MemoryDelete,
  SwarmMemory::Tools::MemoryGlob,
  SwarmMemory::Tools::MemoryGrep,
  SwarmMemory::Tools::MemoryDefrag,
  SwarmMemory::Tools::LoadSkill,
]

puts "Testing #{tools.size} tools..."

tools.each do |tool_class|
  tool = tool_class.new rescue tool_class.new(storage: nil, agent_name: :test)
  schema = tool.params_schema

  if schema && schema["type"] == "object"
    props = schema["properties"]&.keys || []
    puts "✓ #{tool.name.ljust(20)} #{props.size} params"
  else
    puts "✗ #{tool.name.ljust(20)} INVALID SCHEMA"
    exit 1
  end
end

puts "\n✓ All #{tools.size} tools generate valid schemas"
RUBY

bundle exec ruby test_tools_schema.rb
rm test_tools_schema.rb
```

#### Step 3.3: Test Responses API

```ruby
# Test with actual API endpoint
require "swarm_sdk"

config = SwarmSDK::Configuration.new(
  version: 2,
  agents: {
    test: {
      description: "Test agent",
      model: "gpt-5-mini",
      provider: "openai",
      api_version: "v1/responses",
      base_url: ENV["OPENAI_API_BASE"],
      system_prompt: "You are helpful. Use tools when needed."
    }
  }
)

swarm = SwarmSDK::Swarm.new(config)
agent = swarm.agents[:test]

# Test tool calling
response = agent.ask("Use the Think tool to plan: what is 2+2?")
puts response.content

# Verify tool was called
if agent.messages.any? { |m| m.role == :tool }
  puts "✓ Responses API tool calling works"
else
  puts "✗ Tool not called"
  exit 1
end
```

#### Step 3.4: Test Chat/Completions API

```ruby
# Same test without api_version (defaults to chat/completions)
config = SwarmSDK::Configuration.new(
  version: 2,
  agents: {
    test: {
      description: "Test agent",
      model: "gpt-4o-mini",
      system_prompt: "You are helpful. Use tools."
    }
  }
)

swarm = SwarmSDK::Swarm.new(config)
agent = swarm.agents[:test]

response = agent.ask("Use Think to plan: what's 5+5?")
puts response.content

if agent.messages.any? { |m| m.role == :tool }
  puts "✓ Chat/completions API tool calling works"
else
  puts "✗ Tool not called"
  exit 1
end
```

#### Step 3.5: Run test suites

```bash
# Unit tests
bundle exec rake test

# Specific tests
bundle exec rake swarm_sdk:test
bundle exec rake swarm_memory:test

# Check for any failures
echo "Exit code: $?"
```

#### Step 3.6: Integration tests

```bash
# Test delegation
cd examples/
bundle exec ruby delegation_example.rb

# Test memory
bundle exec ruby memory_example.rb

# Full swarm
bundle exec ruby basic_swarm.rb
```

### Phase 4: Optional Enhancements (1 hour)

#### Add cached token tracking

**File**: `lib/swarm_sdk/agent/chat/context_tracker.rb`

```ruby
def emit_agent_stop_event(response)
  LogStream.emit(
    type: "agent_stop",
    agent: @agent_name,
    swarm_id: @context.swarm_id,
    parent_swarm_id: @context.parent_swarm_id,
    finish_reason: finish_reason,
    input_tokens: response.input_tokens,
    output_tokens: response.output_tokens,
    cached_tokens: response.cached_tokens,           # NEW
    cache_creation_tokens: response.cache_creation_tokens, # NEW
    timestamp: Time.now.utc.iso8601,
  )
end
```

**File**: `lib/swarm_sdk/agent/chat.rb`

```ruby
# Add after cumulative_output_tokens

# Calculate cumulative cached tokens
#
# @return [Integer] Total cached tokens across conversation
def cumulative_cached_tokens
  messages.select { |msg| msg.role == :assistant }.sum { |msg| msg.cached_tokens || 0 }
end

# Calculate cumulative cache creation tokens
#
# @return [Integer] Total tokens written to cache
def cumulative_cache_creation_tokens
  messages.select { |msg| msg.role == :assistant }.sum { |msg| msg.cache_creation_tokens || 0 }
end

# Calculate effective input tokens (excluding cache hits)
#
# @return [Integer] Actual tokens charged
def effective_input_tokens
  cumulative_input_tokens - cumulative_cached_tokens
end
```

### Phase 5: Commit (30 min)

```bash
git add -A
git commit -m "Upgrade RubyLLM from 1.8.2 to 1.9.0

Update OpenAIWithResponses provider to use new tool schema API.

Changes:
- Update responses_tool_for() to use tool.params_schema
- Remove manual param_schema() method
- Add empty_parameters_schema() helper
- Add cached token tracking to logs (optional)
- Add cost calculation helpers (optional)

RubyLLM 1.9.0 changes:
- New tool.params_schema method returns complete JSON Schema
- Supports both old param helper and new params DSL
- Cached token tracking (cached_tokens, cache_creation_tokens)
- Content::Raw for Anthropic prompt caching
- Better Gemini support

Testing:
- All tests pass
- All 24 tools generate valid schemas
- Responses API verified
- Chat/completions API verified
- Delegation tested
- Memory tested

Refs: docs/RUBYLLM_1.9.0_CHANGES.md"
```

---

## Testing Checklist

### Critical

- [ ] `tool.params_schema` exists and returns Hash
- [ ] OpenAIWithResponses generates valid schemas
- [ ] All 24 tools pass schema generation
- [ ] Responses API works with tools
- [ ] Chat/completions API works with tools
- [ ] Parameter validation works
- [ ] Message serialization preserves data
- [ ] Delegation functions
- [ ] Memory tools work
- [ ] All test suites pass

### Optional

- [ ] Cached tokens in logs
- [ ] Cost tracking updated
- [ ] Documentation updated

---

## Params DSL (Optional Future)

**Current** (simple, proven):
```ruby
class Weather < RubyLLM::Tool
  description "Gets weather"
  param :city, desc: "City", required: true
  param :units, desc: "Units", required: false

  def execute(city:, units: "metric")
    # ...
  end
end
```

**New DSL** (for complex schemas):
```ruby
class ComplexTool < RubyLLM::Tool
  description "Complex schema example"

  params do
    object :location, description: "Location data" do
      number :lat, description: "Latitude"
      number :lon, description: "Longitude"
    end

    array :tags, of: :string, description: "Tags"

    any_of :format, description: "Format" do
      string enum: %w[json xml]
      null
    end
  end

  def execute(location:, tags: [], format: nil)
    # ...
  end
end
```

**When to use new DSL**:
- Nested objects
- Arrays of objects
- Enums/unions
- Complex validation

**When to keep `param` helper**:
- Flat parameters (all our current tools)
- Simple types
- Working fine as-is

**Recommendation**: Keep using `param` helper. It's simpler, proven, fully supported. Only consider `params` DSL when you actually need complex schemas.

---

## Key Takeaways

1. ⚠️ **MUST UPDATE**: OpenAIWithResponses provider (use `tool.params_schema`)
2. ✅ **ALL SAFE**: 24 tools using `param` helper (no changes needed)
3. ✅ **STABLE**: `tool.parameters` API unchanged (validation code safe)
4. ✅ **COMPATIBLE**: Chat extensions, message serialization
5. 💡 **OPTIONAL**: Add cached token tracking for cost visibility
6. 💡 **FUTURE**: Consider `params` DSL only for complex schemas

---

## Timeline

**Total**: 3-4 hours

1. Phase 1: Update provider (1 hour)
2. Phase 2: Dependencies (5 min)
3. Phase 3: Testing (2-3 hours)
4. Phase 4: Optional enhancements (1 hour, skip if tight on time)
5. Phase 5: Commit (30 min)

**Recommended**: Do Phases 1-3, 5. Skip Phase 4 enhancements for now.

---

## References

- [RubyLLM 1.9.0 Release](https://github.com/crmne/ruby_llm/releases/tag/1.9.0)
- [Changes Analysis](docs/RUBYLLM_1.9.0_CHANGES.md)
- [Tool.rb Diff](https://github.com/crmne/ruby_llm/compare/1.8.2...1.9.0)
