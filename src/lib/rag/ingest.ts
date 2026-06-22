import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { collections, documents, chunks } from "@/db/schema";
import { chunkMarkdown } from "./chunk";
import { embed } from "@/lib/ollama";
import { extractFile } from "./extract";

/** Find a collection by name, creating it if it does not exist. */
export async function getOrCreateCollection(name: string): Promise<string> {
  const found = await db.execute(
    sql`select id from collections where name = ${name} limit 1`
  );
  const rows = found.rows as { id: string }[];
  if (rows.length) return rows[0].id;
  const inserted = await db
    .insert(collections)
    .values({ name })
    .returning({ id: collections.id });
  return inserted[0].id;
}

export type IngestResult = { skipped: boolean; chunks: number };

export function hashContent(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

/**
 * Core upsert: chunk -> embed -> store, replacing any prior version of the same
 * (collection, source) atomically, and skipping when the content hash is
 * unchanged. Every connector (files, Obsidian, and future ones) funnels through
 * here so retrieval quality stays consistent across sources.
 */
export async function upsertDocument(params: {
  collectionId: string;
  source: string; // stable id, e.g. a file path or vault-relative path
  title: string;
  markdown: string; // content to chunk (already extracted/preprocessed)
  contentHash: string; // hash of the ORIGINAL raw content
  mimeType?: string;
  metadata?: Record<string, unknown>;
}): Promise<IngestResult> {
  const { collectionId, source, title, markdown, contentHash } = params;
  const mimeType = params.mimeType ?? "text/markdown";
  const metadata = params.metadata ?? {};

  const prior = await db.execute(
    sql`select id, content_hash from documents
        where collection_id = ${collectionId} and source = ${source} limit 1`
  );
  const priorRows = prior.rows as { id: string; content_hash: string }[];
  if (priorRows.length && priorRows[0].content_hash === contentHash) {
    return { skipped: true, chunks: 0 };
  }

  const pieces = chunkMarkdown(markdown);
  if (pieces.length === 0) return { skipped: true, chunks: 0 };

  const vectors = await embed(pieces.map((p) => p.content));

  await db.transaction(async (tx) => {
    if (priorRows.length) {
      await tx.execute(sql`delete from documents where id = ${priorRows[0].id}`);
    }
    const [doc] = await tx
      .insert(documents)
      .values({ collectionId, source, title, mimeType, contentHash, metadata })
      .returning({ id: documents.id });

    await tx.insert(chunks).values(
      pieces.map((p, i) => ({
        documentId: doc.id,
        collectionId,
        chunkIndex: p.index,
        sectionPath: p.sectionPath || null,
        content: p.content,
        embedding: vectors[i],
      }))
    );
  });

  return { skipped: false, chunks: pieces.length };
}

/** Remove a document (chunks cascade) by its source. Returns true if removed. */
export async function removeDocument(
  collectionId: string,
  source: string
): Promise<boolean> {
  const res = await db.execute(
    sql`delete from documents where collection_id = ${collectionId} and source = ${source}`
  );
  return (res.rowCount ?? 0) > 0;
}

/** List the sources currently stored for a collection. */
export async function listSources(collectionId: string): Promise<string[]> {
  const res = await db.execute(
    sql`select source from documents where collection_id = ${collectionId}`
  );
  return (res.rows as { source: string }[]).map((r) => r.source);
}

/**
 * Ingest a single file (markdown, mdx, txt, pdf, or docx) from disk. The text is
 * extracted per file type, then chunked, embedded, and stored. Unsupported types
 * are skipped.
 */
export async function ingestFile(
  filePath: string,
  collectionId: string
): Promise<IngestResult> {
  const extracted = await extractFile(filePath);
  if (!extracted) return { skipped: true, chunks: 0 };
  return upsertDocument({
    collectionId,
    source: filePath,
    title: extracted.title,
    markdown: extracted.text,
    contentHash: extracted.contentHash,
    mimeType: extracted.mimeType,
    metadata: extracted.metadata,
  });
}
