import { Ollama } from "ollama";
import { env } from "./env";

// Single shared client pointed at the local Ollama runtime.
export const ollama = new Ollama({ host: env.OLLAMA_BASE_URL });

/**
 * Embed a batch of texts. Returns one vector per input, in order.
 * Uses Ollama's embed endpoint via fetch so an AbortSignal can interrupt an
 * in-flight request (the ollama client's abort() only targets streamed calls).
 */
export async function embed(
  texts: string[],
  signal?: AbortSignal
): Promise<number[][]> {
  if (texts.length === 0) return [];
  const res = await fetch(`${env.OLLAMA_BASE_URL}/api/embed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: env.EMBEDDING_MODEL, input: texts }),
    signal,
  });
  if (!res.ok) {
    throw new Error(`Embedding request failed: ${res.status}`);
  }
  const data = (await res.json()) as { embeddings: number[][] };
  return data.embeddings;
}

/** Embed a single text. */
export async function embedOne(text: string): Promise<number[]> {
  const [vec] = await embed([text]);
  return vec;
}

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

// Cap runaway generation and discourage the repetition loops smaller models can
// fall into (especially on non-English text), which otherwise make Ollama error
// with "Did not receive done or success response in stream".
const GEN_OPTIONS = { num_predict: 1024, repeat_penalty: 1.15 };

/** One non-streaming chat completion. */
export async function chat(messages: ChatMessage[]): Promise<string> {
  const res = await ollama.chat({
    model: env.CHAT_MODEL,
    messages,
    stream: false,
    options: GEN_OPTIONS,
  });
  return res.message.content;
}

/** Stream a chat completion token by token. */
export async function* chatStream(
  messages: ChatMessage[]
): AsyncGenerator<string> {
  const res = await ollama.chat({
    model: env.CHAT_MODEL,
    messages,
    stream: true,
    options: GEN_OPTIONS,
  });
  for await (const part of res) {
    const text = part.message?.content;
    if (text) yield text;
  }
}
