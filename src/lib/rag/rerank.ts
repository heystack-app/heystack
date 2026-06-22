import type { Retrieved } from "./retrieve";
import { ollama } from "@/lib/ollama";
import { env } from "@/lib/env";

// Force the model to return a clean, parseable ranking.
const RERANK_SCHEMA = {
  type: "object",
  properties: {
    rankings: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "number" },
          score: { type: "number" },
        },
        required: ["id", "score"],
      },
    },
  },
  required: ["rankings"],
} as const;

// How much of each candidate to show the reranker. Enough to judge relevance
// without blowing up the prompt.
const SNIPPET_CHARS = 600;

/**
 * Rerank retrieved chunks by how well each actually answers the question.
 *
 * The hybrid RRF retriever decides WHICH chunks are candidates, but it ranks by
 * term/vector overlap, not by whether a passage truly addresses the question.
 * A cross-encoder reranker closes that gap. Here we use the local LLM as the
 * cross-encoder (pointwise relevance scoring), so it needs no extra model or
 * service. If anything goes wrong it degrades gracefully to the retrieval order.
 */
export async function rerank(
  query: string,
  results: Retrieved[],
  topN: number = results.length
): Promise<Retrieved[]> {
  if (!env.ENABLE_RERANK || results.length <= 1) {
    return results.slice(0, topN);
  }

  try {
    const passages = results
      .map(
        (r, i) =>
          `[${i}] ${r.title}${r.sectionPath ? ` (${r.sectionPath})` : ""}\n` +
          r.content.slice(0, SNIPPET_CHARS)
      )
      .join("\n\n");

    const res = await ollama.chat({
      model: env.RERANK_MODEL ?? env.CHAT_MODEL,
      stream: false,
      format: RERANK_SCHEMA,
      options: { temperature: 0 },
      messages: [
        {
          role: "system",
          content:
            "You rate how well each passage answers the user's question. " +
            "Score every passage from 0 (irrelevant) to 10 (directly answers it). " +
            "Return JSON only.",
        },
        {
          role: "user",
          content:
            `Question: ${query}\n\nPassages:\n${passages}\n\n` +
            `Return {"rankings":[{"id":<passage id>,"score":<0-10>}]} for ALL passages.`,
        },
      ],
    });

    const parsed = JSON.parse(res.message.content) as {
      rankings: { id: number; score: number }[];
    };
    const scoreById = new Map(parsed.rankings.map((r) => [r.id, r.score]));

    return results
      .map((r, i) => ({ r, s: scoreById.get(i) ?? -1 }))
      .sort((a, b) => b.s - a.s)
      .map((x) => x.r)
      .slice(0, topN);
  } catch (err) {
    console.warn("rerank failed, using retrieval order:", err);
    return results.slice(0, topN);
  }
}
