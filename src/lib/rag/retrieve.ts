import { sql, inArray, eq } from "drizzle-orm";
import { db } from "@/db";
import { chunks, documents } from "@/db/schema";
import { embedOne } from "@/lib/ollama";

export type Retrieved = {
  chunkId: string;
  documentId: string;
  content: string;
  sectionPath: string | null;
  title: string;
  source: string;
  score: number;
};

const CANDIDATES = 20; // pulled from each retriever before fusion
const RRF_K = 60; // Reciprocal Rank Fusion constant (the documented default)

/**
 * Hybrid retrieval: semantic (pgvector) + keyword (Postgres full-text), fused
 * with Reciprocal Rank Fusion. Pure vector search is fuzzy and misses exact
 * terms, pure keyword misses meaning. RRF gives the best of both, which the
 * research identified as the single biggest lever on retrieval quality.
 */
export async function retrieve(
  query: string,
  opts: { collectionId?: string; topK?: number } = {}
): Promise<Retrieved[]> {
  const topK = opts.topK ?? 8;
  const queryVec = await embedOne(query);
  const vecLiteral = `[${queryVec.join(",")}]`;
  const collectionFilter = opts.collectionId
    ? sql`and c.collection_id = ${opts.collectionId}`
    : sql``;

  // Semantic candidates (cosine distance via the pgvector <=> operator).
  const vecRes = await db.execute(sql`
    select c.id
    from chunks c
    where c.embedding is not null ${collectionFilter}
    order by c.embedding <=> ${vecLiteral}::vector
    limit ${CANDIDATES}
  `);

  // Keyword candidates (Postgres full-text search).
  const ftsRes = await db.execute(sql`
    select c.id
    from chunks c
    where c.tsv @@ plainto_tsquery('english', ${query}) ${collectionFilter}
    order by ts_rank(c.tsv, plainto_tsquery('english', ${query})) desc
    limit ${CANDIDATES}
  `);

  const vecRows = vecRes.rows as { id: string }[];
  const ftsRows = ftsRes.rows as { id: string }[];

  // Reciprocal Rank Fusion: score = sum over lists of 1 / (k + rank).
  const scores = new Map<string, number>();
  const fuse = (rows: { id: string }[]) =>
    rows.forEach((row, i) =>
      scores.set(row.id, (scores.get(row.id) ?? 0) + 1 / (RRF_K + i + 1))
    );
  fuse(vecRows);
  fuse(ftsRows);

  const ranked = [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topK);
  if (ranked.length === 0) return [];

  const scoreById = new Map(ranked);
  const ids = ranked.map(([id]) => id);

  // Hydrate the winning chunks with their document title and source.
  const rows = await db
    .select({
      chunkId: chunks.id,
      documentId: chunks.documentId,
      content: chunks.content,
      sectionPath: chunks.sectionPath,
      title: documents.title,
      source: documents.source,
    })
    .from(chunks)
    .innerJoin(documents, eq(documents.id, chunks.documentId))
    .where(inArray(chunks.id, ids));

  return rows
    .map((r) => ({ ...r, score: scoreById.get(r.chunkId) ?? 0 }))
    .sort((a, b) => b.score - a.score);
}
