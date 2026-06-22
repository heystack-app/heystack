import { z } from "zod";

// All configuration is environment driven so the same image runs locally,
// in docker-compose, and in k3s. Every value has a sensible local default.
const schema = z.object({
  DATABASE_URL: z
    .string()
    .default("postgres://heystack:heystack@localhost:5432/heystack"),
  OLLAMA_BASE_URL: z.string().default("http://localhost:11434"),
  EMBEDDING_MODEL: z.string().default("nomic-embed-text"),
  CHAT_MODEL: z.string().default("llama3.1:8b"),
  // Optional cloud fallback. Leave empty to stay fully local and private.
  OPENAI_API_KEY: z.string().optional(),
});

export const env = schema.parse(process.env);

// Embedding dimensions. MUST match both the embedding model and the
// vector(...) column declared in db/init.sql. nomic-embed-text is 768.
export const EMBEDDING_DIM = 768;
