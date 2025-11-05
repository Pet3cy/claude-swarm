# RubyLLM 1.9.0 Changes Analysis

**Comparison**: 1.8.2 → 1.9.0
**Release Date**: November 3, 2025
**Files Changed**: 300

## Executive Summary

RubyLLM 1.9.0 is a major feature release focused on:
1. **Tool Schema Improvements**: New `params` DSL powered by `RubyLLM::Schema` for full JSON Schema support
2. **Anthropic Prompt Caching**: Raw content blocks and caching helpers for cost optimization
3. **Audio Transcription**: New `RubyLLM.transcribe` method with diarization support
4. **Cached Token Tracking**: New fields to track cache hits and cache creation
5. **Gemini Improvements**: Better structured output, parallel tool calls, and image generation support
6. **Configurable Model Registry**: Save model registry to custom file paths

---

## Major Features

### 1. JSON Schema Tool Parameters (`params` DSL)

**New Feature**: Full JSON Schema support for tool parameter definitions using a Ruby DSL.

```ruby
class Scheduler < RubyLLM::Tool
  description "Books a meeting"

  params do
    object :window, description: "Time window to reserve" do
      string :start, description: "ISO8601 start"
      string :finish, description: "ISO8601 finish"
    end

    array :participants, of: :string, description: "Email invitees"

    any_of :format, description: "Optional meeting format" do
      string enum: %w[virtual in_person]
      null
    end
  end

  def execute(window:, participants:, format: nil)
    # implementation
  end
end
```

**Key Points**:
- Powered by `RubyLLM::Schema` gem (bundled)
- Supports nested objects, arrays, enums, nullable fields
- Handles provider-specific quirks (Anthropic/Gemini)
- Old `param` helper still supported for backwards compatibility
- Can pass raw JSON Schema via `params schema: { ... }`

**Migration Path**: Optional upgrade - existing `param` declarations continue to work.

---

### 2. Raw Content Blocks & Anthropic Prompt Caching

**New Feature**: `RubyLLM::Content::Raw` allows passing provider-native payloads.

```ruby
# Generic raw content
raw_block = RubyLLM::Content::Raw.new([
  { type: 'text', text: 'Reusable prompt', cache_control: { type: 'ephemeral' } },
  { type: 'text', text: "Today's request" }
])

chat = RubyLLM.chat
chat.ask(raw_block)

# Anthropic-specific helper
system_block = RubyLLM::Providers::Anthropic::Content.new(
  "You are a release-notes assistant.",
  cache: true # shorthand for cache_control: { type: 'ephemeral' }
)

chat.add_message(role: :system, content: system_block)
```

**Key Points**:
- Bypasses RubyLLM's message formatting
- Provider-specific payloads sent verbatim
- Useful for Anthropic prompt caching
- Works with `Chat#ask`, `Chat#add_message`, tool results, streaming
- Anthropic helper: `RubyLLM::Providers::Anthropic::Content`

**New Tool Feature**: `with_params` for tool-level provider parameters

```ruby
class ChangelogTool < RubyLLM::Tool
  description "Formats commits"

  params do
    array :commits, of: :string
  end

  with_params cache_control: { type: 'ephemeral' }

  def execute(commits:)
    # implementation
  end
end
```

---

### 3. Cached Token Tracking

**New Fields** on `RubyLLM::Message`:
- `cached_tokens`: Tokens served from provider's prompt cache
- `cache_creation_tokens`: Tokens written to cache (Anthropic/Bedrock)

```ruby
response = chat.ask "Explain Ruby GIL"

puts "Input Tokens: #{response.input_tokens}"
puts "Output Tokens: #{response.output_tokens}"
puts "Cached Prompt Tokens: #{response.cached_tokens}"        # NEW in 1.9
puts "Cache Creation Tokens: #{response.cache_creation_tokens}" # NEW in 1.9
```

**Key Points**:
- OpenAI automatically reports cache hits for prompts over 1024 tokens
- Anthropic/Bedrock expose both cache hits and cache writes
- Fields are `nil` when provider doesn't send cache data
- Critical for accurate cost tracking with prompt caching

**Rails Migration**: Run `rails generate ruby_llm:upgrade_to_v1_9` to add columns:
- `cached_tokens` column
- `cache_creation_tokens` column
- `content_raw` column (for raw content blocks)

---

### 4. Audio Transcription

**New Method**: `RubyLLM.transcribe` for audio-to-text conversion.

```ruby
# Basic transcription
transcription = RubyLLM.transcribe("meeting.wav")
puts transcription.text
puts transcription.model
puts transcription.duration

# With diarization (speaker identification)
transcription = RubyLLM.transcribe(
  "all-hands.m4a",
  model: "gpt-4o-transcribe-diarize",
  language: "en",
  prompt: "Focus on action items."
)

transcription.segments.each do |segment|
  puts "#{segment['speaker']}: #{segment['text']}"
  puts "  (#{segment['start']}s - #{segment['end']}s)"
end

# With speaker names
transcription = RubyLLM.transcribe(
  "team-meeting.wav",
  model: "gpt-4o-transcribe-diarize",
  speaker_names: ["Alice", "Bob"],
  speaker_references: ["alice-voice.wav", "bob-voice.wav"]
)
```

**Supported Models**:
- OpenAI: `whisper-1`, `gpt-4o-transcribe`, `gpt-4o-mini-transcribe`, `gpt-4o-transcribe-diarize`
- Google: `gemini-2.5-flash`, `gemini-2.5-pro`
- Vertex AI support

**Key Points**:
- Supports MP3, M4A, WAV, WebM, OGG
- Language hints via ISO 639-1 codes (en, es, fr, de, etc.)
- Speaker diarization with optional name mapping
- Segments with timestamps
- Token counting support
- Configure default: `config.default_transcription_model`

**Gemini Notes**:
- Returns plain text without segment metadata
- Use OpenAI models when you need speaker labels/timestamps

---

### 5. Gemini Improvements

**Structured Output**:
- Gemini 2.5 now uses `responseJsonSchema` for better structured output
- Fixed nullable/anyOf translations
- Better handling of complex schemas

**Parallel Tool Calls**:
- Fixed: Now returns single message with correct role
- Improved accuracy in tool usage and responses

**Image Generation** (Gemini 2.5 Flash Image / "Nano Banana"):
```ruby
chat = RubyLLM.chat(model: "gemini-2.5-flash-image")
reply = chat.ask("Sketch a Nano Banana wearing aviators.")
image = reply.content.attachments.first
File.binwrite("nano-banana.png", image.read)
```

**API Base Configuration**:
```ruby
RubyLLM.configure do |config|
  config.gemini_api_base = ENV.fetch('GEMINI_API_BASE', nil)
end
```

---

### 6. Configurable Model Registry File Path

**New Feature**: Save model registry to custom locations (useful for read-only filesystems).

```ruby
# Save to custom location
RubyLLM.models.save_to_json("/var/app/models.json")

# Configure registry file path
RubyLLM.configure do |config|
  config.model_registry_file = "/var/app/models.json"
end

# Note: refresh! only updates in-memory registry
RubyLLM.models.refresh!
RubyLLM.models.save_to_json  # Persist to disk
```

**Key Points**:
- Default location: gem directory (may be read-only in production)
- Configure writable path for deployments
- `refresh!` updates in-memory only
- Must call `save_to_json` to persist
- Works with ActiveRecord integration

---

## Breaking Changes

### ⚠️ Rails Configuration Timing

**Issue**: Setting `use_new_acts_as = true` in initializers won't work.

**Symptoms**:
- Legacy `acts_as` module gets included even with `use_new_acts_as = true`
- `undefined local variable or method 'acts_as_model'` errors
- Errors referencing `lib/ruby_llm/active_record/acts_as_legacy.rb`
- Works in dev/staging but fails in production

**Solution**: Move configuration to `config/application.rb` **before** Application class:

```ruby
# config/application.rb
require_relative "boot"

require "rails/all"

# Configure RubyLLM before Application loads
RubyLLM.configure do |config|
  config.use_new_acts_as = true
end

module YourApp
  class Application < Rails::Application
    # ...
  end
end
```

This ensures RubyLLM is configured before ActiveRecord loads models. Other config (API keys, timeouts) can stay in initializers.

**Note**: This limitation exists because both legacy and new `acts_as` APIs coexist in 1.x. Will be resolved in RubyLLM 2.0.

---

## New Database Columns (Rails)

Run `rails generate ruby_llm:upgrade_to_v1_9` to add:

1. **`cached_tokens`**: Tracks accessed cached tokens
2. **`cache_creation_tokens`**: Tracks created cache tokens
3. **`content_raw`**: Stores raw content blocks

**Migration Example**:
```bash
rails generate ruby_llm:upgrade_to_v1_9
rails db:migrate
```

---

## API Changes Summary

### New Classes/Modules
- `RubyLLM::Content::Raw` - For provider-native payloads
- `RubyLLM::Providers::Anthropic::Content` - Anthropic caching helper
- `RubyLLM::Schema` - JSON Schema DSL (bundled gem)

### New Methods
- `RubyLLM.transcribe(file, **options)` - Audio transcription
- `RubyLLM::Tool.with_params(**params)` - Tool-level provider params
- `RubyLLM::Tool.params(schema: nil, &block)` - New schema DSL
- `RubyLLM.models.save_to_json(path = nil)` - Save registry to file

### New Message Attributes
- `RubyLLM::Message#cached_tokens` - Cache hit tokens
- `RubyLLM::Message#cache_creation_tokens` - Cache write tokens

### New Configuration Options
- `config.default_transcription_model` - Default model for transcription
- `config.model_registry_file` - Custom model registry path
- `config.gemini_api_base` - Custom Gemini API endpoint

### New Transcription Response
- `RubyLLM::Transcription` object with:
  - `.text` - Full transcript
  - `.model` - Model used
  - `.duration` - Audio duration
  - `.segments` - Array of segments (text, speaker, start, end)
  - `.input_tokens`, `.output_tokens` - Token usage
  - `.cached_tokens` - Cached token usage

---

## Testing Changes

### New Test Support
- Rails 8.1 support added
- JRuby 10.0.2.0 support
- Updated appraisal gemfiles

### Test Files
- 300 files changed total
- Major test coverage for:
  - Transcription functionality
  - Raw content blocks
  - Tool schema DSL
  - Gemini improvements

---

## Documentation Changes

### New Guides
- Audio Transcription guide (`docs/_core_features/audio-transcription.md`)
- Raw Content Blocks section in Chat guide
- Tool Schema DSL documentation
- Anthropic Prompt Caching guide

### Updated Guides
- Upgrading guide renamed to generic "Upgrading" (covers 1.7 and 1.9)
- Configuration guide (timing issues)
- Rails integration guide (raw payloads)
- Tools guide (new params DSL)
- Chat guide (cached tokens, raw blocks)

---

## Dependencies

### New Dependency
- `ruby_llm-schema` gem is now bundled for the `params` DSL

### Updated Dependencies
- Rails 8.1 support
- JRuby 10.0.2.0 support

---

## Commit Summary

Total commits: 37

**Key commits**:
1. New RubyLLM::Schema/JSON schema powered params DSL for Tools
2. Raw Content Blocks, Anthropic Prompt Caching, and Cached Token Tracking
3. Transcription support with diarization
4. Support images in Gemini responses
5. Fix Gemini parallel tool calls + tool results use role: "function"
6. Use responseJsonSchema for Gemini 2.5 structured output
7. Allow configuration of model registry path
8. Adding Tool's with_params support to all providers

---

## Migration Checklist

### For All Users
- [ ] Update gem: `bundle update ruby_llm`
- [ ] Review token tracking changes (cached_tokens, cache_creation_tokens)
- [ ] Test existing functionality (no breaking changes to core API)

### For Rails Users
- [ ] Run `rails generate ruby_llm:upgrade_to_v1_9`
- [ ] Run `rails db:migrate`
- [ ] Verify `use_new_acts_as` location (must be in `config/application.rb`)
- [ ] Test existing models and chats

### For Tool Users
- [ ] Consider migrating to new `params` DSL for complex schemas
- [ ] Old `param` helper continues to work
- [ ] Test tool execution

### For Cost-Conscious Users
- [ ] Implement Anthropic prompt caching with `Content::Raw`
- [ ] Monitor cached token usage via new fields
- [ ] Update cost tracking to include cache metrics

### For Audio Users
- [ ] Explore new `RubyLLM.transcribe` method
- [ ] Test diarization if needed
- [ ] Configure `default_transcription_model`

---

## Resources

- **Release Notes**: https://github.com/crmne/ruby_llm/releases/tag/1.9.0
- **Full Changelog**: https://github.com/crmne/ruby_llm/compare/1.8.2...1.9.0
- **Blog Post**: https://paolino.me/nano-banana-with-rubyllm/ (Gemini Image Generation)
