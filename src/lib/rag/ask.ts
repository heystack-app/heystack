import { retrieve } from "./retrieve";
import { rerank } from "./rerank";
import { chat, chatStream, type ChatMessage } from "@/lib/ollama";

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

const NO_RESULTS =
  "I could not find anything about that in your notes. Try rephrasing, or add more documents.";

// Pull a wider candidate set from retrieval, then let the reranker narrow it to
// the few best passages we actually feed the model.
const CANDIDATE_K = 15;
const ANSWER_K = 6;

type Prepared =
  | { empty: true }
  | { empty: false; messages: ChatMessage[]; citations: Citation[] };

// Shared pipeline up to (but not including) generation: retrieve, rerank, and
// build the grounded prompt plus the citations. Both ask() and askStream() use
// this so they behave identically apart from how the answer is delivered.
async function prepare(
  question: string,
  opts: { collectionId?: string; topK?: number }
): Promise<Prepared> {
  const retrieved = await retrieve(question, {
    collectionId: opts.collectionId,
    topK: CANDIDATE_K,
  });
  const ranked = await rerank(question, retrieved, opts.topK ?? ANSWER_K);
  if (ranked.length === 0) return { empty: true };

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

  const citations: Citation[] = ranked.map((r) => ({
    title: r.title,
    source: r.source,
    sectionPath: r.sectionPath,
    snippet: r.content.slice(0, 240),
  }));

  return { empty: false, messages, citations };
}

/** Answer a question, returning the full answer and its citations at once. */
export async function ask(
  question: string,
  opts: { collectionId?: string; topK?: number } = {}
): Promise<Answer> {
  const prepared = await prepare(question, opts);
  if (prepared.empty) return { answer: NO_RESULTS, citations: [] };
  const answer = await chat(prepared.messages);
  return { answer, citations: prepared.citations };
}

/**
 * Answer a question with streaming. Citations are known before generation, so
 * they are returned immediately alongside an async generator of answer tokens.
 */
export async function askStream(
  question: string,
  opts: { collectionId?: string; topK?: number } = {}
): Promise<{ citations: Citation[]; tokens: AsyncGenerator<string> }> {
  const prepared = await prepare(question, opts);
  if (prepared.empty) {
    async function* single() {
      yield NO_RESULTS;
    }
    return { citations: [], tokens: single() };
  }
  return { citations: prepared.citations, tokens: chatStream(prepared.messages) };
}
