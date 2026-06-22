"use client";

import { useEffect, useState } from "react";

type Citation = {
  title: string;
  source: string;
  sectionPath: string | null;
  snippet: string;
};

type Answer = { answer: string; citations: Citation[] };

type Collection = { id: string; name: string; documents: number };

export default function Home() {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Answer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [collectionId, setCollectionId] = useState("");

  // Load the list of collections for the picker.
  useEffect(() => {
    fetch("/api/collections")
      .then((r) => r.json())
      .then((d) => setCollections(d.collections ?? []))
      .catch(() => setCollections([]));
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = question.trim();
    if (!q || loading) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, collectionId: collectionId || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Request failed");
      setResult(data as Answer);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
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
          <div className="whitespace-pre-wrap rounded-lg border border-gray-200 px-4 py-3 dark:border-gray-800">
            {result.answer}
          </div>

          {result.citations.length > 0 && (
            <div className="flex flex-col gap-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                Sources
              </h2>
              {result.citations.map((c, i) => (
                <div
                  key={`${c.source}-${i}`}
                  className="rounded-lg border border-gray-200 px-4 py-2 text-sm dark:border-gray-800"
                >
                  <div className="font-medium">
                    [{i + 1}] {c.title}
                    {c.sectionPath ? (
                      <span className="text-gray-400"> · {c.sectionPath}</span>
                    ) : null}
                  </div>
                  <div className="mt-1 text-gray-500">{c.snippet}…</div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </main>
  );
}
