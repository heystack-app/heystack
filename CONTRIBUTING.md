# Contributing to heystack

Thanks for your interest in improving heystack. Issues, ideas, and pull requests
are all welcome.

## Development setup

heystack is a Next.js + TypeScript app backed by Postgres (pgvector) and local
models via Ollama. You need Node 24+, Docker, and [Ollama](https://ollama.com).

```bash
ollama pull bge-m3
ollama pull llama3.1:8b

npm install
cp .env.example .env
docker compose up -d db     # Postgres + pgvector
npm run seed                # optional: load the demo knowledge base
npm run dev                 # http://localhost:3000
```

## Quality checks

Please run these before opening a PR. CI runs the first three on every push and PR.

```bash
npm run lint
npm run typecheck
npm run build
npm run eval        # retrieval recall@k over the demo set (needs Ollama + npm run seed)
```

## Guidelines

- Keep pull requests focused: one topic per PR.
- Match the surrounding code style. ESLint is the source of truth.
- Retrieval quality is the product. If you touch the RAG pipeline
  (`src/lib/rag/*`), run `npm run eval` and keep it green, and add a case to
  `eval/cases.json` when it makes sense.
- Be respectful. See the [Code of Conduct](CODE_OF_CONDUCT.md).

## Reporting things

- Bugs and features: use the issue templates.
- Security issues: see [SECURITY.md](SECURITY.md). Please do not file them as
  public issues.
