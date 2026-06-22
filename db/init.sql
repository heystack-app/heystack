-- heystack database initialization.
-- Applied automatically on first boot of the Postgres container. This is the
-- source of truth for the schema in v0.1. drizzle-kit migrations take over once
-- the schema starts evolving. src/db/schema.ts mirrors this for typed queries.

CREATE EXTENSION IF NOT EXISTS vector;

-- A named group of documents you can scope a chat to.
CREATE TABLE IF NOT EXISTS collections (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  description text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- One ingested file or source.
CREATE TABLE IF NOT EXISTS documents (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id uuid NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  source        text NOT NULL,                 -- file path or URL
  title         text NOT NULL,
  mime_type     text NOT NULL DEFAULT 'text/markdown',
  content_hash  text NOT NULL,                 -- skip re-ingesting unchanged files
  metadata      jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (collection_id, source)
);

-- Retrievable pieces of a document, with a vector and a full-text index.
-- embedding is 768-dim to match nomic-embed-text (see EMBEDDING_DIM).
CREATE TABLE IF NOT EXISTS chunks (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id   uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  collection_id uuid NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  chunk_index   integer NOT NULL,
  section_path  text,                          -- e.g. "Setup > Docker > Compose"
  content       text NOT NULL,
  embedding     vector(768),
  tsv           tsvector GENERATED ALWAYS AS (to_tsvector('english', content)) STORED,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Semantic search index (HNSW, cosine distance).
CREATE INDEX IF NOT EXISTS chunks_embedding_idx
  ON chunks USING hnsw (embedding vector_cosine_ops);

-- Keyword search index (full text).
CREATE INDEX IF NOT EXISTS chunks_tsv_idx ON chunks USING gin (tsv);

CREATE INDEX IF NOT EXISTS chunks_document_id_idx ON chunks (document_id);

-- Chats and their messages.
CREATE TABLE IF NOT EXISTS chats (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id uuid REFERENCES collections(id) ON DELETE SET NULL,
  title         text NOT NULL DEFAULT 'New chat',
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS messages (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id    uuid NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  role       text NOT NULL,                    -- 'user' | 'assistant'
  content    text NOT NULL,
  citations  jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
