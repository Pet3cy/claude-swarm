# frozen_string_literal: true

require_relative "lib/swarm_memory/version"

Gem::Specification.new do |spec|
  spec.name          = "swarm_memory"
  spec.version       = SwarmMemory::VERSION
  spec.authors       = ["Paulo Arruda"]
  spec.email         = ["parrudaj@gmail.com"]
  spec.summary       = "Persistent memory system for SwarmSDK agents"
  spec.description   = "Hierarchical persistent memory with semantic search for SwarmSDK AI agents"
  spec.homepage      = "https://github.com/parruda/claude-swarm"
  spec.license       = "MIT"

  spec.files         = Dir["lib/**/*", "LICENSE", "README.md"]
  spec.require_paths = ["lib"]
  spec.required_ruby_version = ">= 3.2.0"

  # Core dependencies
  spec.add_dependency("async", "~> 2.0")
  spec.add_dependency("informers", "~> 1.2.1")
  spec.add_dependency("ruby_llm", "~> 1.8")
  spec.add_dependency("swarm_sdk", "~> 2.0")
  spec.add_dependency("zeitwerk", "~> 2.6")
end
