# frozen_string_literal: true

# Standard library dependencies
require "bundler"
require "digest"
require "English"
require "erb"
require "fileutils"
require "io/console"
require "json"
require "logger"
require "open3"
require "pathname"
require "pty"
require "securerandom"
require "set"
require "shellwords"
require "time"
require "timeout"
require "tmpdir"
require "yaml"

# External dependencies
require "claude_sdk"
require "fast_mcp"
require "mcp_client"
require "thor"

# Zeitwerk setup
require "zeitwerk"
loader = Zeitwerk::Loader.new
loader.tag = "claude_swarm"
loader.push_dir("#{__dir__}/claude_swarm", namespace: ClaudeSwarm)
loader.ignore("#{__dir__}/claude_swarm/templates")
loader.inflector.inflect(
  "cli" => "CLI",
  "openai" => "OpenAI",
)
loader.setup

module ClaudeSwarm
  class Error < StandardError; end

  class << self
    def root_dir
      ENV.fetch("CLAUDE_SWARM_ROOT_DIR") { Dir.pwd }
    end

    def home_dir
      ENV.fetch("CLAUDE_SWARM_HOME") { File.expand_path("~/.claude-swarm") }
    end

    def joined_home_dir(*strings)
      File.join(home_dir, *strings)
    end

    def joined_run_dir(*strings)
      joined_home_dir("run", *strings)
    end

    def joined_sessions_dir(*strings)
      joined_home_dir("sessions", *strings)
    end

    def joined_worktrees_dir(*strings)
      joined_home_dir("worktrees", *strings)
    end
  end
end
