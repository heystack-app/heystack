import { Ollama } from "ollama";
import { env } from "./env";

// Single shared client pointed at the local Ollama runtime.
export const ollama = new Ollama({ host: env.OLLAMA_BASE_URL });

/** Embed a batch of texts. Returns one vector per input, in order. */
export async function embed(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const res = await ollama.embed({ model: env.EMBEDDING_MODEL, input: texts });
  return res.embeddings;
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

/** One non-streaming chat completion. */
export async function chat(messages: ChatMessage[]): Promise<string> {
  const res = await ollama.chat({
    model: env.CHAT_MODEL,
    messages,
    stream: false,
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
  });
  for await (const part of res) {
    const text = part.message?.content;
    if (text) yield text;
  }
}
