import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  jsonb,
  vector,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { EMBEDDING_DIM } from "@/lib/env";

// NOTE: db/init.sql is the source of truth that the Postgres container applies
// on first boot (it also creates the pgvector HNSW index and the tsvector/GIN
// full-text index, which need raw SQL). This schema mirrors it for type-safe
// queries and inserts in the app.

export const collections = pgTable("collections", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    collectionId: uuid("collection_id")
      .notNull()
      .references(() => collections.id, { onDelete: "cascade" }),
    source: text("source").notNull(),
    title: text("title").notNull(),
    mimeType: text("mime_type").notNull().default("text/markdown"),
    contentHash: text("content_hash").notNull(),
    metadata: jsonb("metadata").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [unique("documents_collection_source_uq").on(t.collectionId, t.source)]
);

export const chunks = pgTable(
  "chunks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    collectionId: uuid("collection_id")
      .notNull()
      .references(() => collections.id, { onDelete: "cascade" }),
    chunkIndex: integer("chunk_index").notNull(),
    sectionPath: text("section_path"),
    content: text("content").notNull(),
    embedding: vector("embedding", { dimensions: EMBEDDING_DIM }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("chunks_document_id_idx").on(t.documentId)]
);

export const chats = pgTable("chats", {
  id: uuid("id").primaryKey().defaultRandom(),
  collectionId: uuid("collection_id").references(() => collections.id, {
    onDelete: "set null",
  }),
  title: text("title").notNull().default("New chat"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const messages = pgTable("messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  chatId: uuid("chat_id")
    .notNull()
    .references(() => chats.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  content: text("content").notNull(),
  citations: jsonb("citations").notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
