import type { Retrieved } from "./retrieve";

/**
 * Rerank retrieved chunks by relevance to the query.
 *
 * v0.1: identity pass-through. The hybrid RRF retriever is already a strong
 * baseline. A cross-encoder reranker (bge-reranker via a small model server, or
 * an Ollama reranking model) is the next quality lever and slots in here without
 * touching any caller. Tracked in planning/03-technical-architecture.md.
 */
export async function rerank(
  _query: string,
  results: Retrieved[]
): Promise<Retrieved[]> {
  return results;
}
