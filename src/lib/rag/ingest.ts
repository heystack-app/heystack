import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import matter from "gray-matter";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { collections, documents, chunks } from "@/db/schema";
import { chunkMarkdown } from "./chunk";
import { embed } from "@/lib/ollama";

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

/**
 * Ingest one markdown file: parse frontmatter, chunk, embed, and store.
 * Re-ingesting an unchanged file (same content hash) is a no-op. A changed
 * file replaces its previous chunks atomically.
 */
export async function ingestMarkdownFile(
  filePath: string,
  collectionId: string
): Promise<IngestResult> {
  const raw = await readFile(filePath, "utf8");
  const hash = createHash("sha256").update(raw).digest("hex");

  const prior = await db.execute(
    sql`select id, content_hash from documents
        where collection_id = ${collectionId} and source = ${filePath} limit 1`
  );
  const priorRows = prior.rows as { id: string; content_hash: string }[];
  if (priorRows.length && priorRows[0].content_hash === hash) {
    return { skipped: true, chunks: 0 };
  }

  const parsed = matter(raw);
  const title =
    typeof parsed.data.title === "string" ? parsed.data.title : basename(filePath);
  const pieces = chunkMarkdown(parsed.content);
  if (pieces.length === 0) return { skipped: true, chunks: 0 };

  const vectors = await embed(pieces.map((p) => p.content));

  await db.transaction(async (tx) => {
    if (priorRows.length) {
      await tx.execute(sql`delete from documents where id = ${priorRows[0].id}`);
    }
    const [doc] = await tx
      .insert(documents)
      .values({
        collectionId,
        source: filePath,
        title,
        mimeType: "text/markdown",
        contentHash: hash,
        metadata: parsed.data ?? {},
      })
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
