# SwarmSDK Event Payload Structures

This document describes the exact structure of all SwarmSDK event payloads emitted via `LogStream.emit()`.

All events automatically include a `timestamp` field (ISO8601 format) added by `LogStream.emit()`.

## Event Types

### 1. swarm_start

Emitted when `Swarm.execute()` is called, before any agent execution begins.

**Location**: `lib/swarm_sdk/swarm.rb:670-677`

```ruby
{
  type: "swarm_start",
  timestamp: "2025-01-15T10:30:45Z",          # Auto-added by LogStream
  agent: :lead_agent_name,                     # Lead agent name (for consistency)
  swarm_name: "Development Team",              # Swarm name
  lead_agent: :lead_agent_name,                # Lead agent name
  prompt: "Build authentication system"        # User's task prompt
}
```

**Field Locations**:
- Root level: `type`, `timestamp`, `agent`, `swarm_name`, `lead_agent`, `prompt`
- No nested metadata

---

### 2. swarm_stop

Emitted when swarm execution completes (success or error).

**Location**: `lib/swarm_sdk/swarm.rb:685-696`

```ruby
{
  type: "swarm_stop",
  timestamp: "2025-01-15T10:35:22Z",
  swarm_name: "Development Team",
  lead_agent: :lead_agent_name,
  last_agent: "backend",                       # Agent that produced final response
  content: "Authentication system complete",   # Final response content (can be nil)
  success: true,                               # Boolean: true if no error
  duration: 277.5,                             # Seconds (Float)
  total_cost: 0.00234,                         # USD (Float)
  total_tokens: 12450,                         # Integer
  agents_involved: [:lead, :backend, :frontend] # Array of agent names
}
```

**Field Locations**:
- Root level: All fields are at root level
- No nested metadata for this event

---

### 3. agent_start

Emitted once per agent when agents are initialized (lazy initialization).

**Location**: `lib/swarm_sdk/swarm.rb:567-578`

```ruby
{
  type: "agent_start",
  timestamp: "2025-01-15T10:30:46Z",
  agent: :backend,                             # Agent name
  swarm_name: "Development Team",
  model: "gpt-5",                              # Model ID
  provider: "openai",                          # Provider name
  directory: "./backend",                      # Working directory
  system_prompt: "You are a backend dev...",   # Full system prompt
  tools: [:Read, :Edit, :Bash, :DelegateTaskToFrontend], # Array of tool names
  delegates_to: [:frontend],                   # Array of delegate agent names
  plugin_storages: {                           # Plugin storage info (optional)
    memory: {
      enabled: true,
      config: { directory: ".swarm/backend-memory" }
    }
  }
}
```

**Field Locations**:
- Root level: All fields except plugin configs
- Nested in `plugin_storages`: Per-plugin configuration

---

### 4. agent_stop

Emitted when an agent completes with a final response (no more tool calls).

**Location**: `lib/swarm_sdk/swarm.rb:746-756`

```ruby
{
  type: "agent_stop",
  timestamp: "2025-01-15T10:31:20Z",
  agent: "backend",
  model: "gpt-5",
  content: "I've implemented the auth system",  # Final response text
  tool_calls: nil,                              # Always nil for agent_stop
  finish_reason: "stop",                        # "stop", "finish_agent", "finish_swarm"
  usage: {                                      # Usage statistics
    input_tokens: 2450,
    output_tokens: 856,
    total_tokens: 3306,
    input_cost: 0.001225,
    output_cost: 0.000428,
    total_cost: 0.001653,
    cumulative_input_tokens: 8920,             # Total for entire conversation
    cumulative_output_tokens: 3530,
    cumulative_total_tokens: 12450,
    context_limit: 200000,
    tokens_used_percentage: "6.23%",
    tokens_remaining: 187550
  },
  tool_executions: nil,                        # Array of tool execution results (if any)
  metadata: {                                  # Additional context (minimal)
    # Fields promoted to root level are excluded here
  }
}
```

**Field Locations**:
- Root level: `type`, `timestamp`, `agent`, `model`, `content`, `tool_calls`, `finish_reason`, `tool_executions`, `metadata`
- Nested in `usage`: All token counts, costs, and context tracking
- Nested in `metadata`: Minimal (most fields promoted to root)

**Note**: The `metadata` field in `agent_stop` has most fields extracted to root level to avoid duplication (see `swarm.rb:743`).

---

### 5. agent_step

Emitted when an agent makes an intermediate response with tool calls (agent hasn't finished yet).

**Location**: `lib/swarm_sdk/swarm.rb:725-735`

```ruby
{
  type: "agent_step",
  timestamp: "2025-01-15T10:31:15Z",
  agent: "backend",
  model: "gpt-5",
  content: "I'll read the config files",       # Agent's reasoning/message
  tool_calls: [                                # Array of tool calls
    {
      id: "call_abc123",
      name: "Read",
      arguments: { file_path: "config/auth.rb" }
    }
  ],
  finish_reason: "tool_calls",                 # Always "tool_calls" for agent_step
  usage: {                                     # Same structure as agent_stop
    input_tokens: 1850,
    output_tokens: 156,
    total_tokens: 2006,
    input_cost: 0.000925,
    output_cost: 0.000078,
    total_cost: 0.001003,
    cumulative_input_tokens: 6470,
    cumulative_output_tokens: 2674,
    cumulative_total_tokens: 9144,
    context_limit: 200000,
    tokens_used_percentage: "4.57%",
    tokens_remaining: 190856
  },
  tool_executions: [],                         # Usually empty for steps (filled on completion)
  metadata: {
    # Fields promoted to root level are excluded here
  }
}
```

**Field Locations**:
- Root level: `type`, `timestamp`, `agent`, `model`, `content`, `tool_calls`, `finish_reason`, `usage`, `tool_executions`, `metadata`
- Nested in `tool_calls`: Array of `{ id, name, arguments }` objects
- Nested in `usage`: All token and cost information
- Nested in `metadata`: Minimal (most fields promoted to root)

**Note**: Similar to `agent_stop`, but `finish_reason` is always `"tool_calls"` and `tool_calls` array is populated.

---

### 6. user_prompt

Emitted when a user message is about to be sent to the LLM.

**Location**: `lib/swarm_sdk/swarm.rb:705-714`

```ruby
{
  type: "user_prompt",
  timestamp: "2025-01-15T10:31:10Z",
  agent: "backend",
  model: "gpt-5",
  provider: "openai",
  message_count: 5,                            # Number of messages in conversation so far
  tools: [:Read, :Edit, :Bash],                # Available tools (excluding delegation tools)
  delegates_to: ["frontend"],                  # Agents this agent can delegate to
  metadata: {                                  # Full context available here
    prompt: "Build authentication",
    message_count: 5,
    model: "gpt-5",
    provider: "openai",
    tools: [:Read, :Edit, :Bash],
    delegates_to: ["frontend"],
    timestamp: "2025-01-15T10:31:10Z"
  }
}
```

**Field Locations**:
- Root level: `type`, `timestamp`, `agent`, `model`, `provider`, `message_count`, `tools`, `delegates_to`, `metadata`
- Nested in `metadata`: Complete copy of all context fields (including prompt)

**Important**: The `metadata` hash contains the original context from the hook, including the `prompt` field which is NOT promoted to root level for this event type.

---

### 7. tool_call

Emitted before a tool is executed (pre_tool_use hook).

**Location**: `lib/swarm_sdk/swarm.rb:766-773`

```ruby
{
  type: "tool_call",
  timestamp: "2025-01-15T10:31:16Z",
  agent: "backend",
  tool_call_id: "call_abc123",                 # Unique call ID
  tool: "Read",                                # Tool name
  arguments: {                                 # Tool parameters
    file_path: "config/auth.rb"
  },
  metadata: {}                                 # Additional context (usually empty)
}
```

**Field Locations**:
- Root level: `type`, `timestamp`, `agent`, `tool_call_id`, `tool`, `arguments`, `metadata`
- Nested in `arguments`: Tool-specific parameters
- Nested in `metadata`: Additional context (typically minimal)

---

### 8. tool_result

Emitted after a tool completes execution (post_tool_use hook).

**Location**: `lib/swarm_sdk/swarm.rb:783-790`

```ruby
{
  type: "tool_result",
  timestamp: "2025-01-15T10:31:17Z",
  agent: "backend",
  tool_call_id: "call_abc123",                 # Matches the tool_call ID
  tool: "Read",                                # Tool name
  result: "# Authentication config\n...",      # Tool output (can be String, Hash, Array)
  metadata: {}                                 # Additional context (usually empty)
}
```

**Field Locations**:
- Root level: `type`, `timestamp`, `agent`, `tool_call_id`, `tool`, `result`, `metadata`
- `result` can be:
  - String: Direct text output
  - Hash/Array: Structured data
  - See `LoggingHelpers.serialize_result()` for how different types are handled

---

## Additional Event Types

### 9. model_lookup_warning

Emitted when a model isn't found in the registry during initialization.

**Location**: `lib/swarm_sdk/swarm.rb:445-452`

```ruby
{
  type: "model_lookup_warning",
  timestamp: "2025-01-15T10:30:46Z",
  agent: :backend,
  model: "gpt-5-turbo",                        # Invalid model name
  error_message: "Model 'gpt-5-turbo' not...", # Error description
  suggestions: [                               # Similar models found
    {
      id: "gpt-5",
      name: "GPT-5",
      context_window: 200000
    }
  ]
}
```

---

### 10. context_limit_warning

Emitted when context usage crosses threshold percentages (60%, 80%, 90%, 95%).

**Location**: `lib/swarm_sdk/swarm.rb:798-808`

```ruby
{
  type: "context_limit_warning",
  timestamp: "2025-01-15T10:32:45Z",
  agent: "backend",
  model: "gpt-5",
  threshold: "80%",                            # Threshold crossed
  current_usage: "82.5%",                      # Current usage
  tokens_used: 165000,
  tokens_remaining: 35000,
  context_limit: 200000,
  metadata: {}                                 # Agent context metadata
}
```

---

### 11. agent_delegation

Emitted when an agent delegates work to another agent.

**Location**: `lib/swarm_sdk/agent/chat/context_tracker.rb:186-193`

```ruby
{
  type: "agent_delegation",
  timestamp: "2025-01-15T10:31:30Z",
  agent: "backend",
  tool_call_id: "call_xyz789",
  delegate_to: "frontend",                     # Target agent name
  arguments: {                                 # Delegation parameters
    prompt: "Build the login UI"
  },
  metadata: {}                                 # Agent context metadata
}
```

---

### 12. delegation_result

Emitted when a delegated task completes and returns to the delegating agent.

**Location**: `lib/swarm_sdk/agent/chat/context_tracker.rb:163-170`

```ruby
{
  type: "delegation_result",
  timestamp: "2025-01-15T10:32:15Z",
  agent: "backend",                            # Agent that delegated
  delegate_from: "frontend",                   # Agent that was delegated to
  tool_call_id: "call_xyz789",                 # Matches delegation tool_call_id
  result: "Login UI implemented",              # Result from delegate
  metadata: {}                                 # Agent context metadata
}
```

---

### 13. context_compression

Emitted when automatic context compression is triggered at 60% threshold.

**Location**: `lib/swarm_sdk/agent/chat/context_tracker.rb:301-310`

```ruby
{
  type: "context_compression",
  timestamp: "2025-01-15T10:33:00Z",
  agent: "backend",
  total_messages: 45,                          # Total messages after compression
  messages_compressed: 12,                     # Number of messages compressed
  tokens_before: 125000,                       # Token count before compression
  current_usage: "62.5%",                      # Usage after compression
  compression_strategy: "progressive_tool_result_compression",
  keep_recent: 10                              # Number of recent messages kept uncompressed
}
```

---

### 14. llm_retry_attempt

Emitted when an LLM API call fails and is being retried.

**Location**: `lib/swarm_sdk/agent/chat.rb:813-823`

```ruby
{
  type: "llm_retry_attempt",
  timestamp: "2025-01-15T10:31:18Z",
  agent: "backend",
  model: "gpt-5",
  attempt: 1,                                  # Current attempt number
  max_retries: 10,                             # Maximum retries
  error_class: "Faraday::ConnectionFailed",    # Error class name
  error_message: "Connection refused",         # Error message
  retry_delay: 10                              # Seconds before next retry
}
```

---

### 15. llm_retry_exhausted

Emitted when all LLM API retry attempts are exhausted.

**Location**: `lib/swarm_sdk/agent/chat.rb:802-809`

```ruby
{
  type: "llm_retry_exhausted",
  timestamp: "2025-01-15T10:33:30Z",
  agent: "backend",
  model: "gpt-5",
  attempts: 10,                                # Total attempts made
  error_class: "Faraday::ConnectionFailed",
  error_message: "Connection refused"
}
```

---

## Summary: Field Location Guide

### Always at Root Level
- `type` - Event type identifier
- `timestamp` - ISO8601 timestamp (auto-added)
- `agent` - Agent name

### Event-Specific Root Fields

| Event | Root Fields | Nested Fields |
|-------|-------------|---------------|
| `swarm_start` | swarm_name, lead_agent, prompt | None |
| `swarm_stop` | swarm_name, lead_agent, last_agent, content, success, duration, total_cost, total_tokens, agents_involved | None |
| `agent_start` | swarm_name, model, provider, directory, system_prompt, tools, delegates_to | plugin_storages.* |
| `agent_stop` | model, content, tool_calls, finish_reason, tool_executions | usage.*, metadata.* |
| `agent_step` | model, content, tool_calls, finish_reason, tool_executions | usage.*, tool_calls[].*, metadata.* |
| `user_prompt` | model, provider, message_count, tools, delegates_to | metadata.* (includes prompt) |
| `tool_call` | tool_call_id, tool | arguments.*, metadata.* |
| `tool_result` | tool_call_id, tool, result | metadata.* |

### Important Notes

1. **Usage Information**: Always nested in `usage` hash within `agent_step` and `agent_stop` events
2. **Tool Calls**: Nested as array of objects in `tool_calls` field within `agent_step` events
3. **Prompt Location**: For `user_prompt` events, the prompt is in `metadata.prompt`, NOT at root level
4. **Metadata Deduplication**: `agent_step` and `agent_stop` events have minimal metadata because most fields are promoted to root level (see `swarm.rb:723` and `swarm.rb:744`)

---

## Code References

- **LogStream**: `lib/swarm_sdk/log_stream.rb` - Core emission mechanism
- **Event Emissions**: `lib/swarm_sdk/swarm.rb:664-809` - Default logging callbacks
- **Agent Events**: `lib/swarm_sdk/agent/chat/context_tracker.rb` - Agent-level event tracking
- **Hook Integration**: `lib/swarm_sdk/agent/chat/hook_integration.rb` - User prompt event preparation
- **Logging Helpers**: `lib/swarm_sdk/agent/chat/logging_helpers.rb` - Tool call/result formatting
