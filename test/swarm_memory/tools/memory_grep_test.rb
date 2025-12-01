# frozen_string_literal: true

require_relative "../../swarm_memory_test_helper"

class MemoryGrepToolTest < Minitest::Test
  def setup
    @storage = create_temp_storage
    @tool = SwarmMemory::Tools::MemoryGrep.new(storage: @storage)
  end

  def teardown
    cleanup_storage(@storage)
  end

  # files_with_matches output mode tests

  def test_files_with_matches_includes_titles
    @storage.write(
      file_path: "concept/ruby/classes.md",
      content: "Ruby classes are blueprints for objects",
      title: "Ruby Classes",
      metadata: { "type" => "concept" },
    )
    @storage.write(
      file_path: "concept/ruby/modules.md",
      content: "Ruby modules provide mixins",
      title: "Ruby Modules",
      metadata: { "type" => "concept" },
    )

    result = @tool.execute(pattern: "Ruby")

    assert_match(/Memory entries matching/, result)
    assert_match(%r{- memory://concept/ruby/classes\.md "Ruby Classes"}, result)
    assert_match(%r{- memory://concept/ruby/modules\.md "Ruby Modules"}, result)
  end

  def test_files_with_matches_single_entry
    @storage.write(
      file_path: "fact/people/john.md",
      content: "John is a developer",
      title: "John Smith",
      metadata: { "type" => "fact" },
    )

    result = @tool.execute(pattern: "developer")

    assert_match(/1 entry/, result)
    assert_match(%r{- memory://fact/people/john\.md "John Smith"}, result)
  end

  def test_files_with_matches_no_results
    result = @tool.execute(pattern: "nonexistent")

    assert_match(/No matches found/, result)
  end

  def test_files_with_matches_with_path_filter
    @storage.write(
      file_path: "concept/ruby/classes.md",
      content: "Ruby classes",
      title: "Ruby Classes",
      metadata: { "type" => "concept" },
    )
    @storage.write(
      file_path: "skill/ruby/debugging.md",
      content: "Ruby debugging",
      title: "Ruby Debugging",
      metadata: { "type" => "skill" },
    )

    result = @tool.execute(pattern: "Ruby", path: "concept/")

    assert_match(%r{- memory://concept/ruby/classes\.md "Ruby Classes"}, result)
    refute_match(/debugging/, result)
  end

  def test_files_with_matches_case_insensitive
    @storage.write(
      file_path: "concept/ruby/classes.md",
      content: "RUBY classes",
      title: "Ruby Classes",
      metadata: { "type" => "concept" },
    )

    result = @tool.execute(pattern: "ruby", case_insensitive: true)

    assert_match(%r{- memory://concept/ruby/classes\.md "Ruby Classes"}, result)
  end

  # content output mode tests

  def test_content_mode_shows_matching_lines
    @storage.write(
      file_path: "concept/ruby/classes.md",
      content: "Line 1\nRuby classes here\nLine 3",
      title: "Ruby Classes",
      metadata: { "type" => "concept" },
    )

    result = @tool.execute(pattern: "Ruby", output_mode: "content")

    assert_match(%r{memory://concept/ruby/classes\.md:}, result)
    assert_match(/2:.*Ruby classes here/, result)
  end

  def test_content_mode_shows_match_counts
    @storage.write(
      file_path: "concept/ruby/classes.md",
      content: "Ruby one\nRuby two\nRuby three",
      title: "Ruby Classes",
      metadata: { "type" => "concept" },
    )

    result = @tool.execute(pattern: "Ruby", output_mode: "content")

    assert_match(/3 matches/, result)
  end

  # count output mode tests

  def test_count_mode_shows_match_counts
    @storage.write(
      file_path: "concept/ruby/classes.md",
      content: "Ruby one\nRuby two",
      title: "Ruby Classes",
      metadata: { "type" => "concept" },
    )
    @storage.write(
      file_path: "concept/ruby/modules.md",
      content: "Ruby modules",
      title: "Ruby Modules",
      metadata: { "type" => "concept" },
    )

    result = @tool.execute(pattern: "Ruby", output_mode: "count")

    assert_match(/3 total matches/, result)
    assert_match(%r{memory://concept/ruby/classes\.md: 2 matches}, result)
    assert_match(%r{memory://concept/ruby/modules\.md: 1 match}, result)
  end

  # error handling tests

  def test_invalid_regex_returns_error
    result = @tool.execute(pattern: "[invalid")

    assert_match(/InputValidationError/, result)
    assert_match(/Invalid regex pattern/, result)
  end

  def test_invalid_output_mode_returns_error
    @storage.write(
      file_path: "concept/test.md",
      content: "test",
      title: "Test",
      metadata: { "type" => "concept" },
    )

    result = @tool.execute(pattern: "test", output_mode: "invalid")

    assert_match(/InputValidationError/, result)
  end
end
