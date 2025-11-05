# SwarmMemory Adapter Tutorial

This tutorial will teach you how to create custom storage adapters for SwarmMemory. It's designed for developers who are new to SwarmSDK and SwarmMemory.

## Table of Contents

1. [What is a SwarmMemory Adapter?](#what-is-a-swarmmemory-adapter)
2. [Understanding the Architecture](#understanding-the-architecture)
3. [The Adapter Interface](#the-adapter-interface)
4. [Creating Your First Adapter](#creating-your-first-adapter)
5. [Advanced Example: Redis Adapter](#advanced-example-redis-adapter)
6. [Registering and Using Your Adapter](#registering-and-using-your-adapter)
7. [Best Practices](#best-practices)
8. [Testing Your Adapter](#testing-your-adapter)

## What is a SwarmMemory Adapter?

SwarmMemory is a hierarchical persistent memory system for SwarmSDK agents. It allows AI agents to store, retrieve, and search information across conversations. An **adapter** is a storage backend that determines *where* and *how* this memory data is stored.

### Why Create a Custom Adapter?

You might want to create a custom adapter to:

- Store memories in a database (PostgreSQL, MySQL, SQLite)
- Use a key-value store (Redis, Memcached)
- Sync memories to cloud storage (S3, Google Cloud Storage)
- Add custom indexing or search capabilities
- Integrate with existing data infrastructure

### Built-in Adapters

SwarmMemory comes with one built-in adapter:

- **FilesystemAdapter**: Stores memories as `.md` (content) and `.yml` (metadata) file pairs on disk

## Understanding the Architecture

Before creating an adapter, let's understand how SwarmMemory works:

```
┌─────────────────────────────────────────┐
│         SwarmSDK Agent                  │
│  (uses memory tools like MemoryWrite)   │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│    SwarmMemory::Tools::MemoryWrite      │
│         (RubyLLM::Tool)                 │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│      SwarmMemory::Core::Storage         │
│   (orchestrates memory operations)      │
│                                         │
│  - Path normalization                   │
│  - Embedding generation (optional)      │
│  - Metadata extraction                  │
│  - Stub redirect handling               │
└──────────┬────────────────┬─────────────┘
           │                │
           │                └──────────────────┐
           ▼                                   ▼
┌─────────────────────────────────┐  ┌─────────────────────┐
│   Your Custom Adapter           │  │  SemanticIndex      │
│(SwarmMemory::Adapters::Base)    │  │  (hybrid search)    │
│                                 │  │                     │
│  Implements:                    │  │  - Embeddings       │
│  - write(file_path, content,    │  │  - Keyword match    │
│    title, embedding, metadata)  │  │  - Hybrid scoring   │
│  - read(file_path)              │  └─────────────────────┘
│  - read_entry(file_path)        │
│  - delete(file_path)            │
│  - list(prefix)                 │
│  - glob(pattern)                │
│  - grep(pattern, ...)           │
│  - semantic_search (optional)   │
│  - clear, size, total_size      │
└──────────────┬──────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│      Your Storage Backend               │
│  (Filesystem, Database, Redis, S3...)   │
└─────────────────────────────────────────┘
```

### Key Components

**SwarmMemory::Core::Storage** - Orchestration layer that:
- Normalizes and validates paths with `PathNormalizer`
- Generates embeddings using `Embedder` (optional)
- Delegates persistence to your adapter
- Handles stub redirects (created by MemoryDefrag)
- Builds searchable text from title + tags + content preview

**SwarmMemory::Adapters::Base** - Abstract adapter interface that:
- Defines the contract all adapters must implement
- Enforces size limits (3MB per entry, 100GB total)
- Provides helper methods like `glob_to_regex` and `format_bytes`

**SwarmMemory::Core::SemanticIndex** - Semantic search layer that:
- Uses adapter's `semantic_search` method if available
- Combines semantic similarity with keyword matching (hybrid search)
- Configurable weights (default: 50% semantic, 50% keyword)
- Falls back to text search if semantic search unavailable

**SwarmMemory::Core::Entry** - Data model containing:
- `content` (String) - The actual content
- `title` (String) - Brief description
- `updated_at` (Time) - Last modified timestamp
- `size` (Integer) - Content size in bytes
- `embedding` (Array<Float>, optional) - 384-dim vector for semantic search
- `metadata` (Hash, optional) - Type, tags, confidence, domain, etc.

## The Adapter Interface

All adapters must inherit from `SwarmMemory::Adapters::Base` and implement the following methods:

### Core Methods

#### `write(file_path:, content:, title:, embedding: nil, metadata: nil)`

Stores a memory entry.

**Parameters:**
- `file_path` (String): Logical path like `"concepts/ruby/blocks.md"`
- `content` (String): The actual content to store
- `title` (String): Brief description (e.g., "Ruby blocks and closures")
- `embedding` (Array<Float>, optional): 384-dimensional embedding vector for semantic search
- `metadata` (Hash, optional): Additional metadata (tags, confidence, etc.)

**Returns:** `SwarmMemory::Core::Entry` object

**Must enforce:**
- Maximum entry size: 3MB (`MAX_ENTRY_SIZE`)
- Maximum total storage: 100GB (`MAX_TOTAL_SIZE`)

#### `read(file_path:)`

Retrieves the content of a memory entry.

**Parameters:**
- `file_path` (String): Logical path with `.md` extension

**Returns:** String (the content)

**Raises:** `ArgumentError` if path not found

#### `read_entry(file_path:)`

Retrieves the full entry including metadata.

**Parameters:**
- `file_path` (String): Logical path with `.md` extension

**Returns:** `SwarmMemory::Core::Entry` object with all metadata

#### `delete(file_path:)`

Deletes a memory entry.

**Parameters:**
- `file_path` (String): Logical path with `.md` extension

**Returns:** void

**Raises:** `ArgumentError` if path not found

#### `list(prefix: nil)`

Lists all entries, optionally filtered by path prefix.

**Parameters:**
- `prefix` (String, optional): Filter by path prefix (e.g., `"concepts/"`)

**Returns:** Array of hashes with keys: `:path`, `:title`, `:size`, `:updated_at`

**Usage note:** This method is used internally by `MemoryDefrag` for analysis and optimization. It is NOT exposed as a tool for agents to call directly. Agents use `MemoryGlob` for browsing/discovering entries instead.

#### `glob(pattern:)`

Searches entries by glob pattern.

**Parameters:**
- `pattern` (String): Glob pattern like `"concepts/**/*.md"`, `"fact/*"`, etc.

**Returns:** Array of hashes (same format as `list`), sorted by most recent first

#### `grep(pattern:, case_insensitive: false, output_mode: "files_with_matches", path: nil)`

Searches entry content by regular expression.

**Parameters:**
- `pattern` (String): Regular expression pattern
- `case_insensitive` (Boolean): Case-insensitive search
- `output_mode` (String): One of:
  - `"files_with_matches"`: Returns paths only (default)
  - `"content"`: Returns paths with matching lines and line numbers
  - `"count"`: Returns paths with match counts
- `path` (String, optional): Filter results to specific path prefix

**Returns:** Format depends on `output_mode`

#### `clear()`

Deletes all entries.

**Returns:** void

#### `total_size()`

Returns total storage size in bytes.

**Returns:** Integer

#### `size()`

Returns number of entries.

**Returns:** Integer

### Optional Methods

#### `semantic_search(embedding:, top_k: 10, threshold: 0.0)` (Optional)

Performs semantic search using embedding vectors. **This method is optional but highly recommended** for enabling semantic memory retrieval.

**Parameters:**
- `embedding` (Array<Float>): Query embedding vector (384 dimensions for default model)
- `top_k` (Integer): Number of results to return
- `threshold` (Float): Minimum similarity score (0.0-1.0)

**Returns:** Array of hashes with `:path`, `:similarity`, `:title`, `:size`, `:updated_at`, `:metadata`

**How it works:**
1. The query text is converted to an embedding vector by `SwarmMemory::Embeddings::InformersEmbedder`
2. Your adapter compares this vector with stored embeddings using cosine similarity
3. Results are ranked by similarity score (higher = more similar)
4. `SemanticIndex` then combines semantic similarity with keyword matching for hybrid search

**Implementation approaches:**

1. **Vector Database (Recommended for production)**: Use a dedicated vector database like pgvector, Qdrant, Pinecone, Milvus, or Chroma. These provide optimized similarity search with approximate nearest neighbor (ANN) algorithms for better performance at scale.

```ruby
def semantic_search(embedding:, top_k:, threshold:)
  # Use pgvector's native cosine distance operator
  results = @db.query(
    "SELECT path, title, size, updated_at, metadata,
            1 - (embedding <=> $1) as similarity
     FROM memories
     WHERE 1 - (embedding <=> $1) >= $2
     ORDER BY embedding <=> $1
     LIMIT $3",
    embedding, threshold, top_k
  )
  # Format and return results...
end
```

2. **Manual cosine similarity** (for simple/testing scenarios): Calculate similarity in Ruby using the helper from `SwarmMemory::Search::TextSimilarity`:

```ruby
def cosine_similarity(vec1, vec2)
  dot_product = vec1.zip(vec2).sum { |a, b| a * b }
  magnitude1 = Math.sqrt(vec1.sum { |x| x**2 })
  magnitude2 = Math.sqrt(vec2.sum { |x| x**2 })
  dot_product / (magnitude1 * magnitude2)
end
```

### Understanding Memory Paths and Metadata

#### Memory Path Structure

SwarmMemory uses a **4-category organizational convention** established in the tool descriptions. All memory tools expect paths to start with one of these categories:

1. **concept/** - Abstract ideas and principles (e.g., `concept/ruby/classes.md`)
2. **fact/** - Concrete information (e.g., `fact/people/john-smith.md`)
3. **skill/** - How-to procedures (e.g., `skill/debugging/api-errors.md`)
4. **experience/** - Lessons learned (e.g., `experience/fixed-cors-bug.md`)

**Important:** Your adapter should NOT enforce these categories. `PathNormalizer` validates path safety (no `..`, no absolute paths, no special chars) but does NOT enforce categories. The categories are a **convention** enforced by tool descriptions, not by the storage layer. Your adapter can technically store any hierarchical path structure.

#### Metadata Structure

When `write()` is called, the `metadata` parameter contains a hash with these fields:

```ruby
{
  "type" => "concept",           # Category: concept, fact, skill, experience
  "confidence" => "high",         # Certainty: high, medium, low
  "tags" => ["ruby", "oop"],     # Array of search keywords
  "related" => ["memory://concept/ruby/modules.md"], # Related entries
  "domain" => "programming/ruby", # Subcategory/domain
  "source" => "user",            # Origin: user, documentation, experimentation, inference
  "tools" => ["Read", "Edit"],   # (Skills only) Required tools
  "permissions" => {}            # (Skills only) Tool restrictions
}
```

**Important:** Always use string keys (not symbols) for metadata to ensure clean YAML serialization.

#### Embeddings

When embeddings are enabled, the `write()` method receives an `embedding` parameter:

- **Type:** `Array<Float>` with 384 dimensions (default model)
- **Source:** Generated by `SwarmMemory::Embeddings::InformersEmbedder` from searchable text
- **Searchable text:** Composed of title + tags + domain + first paragraph (capped at 1200 chars by default, configurable via `SWARM_MEMORY_EMBEDDING_MAX_CHARS` env var, or -1 for unlimited)
- **Purpose:** Enable semantic search - find memories by meaning, not just keywords

You should store embeddings efficiently (e.g., binary format) and implement `semantic_search` to enable this powerful feature.

## Creating Your First Adapter

Let's create a simple **in-memory adapter** as a learning exercise. This adapter stores everything in Ruby hashes and arrays.

### Step 1: Create the File

Create `lib/swarm_memory/adapters/memory_adapter.rb`:

```ruby
# frozen_string_literal: true

module SwarmMemory
  module Adapters
    # In-memory adapter for testing and development
    # WARNING: All data is lost when process exits
    class MemoryAdapter < Base
      def initialize
        super()
        @entries = {}  # Hash of file_path => Entry
        @total_size = 0
      end

      def write(file_path:, content:, title:, embedding: nil, metadata: nil)
        raise ArgumentError, "file_path is required" if file_path.nil? || file_path.empty?
        raise ArgumentError, "content is required" if content.nil?
        raise ArgumentError, "title is required" if title.nil? || title.empty?

        # Calculate size
        content_size = content.bytesize

        # Check size limits
        if content_size > MAX_ENTRY_SIZE
          raise ArgumentError, "Content exceeds maximum size (#{format_bytes(MAX_ENTRY_SIZE)}). " \
            "Current: #{format_bytes(content_size)}"
        end

        # Calculate new total size
        existing_size = @entries[file_path]&.size || 0
        new_total_size = @total_size - existing_size + content_size

        # Check total size limit
        if new_total_size > MAX_TOTAL_SIZE
          raise ArgumentError, "Memory storage full (#{format_bytes(MAX_TOTAL_SIZE)} limit). " \
            "Current: #{format_bytes(@total_size)}, " \
            "Would be: #{format_bytes(new_total_size)}"
        end

        # Create entry
        entry = Core::Entry.new(
          content: content,
          title: title,
          updated_at: Time.now,
          size: content_size,
          embedding: embedding,
          metadata: metadata
        )

        # Store entry
        @entries[file_path] = entry
        @total_size = new_total_size

        entry
      end

      def read(file_path:)
        raise ArgumentError, "file_path is required" if file_path.nil? || file_path.empty?

        entry = @entries[file_path]
        raise ArgumentError, "memory://#{file_path} not found" if entry.nil?

        entry.content
      end

      def read_entry(file_path:)
        raise ArgumentError, "file_path is required" if file_path.nil? || file_path.empty?

        entry = @entries[file_path]
        raise ArgumentError, "memory://#{file_path} not found" if entry.nil?

        entry
      end

      def delete(file_path:)
        raise ArgumentError, "file_path is required" if file_path.nil? || file_path.empty?

        entry = @entries[file_path]
        raise ArgumentError, "memory://#{file_path} not found" if entry.nil?

        @total_size -= entry.size
        @entries.delete(file_path)
      end

      def list(prefix: nil)
        entries = @entries.select { |path, _| prefix.nil? || path.start_with?(prefix) }

        entries.map do |path, entry|
          {
            path: path,
            title: entry.title,
            size: entry.size,
            updated_at: entry.updated_at
          }
        end.sort_by { |e| e[:path] }
      end

      def glob(pattern:)
        raise ArgumentError, "pattern is required" if pattern.nil? || pattern.empty?

        # Convert glob pattern to regex using helper method from Base
        regex = glob_to_regex(pattern)

        # Filter entries matching the pattern
        results = @entries.select { |path, _| regex.match?(path) }

        results.map do |path, entry|
          {
            path: path,
            title: entry.title,
            size: entry.size,
            updated_at: entry.updated_at
          }
        end.sort_by { |e| -e[:updated_at].to_f }  # Most recent first
      end

      def grep(pattern:, case_insensitive: false, output_mode: "files_with_matches", path: nil)
        raise ArgumentError, "pattern is required" if pattern.nil? || pattern.empty?

        # Create regex
        flags = case_insensitive ? Regexp::IGNORECASE : 0
        regex = Regexp.new(pattern, flags)

        # Filter by path prefix if specified
        entries = @entries.select do |entry_path, _|
          path.nil? || entry_path.start_with?(path)
        end

        case output_mode
        when "files_with_matches"
          # Return paths that match
          entries.select { |_, entry| regex.match?(entry.content) }
            .keys
            .sort
        when "content"
          # Return paths with matching lines
          results = []
          entries.each do |entry_path, entry|
            matching_lines = []
            entry.content.each_line.with_index(1) do |line, line_num|
              if regex.match?(line)
                matching_lines << { line_number: line_num, content: line.chomp }
              end
            end

            unless matching_lines.empty?
              results << { path: entry_path, matches: matching_lines }
            end
          end
          results
        when "count"
          # Return paths with match counts
          results = []
          entries.each do |entry_path, entry|
            count = entry.content.scan(regex).size
            results << { path: entry_path, count: count } if count > 0
          end
          results
        else
          raise ArgumentError, "Invalid output_mode: #{output_mode}"
        end
      end

      def clear
        @entries = {}
        @total_size = 0
      end

      attr_reader :total_size

      def size
        @entries.size
      end
    end
  end
end
```

### Step 2: Understanding the Code

Let's break down the key parts:

1. **Initialization**: We create empty data structures (`@entries` hash, `@total_size` counter)

2. **Size Enforcement**: The `write` method checks both per-entry and total size limits

3. **Error Handling**: We raise `ArgumentError` with descriptive messages when paths aren't found

4. **List vs Glob vs Grep**:
   - `list`: Simple prefix filtering (used internally by MemoryDefrag, not exposed to agents)
   - `glob`: Pattern matching with wildcards (`*`, `**`) - what agents use for browsing
   - `grep`: Content search with regex - what agents use for searching inside content

5. **Helper Methods**: We use `glob_to_regex` from `Base` class to convert glob patterns

## Advanced Example: Redis Adapter

Now let's create a more realistic adapter using Redis as the storage backend.

```ruby
# frozen_string_literal: true

require 'redis'
require 'json'

module SwarmMemory
  module Adapters
    # Redis adapter for distributed memory storage
    #
    # Data structure:
    #   memory:entries:<file_path> => Entry data (JSON)
    #   memory:content:<file_path> => Content (String)
    #   memory:embedding:<file_path> => Embedding (Array as JSON)
    #   memory:paths => Sorted set of all paths (for listing)
    #   memory:total_size => Total storage size counter
    class RedisAdapter < Base
      # Redis key prefixes
      KEY_ENTRY = "memory:entries:"
      KEY_CONTENT = "memory:content:"
      KEY_EMBEDDING = "memory:embedding:"
      KEY_PATHS = "memory:paths"
      KEY_TOTAL_SIZE = "memory:total_size"

      def initialize(redis_url: nil, redis: nil)
        super()
        @redis = redis || Redis.new(url: redis_url || ENV['REDIS_URL'] || 'redis://localhost:6379')

        # Initialize total size counter if not exists
        @redis.setnx(KEY_TOTAL_SIZE, 0)
      end

      def write(file_path:, content:, title:, embedding: nil, metadata: nil)
        raise ArgumentError, "file_path is required" if file_path.nil? || file_path.empty?
        raise ArgumentError, "content is required" if content.nil?
        raise ArgumentError, "title is required" if title.nil? || title.empty?

        content_size = content.bytesize

        # Check size limits
        if content_size > MAX_ENTRY_SIZE
          raise ArgumentError, "Content exceeds maximum size (#{format_bytes(MAX_ENTRY_SIZE)})"
        end

        # Get existing size for this entry
        existing_entry_json = @redis.get("#{KEY_ENTRY}#{file_path}")
        existing_size = if existing_entry_json
          JSON.parse(existing_entry_json)['size']
        else
          0
        end

        # Check total size
        current_total = @redis.get(KEY_TOTAL_SIZE).to_i
        new_total = current_total - existing_size + content_size

        if new_total > MAX_TOTAL_SIZE
          raise ArgumentError, "Memory storage full (#{format_bytes(MAX_TOTAL_SIZE)} limit)"
        end

        # Use Redis transaction for atomicity
        @redis.multi do |transaction|
          # Store content
          transaction.set("#{KEY_CONTENT}#{file_path}", content)

          # Store embedding if provided
          if embedding
            transaction.set("#{KEY_EMBEDDING}#{file_path}", embedding.to_json)
          end

          # Store entry metadata
          entry_data = {
            title: title,
            size: content_size,
            updated_at: Time.now.iso8601,
            metadata: metadata
          }
          transaction.set("#{KEY_ENTRY}#{file_path}", entry_data.to_json)

          # Add to paths sorted set (score is timestamp for sorting)
          transaction.zadd(KEY_PATHS, Time.now.to_f, file_path)

          # Update total size
          transaction.set(KEY_TOTAL_SIZE, new_total)
        end

        # Return entry object
        Core::Entry.new(
          content: content,
          title: title,
          updated_at: Time.now,
          size: content_size,
          embedding: embedding,
          metadata: metadata
        )
      end

      def read(file_path:)
        raise ArgumentError, "file_path is required" if file_path.nil? || file_path.empty?

        content = @redis.get("#{KEY_CONTENT}#{file_path}")
        raise ArgumentError, "memory://#{file_path} not found" if content.nil?

        content
      end

      def read_entry(file_path:)
        raise ArgumentError, "file_path is required" if file_path.nil? || file_path.empty?

        # Get all data in pipeline for efficiency
        content, entry_json, embedding_json = @redis.pipelined do |pipeline|
          pipeline.get("#{KEY_CONTENT}#{file_path}")
          pipeline.get("#{KEY_ENTRY}#{file_path}")
          pipeline.get("#{KEY_EMBEDDING}#{file_path}")
        end

        raise ArgumentError, "memory://#{file_path} not found" if content.nil?

        entry_data = JSON.parse(entry_json)
        embedding = embedding_json ? JSON.parse(embedding_json) : nil

        Core::Entry.new(
          content: content,
          title: entry_data['title'],
          updated_at: Time.parse(entry_data['updated_at']),
          size: entry_data['size'],
          embedding: embedding,
          metadata: entry_data['metadata']
        )
      end

      def delete(file_path:)
        raise ArgumentError, "file_path is required" if file_path.nil? || file_path.empty?

        # Get size before deletion
        entry_json = @redis.get("#{KEY_ENTRY}#{file_path}")
        raise ArgumentError, "memory://#{file_path} not found" if entry_json.nil?

        entry_data = JSON.parse(entry_json)
        entry_size = entry_data['size']

        # Delete all keys in transaction
        @redis.multi do |transaction|
          transaction.del("#{KEY_CONTENT}#{file_path}")
          transaction.del("#{KEY_ENTRY}#{file_path}")
          transaction.del("#{KEY_EMBEDDING}#{file_path}")
          transaction.zrem(KEY_PATHS, file_path)
          transaction.decrby(KEY_TOTAL_SIZE, entry_size)
        end
      end

      def list(prefix: nil)
        # Get all paths from sorted set
        paths = @redis.zrange(KEY_PATHS, 0, -1)

        # Filter by prefix if specified
        paths = paths.select { |path| path.start_with?(prefix) } if prefix

        # Get metadata for each path
        results = paths.map do |path|
          entry_json = @redis.get("#{KEY_ENTRY}#{path}")
          next unless entry_json

          entry_data = JSON.parse(entry_json)
          {
            path: path,
            title: entry_data['title'],
            size: entry_data['size'],
            updated_at: Time.parse(entry_data['updated_at'])
          }
        end.compact

        results.sort_by { |e| e[:path] }
      end

      def glob(pattern:)
        raise ArgumentError, "pattern is required" if pattern.nil? || pattern.empty?

        regex = glob_to_regex(pattern)
        paths = @redis.zrange(KEY_PATHS, 0, -1)

        # Filter by pattern
        matching_paths = paths.select { |path| regex.match?(path) }

        # Get metadata
        results = matching_paths.map do |path|
          entry_json = @redis.get("#{KEY_ENTRY}#{path}")
          next unless entry_json

          entry_data = JSON.parse(entry_json)
          {
            path: path,
            title: entry_data['title'],
            size: entry_data['size'],
            updated_at: Time.parse(entry_data['updated_at'])
          }
        end.compact

        # Sort by most recent first
        results.sort_by { |e| -e[:updated_at].to_f }
      end

      def grep(pattern:, case_insensitive: false, output_mode: "files_with_matches", path: nil)
        raise ArgumentError, "pattern is required" if pattern.nil? || pattern.empty?

        flags = case_insensitive ? Regexp::IGNORECASE : 0
        regex = Regexp.new(pattern, flags)

        # Get all paths
        paths = @redis.zrange(KEY_PATHS, 0, -1)

        # Filter by path prefix if specified
        paths = paths.select { |p| p.start_with?(path) } if path

        case output_mode
        when "files_with_matches"
          paths.select do |file_path|
            content = @redis.get("#{KEY_CONTENT}#{file_path}")
            content && regex.match?(content)
          end.sort
        when "content"
          results = []
          paths.each do |file_path|
            content = @redis.get("#{KEY_CONTENT}#{file_path}")
            next unless content

            matching_lines = []
            content.each_line.with_index(1) do |line, line_num|
              if regex.match?(line)
                matching_lines << { line_number: line_num, content: line.chomp }
              end
            end

            results << { path: file_path, matches: matching_lines } unless matching_lines.empty?
          end
          results
        when "count"
          results = []
          paths.each do |file_path|
            content = @redis.get("#{KEY_CONTENT}#{file_path}")
            next unless content

            count = content.scan(regex).size
            results << { path: file_path, count: count } if count > 0
          end
          results
        else
          raise ArgumentError, "Invalid output_mode: #{output_mode}"
        end
      end

      def clear
        # Get all paths
        paths = @redis.zrange(KEY_PATHS, 0, -1)

        # Delete all keys
        @redis.multi do |transaction|
          paths.each do |path|
            transaction.del("#{KEY_CONTENT}#{path}")
            transaction.del("#{KEY_ENTRY}#{path}")
            transaction.del("#{KEY_EMBEDDING}#{path}")
          end
          transaction.del(KEY_PATHS)
          transaction.set(KEY_TOTAL_SIZE, 0)
        end
      end

      def total_size
        @redis.get(KEY_TOTAL_SIZE).to_i
      end

      def size
        @redis.zcard(KEY_PATHS)
      end

      # Optional: Semantic search using embeddings
      def semantic_search(embedding:, top_k: 10, threshold: 0.0)
        paths = @redis.zrange(KEY_PATHS, 0, -1)
        results = []

        paths.each do |path|
          embedding_json = @redis.get("#{KEY_EMBEDDING}#{path}")
          next unless embedding_json

          entry_embedding = JSON.parse(embedding_json)
          similarity = cosine_similarity(embedding, entry_embedding)
          next if similarity < threshold

          entry_json = @redis.get("#{KEY_ENTRY}#{path}")
          entry_data = JSON.parse(entry_json)

          results << {
            path: path,
            similarity: similarity,
            title: entry_data['title'],
            size: entry_data['size'],
            updated_at: Time.parse(entry_data['updated_at']),
            metadata: entry_data['metadata']
          }
        end

        # Sort by similarity descending, return top K
        results.sort_by { |r| -r[:similarity] }.take(top_k)
      end

      private

      def cosine_similarity(a, b)
        dot_product = a.zip(b).sum { |x, y| x * y }
        magnitude_a = Math.sqrt(a.sum { |x| x**2 })
        magnitude_b = Math.sqrt(b.sum { |x| x**2 })
        dot_product / (magnitude_a * magnitude_b)
      end
    end
  end
end
```

### Key Features of the Redis Adapter

1. **Distributed Storage**: Multiple processes/machines can share the same memory
2. **Transactions**: Uses Redis `MULTI/EXEC` for atomic operations
3. **Efficient Queries**: Uses sorted sets and pipelining
4. **Persistence**: Data survives process restarts (if Redis is configured for persistence)

## Registering and Using Your Adapter

### Step 1: Register the Adapter

In your application initialization (e.g., `config/initializers/swarm_memory.rb` for Rails):

```ruby
require 'swarm_memory'
require_relative 'lib/swarm_memory/adapters/redis_adapter'

# Register the adapter
SwarmMemory.register_adapter(:redis, SwarmMemory::Adapters::RedisAdapter)
```

### Step 2: Use in SwarmSDK Configuration

**YAML Configuration** (`.swarm` file):

```yaml
version: 2
agents:
  researcher:
    model: claude-sonnet-4
    instructions: |
      You are a research assistant.
    memory:
      adapter: redis
      redis_url: redis://localhost:6379
```

**Ruby DSL**:

```ruby
require 'swarm_sdk'

swarm = SwarmSDK::Builder.build do
  agent :researcher do
    model 'claude-sonnet-4'
    instructions 'You are a research assistant.'

    # Use Redis adapter
    memory do
      adapter :redis
      option :redis_url, 'redis://localhost:6379'
    end

    tools :MemoryWrite, :MemoryRead, :MemoryGrep
  end
end
```

### Step 3: Verify It Works

```ruby
# Start a chat
chat = swarm.chat(:researcher)

# The agent can now use memory tools with Redis backend
response = chat.send_message(
  "Remember: Ruby blocks are closures that capture local variables."
)
```

## Understanding the Storage Layer

Before diving into best practices, it's crucial to understand what the `Storage` layer does so you don't duplicate work in your adapter:

### What Storage Does (so you don't have to)

**Path Normalization:**
- `Storage` uses `PathNormalizer.normalize()` before calling your adapter
- You receive pre-validated, normalized paths
- Don't validate path structure in your adapter

**Embedding Generation:**
- `Storage` generates embeddings using `Embedder` before calling `write()`
- You receive ready-to-store embedding vectors
- Don't generate embeddings in your adapter

**Searchable Text Building:**
- `Storage` constructs searchable text (title + tags + domain + first paragraph)
- This text is embedded, not the full content (capped at 1200 chars by default, configurable via `SWARM_MEMORY_EMBEDDING_MAX_CHARS`)
- You just store the embedding vector

**Stub Redirects:**
- `Storage.read_entry()` automatically follows stub redirects
- Stubs are created by `MemoryDefrag` tool
- Your adapter just reads/writes normally

### What Your Adapter Must Do

**Persistence:**
- Store and retrieve content, metadata, and embeddings
- Enforce size limits (MAX_ENTRY_SIZE, MAX_TOTAL_SIZE)
- Handle concurrent access safely

**Search Operations:**
- Implement `glob()` for pattern matching (used by agents via MemoryGlob tool)
- Implement `grep()` for content search (used by agents via MemoryGrep tool)
- Implement `list()` for enumeration (used internally by MemoryDefrag, not exposed to agents)
- Optionally implement `semantic_search()` for embedding similarity
- Optionally implement `all_entries()` for defragmentation support

**Data Integrity:**
- Ensure atomic writes (use transactions if available)
- Maintain accurate `total_size` and `size` counts
- Clean up all related data on `delete()`

## Best Practices

### 1. Thread/Process Safety

If your adapter will be used in multi-threaded or multi-process environments:

```ruby
# Use locks, transactions, or atomic operations
def write(file_path:, content:, title:, **kwargs)
  @mutex.synchronize do
    # Your write logic here
  end
end
```

### 2. Connection Management

For database/network-backed adapters, handle connections gracefully:

```ruby
def initialize(connection_string:)
  @connection_pool = ConnectionPool.new(size: 5) do
    Database.connect(connection_string)
  end
end

def read(file_path:)
  @connection_pool.with do |conn|
    conn.query("SELECT content FROM memories WHERE path = ?", file_path)
  end
end
```

### 3. Error Handling

Always provide clear error messages:

```ruby
def read(file_path:)
  result = @db.query("SELECT content FROM memories WHERE path = ?", file_path)

  if result.empty?
    raise ArgumentError, "memory://#{file_path} not found"
  end

  result.first['content']
rescue DatabaseError => e
  raise SwarmMemory::StorageError, "Failed to read from database: #{e.message}"
end
```

### 4. Performance Optimization

- Use batch operations when possible
- Implement caching for frequently accessed entries
- Use database indexes for path lookups and pattern matching
- Consider lazy-loading large content

```ruby
# Good: Batch fetch metadata
def list(prefix: nil)
  query = "SELECT path, title, size, updated_at FROM memories"
  query += " WHERE path LIKE ?" if prefix

  @db.query(query, "#{prefix}%")
end

# Bad: N+1 queries
def list(prefix: nil)
  paths = @db.query("SELECT path FROM memories")
  paths.map do |path|
    entry = read_entry(file_path: path)  # Separate query for each!
    # ...
  end
end
```

### 5. Size Limit Enforcement

Always check both limits:

```ruby
def write(file_path:, content:, title:, **kwargs)
  content_size = content.bytesize

  # Check per-entry limit
  if content_size > MAX_ENTRY_SIZE
    raise ArgumentError, "Content exceeds maximum size (#{format_bytes(MAX_ENTRY_SIZE)})"
  end

  # Check total storage limit
  new_total = calculate_new_total(file_path, content_size)
  if new_total > MAX_TOTAL_SIZE
    raise ArgumentError, "Memory storage full (#{format_bytes(MAX_TOTAL_SIZE)} limit)"
  end

  # Proceed with write...
end
```

### 6. Working with Embeddings

If implementing `semantic_search`, store embeddings efficiently:

```ruby
# Good: Binary storage (FilesystemAdapter approach)
def write(file_path:, content:, title:, embedding: nil, **kwargs)
  # Store embedding separately in efficient binary format
  if embedding
    emb_file = embedding_path_for(file_path)
    File.write(emb_file, embedding.pack("f*"))  # 32-bit floats
  end
  # ... rest of write logic
end

def read_embedding(file_path)
  emb_file = embedding_path_for(file_path)
  return nil unless File.exist?(emb_file)

  File.read(emb_file).unpack("f*")
end

# For semantic_search, compare efficiently
def semantic_search(embedding:, top_k:, threshold:)
  results = []

  all_paths.each do |path|
    entry_emb = read_embedding(path)
    next unless entry_emb

    similarity = cosine_similarity(embedding, entry_emb)
    next if similarity < threshold

    results << build_result(path, similarity)
  end

  results.sort_by { |r| -r[:similarity] }.take(top_k)
end
```

**Embedding storage tips:**
- **For production**: Use a vector database (pgvector, Qdrant, Pinecone, Milvus, Chroma) with native similarity search support
- **For simple cases**: Use binary format to save space (384 floats = 1.5KB vs 8KB+ as JSON)
- Consider approximate nearest neighbor (ANN) algorithms for large datasets (most vector DBs provide this)
- Cache frequently accessed embeddings in memory
- Vector databases handle indexing, similarity search, and scaling automatically

### 7. Testing with Real Storage

Test with actual backend instances:

```ruby
RSpec.describe SwarmMemory::Adapters::RedisAdapter do
  let(:redis) { Redis.new(url: ENV['TEST_REDIS_URL']) }
  let(:adapter) { described_class.new(redis: redis) }

  before do
    redis.flushdb  # Clean slate for each test
  end

  it "stores and retrieves content" do
    adapter.write(
      file_path: "test.md",
      content: "Hello",
      title: "Test"
    )

    expect(adapter.read(file_path: "test.md")).to eq("Hello")
  end
end
```

## Testing Your Adapter

Create comprehensive tests covering all interface methods:

```ruby
# test/adapters/redis_adapter_test.rb
require 'test_helper'

module SwarmMemory
  module Adapters
    class RedisAdapterTest < Minitest::Test
      def setup
        @redis = Redis.new(url: ENV['TEST_REDIS_URL'] || 'redis://localhost:6379')
        @redis.flushdb
        @adapter = RedisAdapter.new(redis: @redis)
      end

      def teardown
        @redis.flushdb
        @redis.quit
      end

      def test_write_and_read
        entry = @adapter.write(
          file_path: "concepts/ruby/blocks.md",
          content: "Ruby blocks are closures",
          title: "Ruby Blocks"
        )

        assert_equal "Ruby blocks are closures", entry.content
        assert_equal "Ruby Blocks", entry.title
        assert_equal 24, entry.size

        content = @adapter.read(file_path: "concepts/ruby/blocks.md")
        assert_equal "Ruby blocks are closures", content
      end

      def test_read_nonexistent_raises_error
        assert_raises(ArgumentError) do
          @adapter.read(file_path: "nonexistent.md")
        end
      end

      def test_delete
        @adapter.write(
          file_path: "test.md",
          content: "Test content",
          title: "Test"
        )

        @adapter.delete(file_path: "test.md")

        assert_raises(ArgumentError) do
          @adapter.read(file_path: "test.md")
        end
      end

      def test_list_with_prefix
        @adapter.write(file_path: "concepts/ruby.md", content: "Ruby", title: "Ruby")
        @adapter.write(file_path: "concepts/python.md", content: "Python", title: "Python")
        @adapter.write(file_path: "facts/history.md", content: "History", title: "History")

        results = @adapter.list(prefix: "concepts/")
        assert_equal 2, results.size
        assert_equal ["concepts/python.md", "concepts/ruby.md"], results.map { |r| r[:path] }.sort
      end

      def test_glob_pattern
        @adapter.write(file_path: "concepts/ruby/blocks.md", content: "Blocks", title: "Blocks")
        @adapter.write(file_path: "concepts/ruby/procs.md", content: "Procs", title: "Procs")
        @adapter.write(file_path: "facts/ruby.md", content: "Facts", title: "Facts")

        results = @adapter.glob(pattern: "concepts/**/*.md")
        assert_equal 2, results.size
        assert_includes results.map { |r| r[:path] }, "concepts/ruby/blocks.md"
        assert_includes results.map { |r| r[:path] }, "concepts/ruby/procs.md"
      end

      def test_grep_content
        @adapter.write(file_path: "doc1.md", content: "Ruby is great", title: "Doc 1")
        @adapter.write(file_path: "doc2.md", content: "Python is also great", title: "Doc 2")

        results = @adapter.grep(pattern: "Ruby", output_mode: "files_with_matches")
        assert_equal ["doc1.md"], results
      end

      def test_size_limits
        # Test max entry size
        large_content = "x" * (SwarmMemory::Adapters::Base::MAX_ENTRY_SIZE + 1)

        assert_raises(ArgumentError, /exceeds maximum size/) do
          @adapter.write(
            file_path: "large.md",
            content: large_content,
            title: "Too large"
          )
        end
      end

      def test_total_size
        @adapter.write(file_path: "doc1.md", content: "Hello", title: "Doc 1")
        @adapter.write(file_path: "doc2.md", content: "World", title: "Doc 2")

        assert_equal 10, @adapter.total_size
      end

      def test_semantic_search
        embedding1 = Array.new(384) { rand }
        embedding2 = Array.new(384) { rand }

        @adapter.write(
          file_path: "doc1.md",
          content: "Content 1",
          title: "Doc 1",
          embedding: embedding1
        )

        @adapter.write(
          file_path: "doc2.md",
          content: "Content 2",
          title: "Doc 2",
          embedding: embedding2
        )

        # Search with same embedding as doc1
        results = @adapter.semantic_search(embedding: embedding1, top_k: 1)

        assert_equal 1, results.size
        assert_equal "doc1.md", results.first[:path]
        assert results.first[:similarity] > 0.99  # Should be nearly 1.0
      end
    end
  end
end
```

## Common Pitfalls and FAQ

### Q: Should I validate paths in my adapter?

**No.** The `Storage` layer uses `PathNormalizer.normalize()` before calling your adapter. You'll always receive clean, validated paths.

### Q: Should I generate embeddings in my adapter?

**No.** The `Storage` layer generates embeddings using `Embedder` before calling `write()`. You just store the vectors you receive.

### Q: Do I need to handle frontmatter in content?

**No.** Content is stored as-is (pure markdown). Metadata comes separately in the `metadata` parameter. Tools handle metadata extraction and formatting.

### Q: Should my adapter follow stub redirects?

**No.** The `Storage.read_entry()` method automatically follows stubs. Your adapter reads/writes entries normally without special stub handling.

### Q: What if my backend doesn't support glob patterns?

Use the `glob_to_regex()` helper from the `Base` class to convert glob patterns to regex, then filter in memory:

```ruby
def glob(pattern:)
  regex = glob_to_regex(pattern)  # Converts "**/*.md" to regex
  all_entries.select { |path, _| regex.match?(path) }
end
```

### Q: How should I handle `grep` output modes?

There are three output modes:

```ruby
case output_mode
when "files_with_matches"
  # Return array of matching paths (strings)
  ["concept/ruby/blocks.md", "skill/testing/minitest.md"]

when "content"
  # Return array of hashes with path and matching lines
  [
    {
      path: "concept/ruby/blocks.md",
      matches: [
        { line_number: 5, content: "Ruby blocks are closures" },
        { line_number: 12, content: "block_given?" }
      ]
    }
  ]

when "count"
  # Return array of hashes with path and match count
  [
    { path: "concept/ruby/blocks.md", count: 3 },
    { path: "skill/testing/minitest.md", count: 1 }
  ]
end
```

### Q: Should I use symbols or strings for metadata keys?

**Always use strings.** This ensures clean YAML serialization. The `SwarmMemory::Utils.stringify_keys()` helper can convert recursively:

```ruby
metadata = { type: "concept", tags: ["ruby"] }
metadata = SwarmMemory::Utils.stringify_keys(metadata)
# => { "type" => "concept", "tags" => ["ruby"] }
```

### Q: How do I debug my adapter?

1. **Test with small data first:** Start with 1-2 entries
2. **Check Storage integration:** Use `Storage.new(adapter: your_adapter)` and call methods
3. **Enable logging:** Add debug output to see what's being called
4. **Compare with FilesystemAdapter:** Look at how it handles edge cases

### Q: Do I need to implement `all_entries`?

**It depends.** The `all_entries` method is optional for basic memory operations, but **required if you want the MemoryDefrag tool to work**. MemoryDefrag uses `all_entries` for:
- Analyzing memory health
- Finding duplicates
- Detecting low-quality entries
- Identifying archival candidates

If you don't implement it, basic memory tools (Write, Read, Edit, Delete, Glob, Grep) will work fine, but MemoryDefrag will fail.

**Simple implementation:**
```ruby
def all_entries
  entries = {}
  list.each do |item|
    entries[item[:path]] = read_entry(file_path: item[:path])
  end
  entries
end
```

### Q: Why implement `list()` if agents can't call it?

**Good question!** The `list()` method is NOT exposed as a tool for agents, but it's **required internally** by:

1. **MemoryDefrag** - Uses `list()` to enumerate entries for analysis
2. **Your own `all_entries` implementation** - Common pattern is to call `list()` then load each entry

Agents use **MemoryGlob** for browsing/discovery instead:
```ruby
# Agent perspective:
MemoryGlob(pattern: "concept/**/*.md")  # Browse all concepts
MemoryGlob(pattern: "skill/*/debug-*.md")  # Specific pattern matching

# Internal usage (not visible to agents):
adapter.list(prefix: "concept/")  # Used by MemoryDefrag
```

So yes, you must implement `list()` even though it's not agent-facing!

### Helper Methods from Base Class

Your adapter inherits these useful helpers from `SwarmMemory::Adapters::Base`:

```ruby
# Convert bytes to human-readable format
format_bytes(1500)      # => "1.5KB"
format_bytes(3_000_000) # => "3.0MB"

# Convert glob pattern to regex
regex = glob_to_regex("concepts/**/*.md")
regex.match?("concepts/ruby/classes.md")  # => true

# Size limit constants
MAX_ENTRY_SIZE  # => 3_000_000 (3MB)
MAX_TOTAL_SIZE  # => 100_000_000_000 (100GB)
```

## Next Steps

Now that you understand how to create adapters, you can:

1. **Explore the FilesystemAdapter** source code for a production-ready example
2. **Create adapters for your infrastructure**: PostgreSQL, MongoDB, Elasticsearch, etc.
3. **Add custom indexing**: Full-text search, vector databases, specialized queries
4. **Optimize for your use case**: Caching, compression, encryption, etc.

## Quick Reference: Adapter Interface

Here's a complete quick reference for implementing a custom adapter:

```ruby
module SwarmMemory
  module Adapters
    class YourAdapter < Base
      # REQUIRED METHODS

      # Initialize your adapter
      def initialize(**options)
        super()
        # Setup your backend connection
      end

      # Write entry with content, metadata, and optional embedding
      # @return [Core::Entry] Created entry
      def write(file_path:, content:, title:, embedding: nil, metadata: nil)
        # 1. Check content size <= MAX_ENTRY_SIZE
        # 2. Check total size <= MAX_TOTAL_SIZE
        # 3. Store content, metadata, embedding
        # 4. Update @total_size
        # 5. Return Core::Entry.new(...)
      end

      # Read content only
      # @return [String]
      def read(file_path:)
        # Raise ArgumentError if not found
      end

      # Read full entry with metadata
      # @return [Core::Entry]
      def read_entry(file_path:)
        # Raise ArgumentError if not found
      end

      # Delete entry
      # @return [void]
      def delete(file_path:)
        # Update @total_size
        # Raise ArgumentError if not found
      end

      # List all entries (optionally filtered)
      # @return [Array<Hash>] with keys: :path, :title, :size, :updated_at
      def list(prefix: nil)
      end

      # Search by glob pattern
      # @return [Array<Hash>] sorted by most recent first
      def glob(pattern:)
        # Use glob_to_regex(pattern) helper if needed
      end

      # Search content by regex
      # @return [Array] format depends on output_mode
      def grep(pattern:, case_insensitive: false, output_mode: "files_with_matches", path: nil)
        # See FAQ section for output mode formats
      end

      # Clear all entries
      # @return [void]
      def clear
      end

      # Get total storage size in bytes
      # @return [Integer]
      def total_size
      end

      # Get number of entries
      # @return [Integer]
      def size
      end

      # OPTIONAL METHODS

      # Semantic search by embedding similarity (recommended for semantic memory)
      # @return [Array<Hash>] with keys: :path, :similarity, :title, :size, :updated_at, :metadata
      def semantic_search(embedding:, top_k: 10, threshold: 0.0)
        # Use cosine_similarity helper
      end

      # Get all entries (REQUIRED if you want MemoryDefrag tool to work)
      # Used by defragmentation, duplicate detection, and quality analysis
      # @return [Hash<String, Core::Entry>] mapping file_path => Entry
      def all_entries
        # Return hash of all entries
        # Can be implemented by iterating list() and calling read_entry() for each
      end

      private

      # Helper: Calculate cosine similarity (if implementing semantic_search)
      def cosine_similarity(vec1, vec2)
        dot_product = vec1.zip(vec2).sum { |a, b| a * b }
        magnitude1 = Math.sqrt(vec1.sum { |x| x**2 })
        magnitude2 = Math.sqrt(vec2.sum { |x| x**2 })
        dot_product / (magnitude1 * magnitude2)
      end
    end
  end
end
```

**Remember:**
- Paths come pre-normalized from `Storage` layer
- Embeddings come pre-generated from `Storage` layer
- Always use string keys for metadata
- Check size limits: MAX_ENTRY_SIZE (3MB), MAX_TOTAL_SIZE (100GB)
- Use helper methods: `format_bytes()`, `glob_to_regex()`

## Resources

- [SwarmMemory Documentation](../lib/swarm_memory/README.md)
- [SwarmSDK Documentation](../lib/swarm_sdk/README.md)
- [FilesystemAdapter Source](../lib/swarm_memory/adapters/filesystem_adapter.rb)
- [Adapter Base Class](../lib/swarm_memory/adapters/base.rb)
- [Core::Storage Source](../lib/swarm_memory/core/storage.rb) - See how Storage orchestrates adapters
- [Core::Entry Source](../lib/swarm_memory/core/entry.rb) - Data model
- [SemanticIndex Source](../lib/swarm_memory/core/semantic_index.rb) - Hybrid search implementation

## Getting Help

- GitHub Issues: [https://github.com/parruda/claude-swarm/issues](https://github.com/parruda/claude-swarm/issues)
- Discussions: Check the project's GitHub Discussions for Q&A

Happy coding! 🚀
