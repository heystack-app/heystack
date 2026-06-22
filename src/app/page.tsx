"use client";

import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ThemeToggle } from "@/components/theme-toggle";
import { CollectionPicker } from "@/components/collection-picker";
import { SourceChunk } from "@/components/source-content";

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

  useEffect(() => {
    if (viewerOpen && viewerDoc && activeChunkId) {
      document
        .getElementById(`chunk-${activeChunkId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [viewerOpen, viewerDoc, activeChunkId]);

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

  function withCiteLinks(text: string) {
    return text.replace(/\[(\d+)\]/g, (_, n) => `[\\[${n}\\]](#cite-${n})`);
  }

  const markdownComponents = {
    a({ href, children }: { href?: string; children?: React.ReactNode }) {
      const m = /^#cite-(\d+)$/.exec(href ?? "");
      if (m) {
        const n = parseInt(m[1], 10);
        return (
          <button
            onClick={() => openByNumber(n)}
            title="Open source"
            className="mx-0.5 rounded-md bg-indigo-100 px-1.5 align-baseline text-xs font-semibold text-indigo-700 transition-colors hover:bg-indigo-200 dark:bg-indigo-500/20 dark:text-indigo-300 dark:hover:bg-indigo-500/30"
          >
            {children}
          </button>
        );
      }
      return (
        <a href={href} target="_blank" rel="noreferrer" className="text-indigo-600 underline dark:text-indigo-400">
          {children}
        </a>
      );
    },
  };

  return (
    <div className="relative min-h-screen w-full bg-gradient-to-b from-gray-50 to-white text-gray-900 dark:from-[#0b0b0d] dark:to-black dark:text-gray-100">
      <div className="mx-auto flex max-w-3xl flex-col gap-8 px-6 py-12 sm:py-16">
        {/* Header */}
        <header className="flex items-start justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-gradient-to-br from-indigo-500 to-fuchsia-500" />
              <span className="bg-gradient-to-r from-indigo-600 to-fuchsia-600 bg-clip-text text-transparent dark:from-indigo-400 dark:to-fuchsia-400">
                heystack
              </span>
            </h1>
            <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400">
              Ask your own notes and files. Private, local, with sources.
            </p>
          </div>
          <ThemeToggle />
        </header>

        {/* Search */}
        <form
          onSubmit={onSubmit}
          className="flex flex-col gap-3 rounded-2xl border border-black/5 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-white/5"
        >
          <div className="flex gap-2">
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="What did I write about…?"
              className="flex-1 rounded-xl bg-transparent px-3 py-2.5 text-base outline-none placeholder:text-gray-400"
            />
            <button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-indigo-600 px-5 py-2.5 font-medium text-white shadow-sm transition-colors hover:bg-indigo-500 disabled:opacity-50"
            >
              {loading ? "Thinking…" : "Ask"}
            </button>
          </div>
          <div className="flex items-center gap-2 px-1 text-sm text-gray-500 dark:text-gray-400">
            <span>Search in</span>
            <CollectionPicker
              collections={collections}
              value={collectionId}
              onChange={setCollectionId}
            />
          </div>
        </form>

        {error && (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300">
            {error}
          </p>
        )}

        {result && (
          <section className="hs-rise flex flex-col gap-5">
            <div className="rounded-2xl border border-black/5 bg-white px-5 py-4 shadow-sm dark:border-white/10 dark:bg-white/5">
              {result.answer ? (
                <div className="prose prose-sm max-w-none dark:prose-invert prose-pre:overflow-x-auto prose-pre:rounded-xl">
                  <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                    {withCiteLinks(result.answer)}
                  </ReactMarkdown>
                </div>
              ) : loading ? (
                <span className="inline-flex items-center gap-2 text-gray-400">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-indigo-500" />
                  Searching your notes…
                </span>
              ) : null}
            </div>

            {result.citations.length > 0 && (
              <div className="flex flex-col gap-2">
                <h2 className="px-1 text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Sources
                </h2>
                {result.citations.map((c, i) => (
                  <button
                    key={`${c.chunkId}-${i}`}
                    onClick={() => openCitation(c)}
                    className="group rounded-xl border border-black/5 bg-white px-4 py-3 text-left text-sm shadow-sm transition-all hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md dark:border-white/10 dark:bg-white/5 dark:hover:border-indigo-500/40"
                  >
                    <div className="flex items-center gap-2 font-medium">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-indigo-100 text-xs font-semibold text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">
                        {i + 1}
                      </span>
                      <span className="truncate">{c.title}</span>
                      {c.sectionPath ? (
                        <span className="truncate text-gray-400">· {c.sectionPath}</span>
                      ) : null}
                    </div>
                    <div className="mt-1.5 line-clamp-2 text-gray-500 dark:text-gray-400">
                      {c.snippet}…
                    </div>
                    <div className="mt-1.5 text-xs font-medium text-indigo-600 opacity-0 transition-opacity group-hover:opacity-100 dark:text-indigo-400">
                      Open source →
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>
        )}
      </div>

      {/* Source document viewer */}
      {viewerOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div
            className="hs-backdrop flex-1 bg-black/40 backdrop-blur-sm"
            onClick={() => setViewerOpen(false)}
            aria-hidden
          />
          <aside className="hs-panel flex h-full w-full max-w-xl flex-col overflow-y-auto border-l border-black/10 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-[#0b0b0d]">
            <div className="mb-5 flex items-start justify-between gap-4">
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
                className="shrink-0 rounded-lg border border-black/10 px-3 py-1 text-sm transition-colors hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10"
              >
                Close
              </button>
            </div>

            {viewerLoading && (
              <p className="text-sm text-gray-500">Loading document…</p>
            )}

            {/* PDFs: embed the real document, with the cited passage called out. */}
            {viewerDoc && viewerDoc.mimeType === "application/pdf" && (
              <div className="flex flex-1 flex-col gap-3">
                {(() => {
                  const active = viewerDoc.chunks.find(
                    (c) => c.id === activeChunkId
                  );
                  return active ? (
                    <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-500/40 dark:bg-amber-500/10">
                      <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-300">
                        Cited passage
                      </div>
                      <div className="whitespace-pre-wrap">
                        {active.content.slice(0, 400)}…
                      </div>
                    </div>
                  ) : null;
                })()}
                <iframe
                  src={`/api/documents/${viewerDoc.id}/raw`}
                  title={viewerDoc.title}
                  className="h-[78vh] w-full rounded-xl border border-black/10 dark:border-white/10"
                />
              </div>
            )}

            {/* Everything else: render each stored section nicely by type. */}
            {viewerDoc && viewerDoc.mimeType !== "application/pdf" && (
              <div className="flex flex-col gap-3">
                {viewerDoc.chunks.map((ch) => {
                  const active = ch.id === activeChunkId;
                  return (
                    <div
                      key={ch.id}
                      id={`chunk-${ch.id}`}
                      className={
                        active
                          ? "scroll-mt-6 rounded-xl border border-amber-300 bg-amber-50 p-4 ring-1 ring-amber-300 dark:border-amber-500/40 dark:bg-amber-500/10 dark:ring-amber-500/30"
                          : "scroll-mt-6 rounded-xl border border-black/5 p-4 dark:border-white/10"
                      }
                    >
                      {ch.sectionPath && (
                        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
                          {ch.sectionPath}
                        </div>
                      )}
                      <SourceChunk mimeType={viewerDoc.mimeType} content={ch.content} />
                    </div>
                  );
                })}
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
