import { retrieve } from "./retrieve";
import { rerank } from "./rerank";
import { chat, type ChatMessage } from "@/lib/ollama";

export type Citation = {
  title: string;
  source: string;
  sectionPath: string | null;
  snippet: string;
};

export type Answer = {
  answer: string;
  citations: Citation[];
};

const SYSTEM_PROMPT = `You are heystack, a private assistant that answers strictly from the user's own notes.
Rules:
- Use ONLY the provided sources to answer. Do not use outside knowledge.
- If the sources do not contain the answer, say so plainly. Do not guess or invent.
- Cite sources inline like [1], [2] matching the numbered sources you used.
- Be concise and direct.`;

/**
 * The full question-answering flow: hybrid retrieve, rerank, ground the model on
 * the retrieved chunks, and return the answer together with its citations. The
 * model is instructed to answer only from the sources, which is what makes the
 * answer trustworthy and verifiable.
 */
// Pull a wider candidate set from retrieval, then let the reranker narrow it to
// the few best passages we actually feed the model.
const CANDIDATE_K = 15;
const ANSWER_K = 6;

export async function ask(
  question: string,
  opts: { collectionId?: string; topK?: number } = {}
): Promise<Answer> {
  const retrieved = await retrieve(question, {
    collectionId: opts.collectionId,
    topK: CANDIDATE_K,
  });
  const ranked = await rerank(question, retrieved, opts.topK ?? ANSWER_K);

  if (ranked.length === 0) {
    return {
      answer:
        "I could not find anything about that in your notes. Try rephrasing, or add more documents.",
      citations: [],
    };
  }

  const context = ranked
    .map(
      (r, i) =>
        `[${i + 1}] ${r.title}${r.sectionPath ? ` (${r.sectionPath})` : ""}\n${r.content}`
    )
    .join("\n\n---\n\n");

  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: `Sources:\n\n${context}\n\n---\n\nQuestion: ${question}`,
    },
  ];

  const answer = await chat(messages);

  return {
    answer,
    citations: ranked.map((r) => ({
      title: r.title,
      source: r.source,
      sectionPath: r.sectionPath,
      snippet: r.content.slice(0, 240),
    })),
  };
}
