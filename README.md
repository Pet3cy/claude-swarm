# SwarmSDK, SwarmCLI & SwarmMemory

[![Gem Version](https://badge.fury.io/rb/swarm_sdk.svg)](https://badge.fury.io/rb/swarm_sdk)
[![Gem Version](https://badge.fury.io/rb/swarm_cli.svg)](https://badge.fury.io/rb/swarm_cli)
[![Gem Version](https://badge.fury.io/rb/swarm_memory.svg)](https://badge.fury.io/rb/swarm_memory)
[![CI](https://github.com/parruda/claude-swarm/actions/workflows/ci.yml/badge.svg)](https://github.com/parruda/claude-swarm/actions/workflows/ci.yml)

**A Ruby framework for orchestrating multiple AI agents as a collaborative team with persistent memory.**

SwarmSDK is a complete redesign of Claude Swarm that provides a better developer experience and is geared towards general-purpose agentic systems.

## ✨ Key Features

- **🚀 Decoupled from Claude Code**: No more dependency on Claude Code
- **⚡ Single Process Architecture**: All agents run in one Ruby process using [RubyLLM](https://github.com/parruda/ruby_llm) - no more managing multiple processes
- **🎯 More Efficient**: Direct method calls instead of MCP inter-process communication
- **🔧 Richer Features**: Node workflows, hooks system, scratchpad/memory tools, and more
- **🎮 Better Control**: Fine-grained permissions, cost tracking, structured logging
- **💻 Interactive REPL**: Built with TTY toolkit for a nice command-line experience
- **🌐 Multiple LLM Providers**: Supports all LLM providers supported by RubyLLM (Claude, OpenAI, Gemini, etc.)
- **🧠 SwarmMemory**: Persistent agent knowledge storage with semantic search and FAISS indexing
- **🔌 Plugin System**: Extensible architecture for custom integrations

---

## 🚀 Quick Start

### Installation

```bash
gem install swarm_cli     # Includes swarm_sdk
swarm --help              # Explore the modern CLI
```

### Your First Swarm

Create a simple swarm configuration file `my_swarm.yml`:

```yaml
version: 2
agents:
  lead:
    model: claude-3-5-sonnet-20241022
    role: "Lead developer coordinating development efforts"
    tools:
      - Read
      - Write
      - Edit
      - Bash
    delegates_to:
      - frontend
      - backend

  frontend:
    model: claude-3-5-sonnet-20241022
    role: "Frontend specialist handling UI and user experience"
    tools: [Read, Write, Edit]

  backend:
    model: claude-3-5-sonnet-20241022
    role: "Backend developer managing APIs and data layer"
    tools: [Read, Write, Edit, Bash]
```

Run it:

```bash
# Interactive REPL mode
swarm run my_swarm.yml

# Or with a specific prompt
swarm run my_swarm.yml -p "Build a simple TODO app with React and Node.js"
```

---

## 📚 Documentation

**Complete documentation is available in the [docs/v2](docs/v2/README.md) directory.**

### Getting Started

- **[Getting Started with SwarmSDK](docs/v2/guides/getting-started.md)** ⭐
  Learn the basics: installation, core concepts, your first swarm (YAML & Ruby DSL)

- **[Getting Started with SwarmCLI](docs/v2/guides/quick-start-cli.md)** ⭐
  Command-line interface: interactive REPL and automation modes

### Comprehensive Tutorial

- **[SwarmSDK Complete Tutorial](docs/v2/guides/complete-tutorial.md)**
  In-depth guide covering every feature:
  - Part 1: Fundamentals (agents, models, tools)
  - Part 2: Tools & Permissions (all 11 tools, path/command permissions)
  - Part 3: Agent Collaboration (delegation patterns)
  - Part 4: Hooks System (all 12 events, 6 actions)
  - Part 5: Node Workflows (multi-stage pipelines, transformers)
  - Part 6: Advanced Configuration (MCP, providers, context management)
  - Part 7: Production Features (logging, cost tracking, error handling)
  - Part 8: Best Practices (architecture, testing, optimization)

### Reference Documentation

- **[Architecture Flow Diagram](docs/v2/reference/architecture-flow.md)** - Complete system architecture
- **[Execution Flow Diagram](docs/v2/reference/execution-flow.md)** - Runtime execution journey (21 detailed steps)
- **[CLI Reference](docs/v2/reference/cli.md)** - Complete command-line reference
- **[Ruby DSL Reference](docs/v2/reference/ruby-dsl.md)** - Complete programmatic API
- **[YAML Configuration Reference](docs/v2/reference/yaml.md)** - Complete YAML structure

### Integration Guides

- **[SwarmMemory Guide](docs/v2/guides/swarm-memory.md)** - Persistent agent knowledge with semantic search
- **[Plugin System Guide](docs/v2/guides/plugins.md)** - Build extensions for SwarmSDK
- **[Memory Adapter Development](docs/v2/guides/memory-adapters.md)** - Custom storage backends
- **[Rails Integration Guide](docs/v2/guides/rails-integration.md)** - Integrate with Ruby on Rails

---

## 💡 Core Concepts

### SwarmSDK

A Ruby framework for orchestrating multiple AI agents that work together as a team. Each agent has:

- **Role**: Specialized expertise (backend developer, code reviewer, etc.)
- **Tools**: Capabilities (Read files, Write files, Run bash commands, etc.)
- **Delegation**: Ability to delegate subtasks to other agents
- **Hooks**: Custom logic that runs at key points in execution

### SwarmCLI

A command-line interface for running SwarmSDK swarms with two modes:

- **Interactive (REPL)**: Conversational interface for exploration and iteration
- **Non-Interactive**: One-shot execution perfect for automation and scripting

### SwarmMemory

A persistent memory system for agents with semantic search capabilities:

- **Storage**: Hierarchical knowledge organization (concept, fact, skill, experience)
- **Semantic Search**: FAISS-based vector similarity with local ONNX embeddings
- **Memory Tools**: 9 tools for writing, reading, editing, and searching knowledge
- **LoadSkill**: Dynamic tool swapping based on semantic skill discovery
- **Plugin Architecture**: Integrates seamlessly via SwarmSDK plugin system

### Configuration Formats

- **YAML**: Declarative, easy to read, great for shell-based hooks
- **Ruby DSL**: Programmatic, dynamic, full Ruby power, IDE support

---

## 🎯 Example: Code Review Team

```yaml
version: 2
agents:
  lead_reviewer:
    model: claude-3-5-sonnet-20241022
    role: "Lead code reviewer ensuring quality and best practices"
    tools: [Read, Write]
    delegates_to: [security_expert, performance_analyst]
    hooks:
      on_user_message:
        - run: "git diff main..HEAD > /tmp/changes.diff"
          append_output_to_context: true

  security_expert:
    model: claude-3-5-sonnet-20241022
    role: "Security specialist checking for vulnerabilities"
    tools: [Read]
    hooks:
      on_user_message:
        - run: "semgrep --config=auto --json"
          append_output_to_context: true

  performance_analyst:
    model: claude-3-5-sonnet-20241022
    role: "Performance analyst identifying bottlenecks"
    tools: [Read, Bash]
```

Run the code review:

```bash
swarm run code_review.yml -p "Review the recent changes in the authentication module"
```

---

## 🧠 SwarmMemory Example

Enable persistent memory for your agents:

```bash
gem install swarm_memory
```

```yaml
version: 2
agents:
  research_assistant:
    model: claude-3-5-sonnet-20241022
    role: "Research assistant with long-term memory"
    tools: [Read, Write]
    plugins:
      - swarm_memory:
          storage_dir: ./memories
```

The agent now has access to memory tools:

- `MemoryWrite` - Store new knowledge
- `MemoryRead` - Retrieve specific memories
- `MemorySearch` - Semantic search across all knowledge
- `LoadSkill` - Dynamically load specialized skills
- And more...

[Learn more about SwarmMemory →](docs/v2/guides/swarm-memory.md)

---

## 🔧 Ruby DSL Example

For programmatic control, use the Ruby DSL:

```ruby
require 'swarm_sdk'

swarm = SwarmSDK.build do
  agent :lead do
    model "claude-3-5-sonnet-20241022"
    role "Lead developer"
    tools :Read, :Write, :Edit, :Bash
    delegates_to :frontend, :backend
  end

  agent :frontend do
    model "claude-3-5-sonnet-20241022"
    role "Frontend specialist"
    tools :Read, :Write, :Edit
  end

  agent :backend do
    model "claude-3-5-sonnet-20241022"
    role "Backend specialist"
    tools :Read, :Write, :Edit, :Bash
  end
end

# Execute with the lead agent
result = swarm.execute(
  agent: :lead,
  prompt: "Build a simple TODO app"
)

puts result.message
```

[Learn more about the Ruby DSL →](docs/v2/reference/ruby-dsl.md)

---

## 🛠️ Advanced Features

### Node Workflows

Build multi-stage processing pipelines:

```yaml
version: 2
nodes:
  analyzer:
    agent: code_analyst
    prompt: "Analyze the codebase and identify issues"

  fixer:
    agent: code_fixer
    prompt: "Fix the issues identified: {{ analyzer.output }}"
    depends_on: [analyzer]

  reviewer:
    agent: code_reviewer
    prompt: "Review the fixes: {{ fixer.output }}"
    depends_on: [fixer]

agents:
  code_analyst:
    model: claude-3-5-sonnet-20241022
    role: "Code analyst"
    tools: [Read]

  code_fixer:
    model: claude-3-5-sonnet-20241022
    role: "Code fixer"
    tools: [Read, Write, Edit]

  code_reviewer:
    model: claude-3-5-sonnet-20241022
    role: "Code reviewer"
    tools: [Read]
```

[Learn more about Node Workflows →](docs/v2/guides/complete-tutorial.md#part-5-node-workflows)

### Hooks System

Run custom logic at key execution points:

```yaml
version: 2
agents:
  developer:
    model: claude-3-5-sonnet-20241022
    role: "Full-stack developer"
    tools: [Read, Write, Edit, Bash]
    hooks:
      # Run before each tool execution
      on_pre_tool:
        - run: "echo 'About to use {{ tool_name }}'"

      # Run after successful tool execution
      on_post_tool:
        - run: "echo 'Tool {{ tool_name }} completed successfully'"

      # Append git diff to every user message
      on_user_message:
        - run: "git diff"
          append_output_to_context: true

      # Run tests before the agent responds
      on_pre_response:
        - run: "npm test"
          stop_on_error: true
```

[Learn more about Hooks →](docs/v2/guides/complete-tutorial.md#part-4-hooks-system)

---

## 📊 Cost Tracking & Logging

SwarmSDK provides built-in cost tracking and structured logging:

```ruby
require 'swarm_sdk'

swarm = SwarmSDK.load('my_swarm.yml')

result = swarm.execute(
  agent: :lead,
  prompt: "Build a simple TODO app",
  logger: Logger.new($stdout)
)

# Access cost information
puts "Total cost: $#{result.cost}"
puts "Tokens used: #{result.tokens}"
```

[Learn more about Production Features →](docs/v2/guides/complete-tutorial.md#part-7-production-features)

---

## 🔗 Integration Examples

### Rails Integration

```ruby
# app/jobs/code_review_job.rb
class CodeReviewJob < ApplicationJob
  def perform(pull_request_id)
    swarm = SwarmSDK.load(Rails.root.join('config', 'code_review_swarm.yml'))

    result = swarm.execute(
      agent: :lead_reviewer,
      prompt: "Review PR ##{pull_request_id}"
    )

    PullRequest.find(pull_request_id).update(
      review_status: 'completed',
      review_comments: result.message
    )
  end
end
```

[Learn more about Rails Integration →](docs/v2/guides/rails-integration.md)

### Custom Plugins

```ruby
# lib/my_plugin.rb
class MyPlugin < SwarmSDK::Plugin
  def on_agent_init(agent)
    # Add custom behavior when agent initializes
  end

  def on_user_message(message, agent)
    # Process user messages
  end

  def provide_tools
    [MyCustomTool.new]
  end
end

# Register the plugin
SwarmSDK.register_plugin(:my_plugin, MyPlugin)
```

[Learn more about Plugins →](docs/v2/guides/plugins.md)

---

## 🆚 SwarmSDK (v2) vs Claude Swarm (v1)

| Feature                | SwarmSDK v2            | Claude Swarm v1                 |
| ---------------------- | ---------------------- | ------------------------------- |
| **Architecture**       | Single Ruby process    | Multiple Claude Code processes  |
| **Dependencies**       | RubyLLM (Ruby-only)    | Requires Claude CLI (Node.js)   |
| **Performance**        | Direct method calls    | MCP inter-process communication |
| **LLM Support**        | All RubyLLM providers  | Claude + OpenAI (via MCP)       |
| **Memory System**      | Built-in SwarmMemory   | Not available                   |
| **Plugin System**      | Yes                    | No                              |
| **Node Workflows**     | Yes                    | No                              |
| **Hooks**              | 12 events, 6 actions   | Claude Code hooks only          |
| **Context Management** | Fine-grained control   | Limited                         |
| **Cost Tracking**      | Built-in               | Limited to MCP calls            |
| **Interactive REPL**   | TTY-based with history | Not available                   |
| **Ruby DSL**           | Full support           | Not available                   |

---

## 📖 Looking for v1 Documentation?

**Claude Swarm (v1)** continues to be maintained and is still a great choice if you prefer the multi-process architecture with Claude Code instances.

[View Claude Swarm v1 Documentation →](docs/v1/README.md)

To install Claude Swarm v1:

```bash
gem install claude_swarm
```

---

## 🤝 Contributing

Bug reports and pull requests are welcome on GitHub at https://github.com/parruda/claude-swarm.

1. Fork the repository
2. Create your feature branch (`git checkout -b my-new-feature`)
3. Commit your changes (`git commit -am 'Add some feature'`)
4. Push to the branch (`git push origin my-new-feature`)
5. Create a new Pull Request

---

## 📄 License

The gems are available as open source under the terms of the [MIT License](LICENSE).

---

## 🔗 Links

- **Documentation**: [docs/v2/README.md](docs/v2/README.md)
- **GitHub Repository**: [parruda/claude-swarm](https://github.com/parruda/claude-swarm)
- **RubyGems**:
  - [swarm_sdk](https://rubygems.org/gems/swarm_sdk)
  - [swarm_cli](https://rubygems.org/gems/swarm_cli)
  - [swarm_memory](https://rubygems.org/gems/swarm_memory)
- **Issues & Support**: [GitHub Issues](https://github.com/parruda/claude-swarm/issues)

---

**Ready to get started?** → [Getting Started with SwarmSDK](docs/v2/guides/getting-started.md) or [Getting Started with SwarmCLI](docs/v2/guides/quick-start-cli.md)
