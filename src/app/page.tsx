"use client";

import { useEffect, useState } from "react";

type Citation = {
  title: string;
  source: string;
  sectionPath: string | null;
  snippet: string;
  documentId: string;
  chunkId: string;
};

type Answer = { answer: string; citations: Citation[] };
type Collection = { id: string; name: string; documents: number };
type DocChunk = {
  id: string;
  chunkIndex: number;
  sectionPath: string | null;
  content: string;
};
type DocView = {
  id: string;
  title: string;
  source: string;
  mimeType: string;
  chunks: DocChunk[];
};

export default function Home() {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Answer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [collectionId, setCollectionId] = useState("");

  // Source document viewer.
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerDoc, setViewerDoc] = useState<DocView | null>(null);
  const [viewerLoading, setViewerLoading] = useState(false);
  const [activeChunkId, setActiveChunkId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/collections")
      .then((r) => r.json())
      .then((d) => setCollections(d.collections ?? []))
      .catch(() => setCollections([]));
  }, []);

  // Once a document loads, scroll the cited passage into view.
  useEffect(() => {
    if (viewerOpen && viewerDoc && activeChunkId) {
      document
        .getElementById(`chunk-${activeChunkId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [viewerOpen, viewerDoc, activeChunkId]);

  // Close the viewer with Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setViewerOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function openCitation(c: Citation) {
    setViewerOpen(true);
    setActiveChunkId(c.chunkId);
    setViewerDoc(null);
    setViewerLoading(true);
    try {
      const res = await fetch(`/api/documents/${c.documentId}`);
      if (!res.ok) throw new Error("Could not load document");
      setViewerDoc(await res.json());
    } catch {
      setViewerDoc(null);
    } finally {
      setViewerLoading(false);
    }
  }

  function openByNumber(n: number) {
    const c = result?.citations[n - 1];
    if (c) openCitation(c);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = question.trim();
    if (!q || loading) return;
    setLoading(true);
    setError(null);
    setResult({ answer: "", citations: [] });
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, collectionId: collectionId || undefined }),
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Request failed");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let answer = "";
      let citations: Citation[] = [];

      const handle = (line: string) => {
        if (!line.trim()) return;
        const evt = JSON.parse(line);
        if (evt.type === "error") throw new Error(evt.message);
        if (evt.type === "citations") citations = evt.citations;
        else if (evt.type === "token") answer += evt.text;
        setResult({ answer, citations });
      };

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) handle(line);
      }
      if (buffer.trim()) handle(buffer);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  // Render the answer with clickable [n] citation chips.
  function renderAnswer(text: string) {
    return text.split(/(\[\d+\])/g).map((part, i) => {
      const m = /^\[(\d+)\]$/.exec(part);
      if (m) {
        const n = parseInt(m[1], 10);
        return (
          <button
            key={i}
            onClick={() => openByNumber(n)}
            title="Open source"
            className="mx-0.5 rounded bg-blue-100 px-1 text-xs font-medium text-blue-700 hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-200"
          >
            [{n}]
          </button>
        );
      }
      return <span key={i}>{part}</span>;
    });
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-6 py-16">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">heystack</h1>
        <p className="mt-1 text-sm text-gray-500">
          Ask questions about your own notes. Private, local, with sources.
        </p>
      </header>

      <form onSubmit={onSubmit} className="flex flex-col gap-2">
        <div className="flex gap-2">
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="What did I write about…?"
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2 outline-none focus:border-gray-500 dark:border-gray-700 dark:bg-gray-900"
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-gray-900 px-4 py-2 font-medium text-white disabled:opacity-50 dark:bg-white dark:text-gray-900"
          >
            {loading ? "Thinking…" : "Ask"}
          </button>
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-500">
          Search in
          <select
            value={collectionId}
            onChange={(e) => setCollectionId(e.target.value)}
            className="rounded-lg border border-gray-300 px-2 py-1 dark:border-gray-700 dark:bg-gray-900"
          >
            <option value="">All collections</option>
            {collections.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.documents})
              </option>
            ))}
          </select>
        </label>
      </form>

      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      {result && (
        <section className="flex flex-col gap-4">
          <div className="whitespace-pre-wrap rounded-lg border border-gray-200 px-4 py-3 leading-relaxed dark:border-gray-800">
            {result.answer
              ? renderAnswer(result.answer)
              : loading
                ? <span className="text-gray-400">Searching your notes…</span>
                : null}
          </div>

          {result.citations.length > 0 && (
            <div className="flex flex-col gap-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                Sources
              </h2>
              {result.citations.map((c, i) => (
                <button
                  key={`${c.chunkId}-${i}`}
                  onClick={() => openCitation(c)}
                  className="group rounded-lg border border-gray-200 px-4 py-2 text-left text-sm transition-colors hover:border-blue-400 hover:bg-blue-50/50 dark:border-gray-800 dark:hover:bg-blue-950/20"
                >
                  <div className="font-medium">
                    [{i + 1}] {c.title}
                    {c.sectionPath ? (
                      <span className="text-gray-400"> · {c.sectionPath}</span>
                    ) : null}
                  </div>
                  <div className="mt-1 text-gray-500">{c.snippet}…</div>
                  <div className="mt-1 text-xs font-medium text-blue-600 opacity-0 transition-opacity group-hover:opacity-100">
                    Open source →
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Source document viewer */}
      {viewerOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div
            className="flex-1 bg-black/40"
            onClick={() => setViewerOpen(false)}
            aria-hidden
          />
          <aside className="flex h-full w-full max-w-xl flex-col overflow-y-auto bg-white p-6 shadow-2xl dark:bg-gray-950">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="truncate text-lg font-semibold">
                  {viewerDoc?.title ?? "Loading…"}
                </h2>
                {viewerDoc && (
                  <p className="mt-1 break-all text-xs text-gray-400">
                    {viewerDoc.source}
                  </p>
                )}
              </div>
              <button
                onClick={() => setViewerOpen(false)}
                className="shrink-0 rounded-lg border border-gray-300 px-3 py-1 text-sm hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
              >
                Close
              </button>
            </div>

            {viewerLoading && (
              <p className="text-sm text-gray-500">Loading document…</p>
            )}

            {viewerDoc && (
              <div className="flex flex-col gap-3">
                {viewerDoc.chunks.map((ch) => {
                  const active = ch.id === activeChunkId;
                  return (
                    <div
                      key={ch.id}
                      id={`chunk-${ch.id}`}
                      className={
                        active
                          ? "scroll-mt-6 rounded-lg border-2 border-yellow-400 bg-yellow-50 p-3 dark:bg-yellow-950/30"
                          : "scroll-mt-6 rounded-lg border border-gray-200 p-3 dark:border-gray-800"
                      }
                    >
                      {ch.sectionPath && (
                        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
                          {ch.sectionPath}
                        </div>
                      )}
                      <div className="whitespace-pre-wrap text-sm leading-relaxed">
                        {ch.content}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </aside>
        </div>
      )}
    </main>
  );
}
