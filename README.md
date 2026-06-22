<div align="center">

# heystack

**Chat with your own notes and files. Private, self-hosted, runs free on your own hardware.**

Stop digging through your notes, and stop trusting an AI that has never read them.
heystack answers from *your* stuff, shows its sources, and runs free and private on your own machine.

</div>

---

> **Status: early development (v0.1).** The core retrieval pipeline, the chat API,
> a minimal UI, and a one-command Docker setup are in place. Not yet production ready.

## Why heystack

Asking ChatGPT is like asking a clever stranger who has never read your notes.
heystack is like asking a librarian who has read everything you wrote and points
you to the exact page.

- **It knows your stuff.** Answers come from your own notes, not the public internet.
- **It does not make things up.** Every answer is built from your files and cites
  them, so you can click and verify. If it is not in your notes, it says so.
- **It is private.** Your data never leaves your machine. Nothing uploaded, logged,
  or trained on.
- **It is free.** The AI runs locally via [Ollama](https://ollama.com). No
  subscription, no cost per question.
- **You own it.** Works offline. Self-hosted with Docker or k3s.

## How it works

```
Your question
   -> hybrid search over your notes (semantic + keyword, fused with RRF)
   -> the most relevant chunks are handed to a local LLM
   -> an answer written ONLY from those chunks, with clickable citations
```

That combination (retrieval + generation = RAG) is the whole point. Search alone
just lists files. AI alone makes things up. Together, you get trustworthy answers
from your own knowledge.

## Tech

TypeScript end to end. Next.js + Postgres (pgvector for vectors, full-text for
keywords, all in one database) + Ollama for local embeddings and chat.

## Quickstart

Requirements: Docker, and [Ollama](https://ollama.com) running locally.

```bash
# 1. Pull the models heystack uses
ollama pull nomic-embed-text
ollama pull llama3.1:8b

# 2. Configure and start
cp .env.example .env
docker compose up -d

# 3. Ingest some markdown (a file or a whole folder, e.g. an Obsidian vault)
npm install
npm run ingest -- "/path/to/your/notes" "My Notes"

# 4. Open the app
# http://localhost:3000
```

Prefer to run Ollama in a container too? `docker compose --profile ollama up -d`
and set `OLLAMA_BASE_URL=http://ollama:11434` in `.env`.

### Local development

```bash
npm install
docker compose up -d db          # just Postgres
npm run dev                      # app on http://localhost:3000
```

## Project layout

```
src/
  app/             Next.js app (UI + /api/chat route)
  db/              Drizzle schema + client
  lib/
    ollama.ts      local embeddings + chat
    rag/
      chunk.ts     structural, markdown-aware chunking
      ingest.ts    parse -> chunk -> embed -> store
      retrieve.ts  hybrid search (vector + full-text) fused with RRF
      rerank.ts    reranking hook (cross-encoder coming next)
      ask.ts       retrieve -> rerank -> grounded answer with citations
scripts/ingest.ts  the ingest CLI (npm run ingest)
db/init.sql        schema + pgvector/full-text indexes (applied on first boot)
docker-compose.yml app + Postgres (+ optional Ollama)
```

## Roadmap (short)

- v0.1: local markdown files, hybrid retrieval, citations, one-command deploy.
- v0.2: first-class Obsidian / markdown vault connector with live sync, a
  cross-encoder reranker, and a public demo.
- v1.0: more connectors, multi-user, k3s/Helm, power-user retrieval settings.

## License

MIT
