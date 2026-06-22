"use client";

import { useEffect, useRef, useState } from "react";

type ScanStatus = {
  running: boolean;
  startedAt: number | null;
  found: number;
  ingested: number;
  skipped: number;
  failed: number;
  current: string | null;
  error: string | null;
  roots: string[];
  defaultRoots?: string[];
};

function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-block animate-spin rounded-full border-2 border-current border-t-transparent ${className}`}
    />
  );
}

export function ScanButton({ onChanged }: { onChanged?: () => void }) {
  const [status, setStatus] = useState<ScanStatus | null>(null);
  const [open, setOpen] = useState(false);
  const [stopping, setStopping] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasRunning = useRef(false);

  const poll = async () => {
    try {
      const r = await fetch("/api/scan");
      const s: ScanStatus = await r.json();
      setStatus(s);
      if (s.running) {
        wasRunning.current = true;
        timer.current = setTimeout(poll, 1000);
      } else if (wasRunning.current) {
        wasRunning.current = false;
        setStopping(false);
        onChanged?.();
      }
    } catch {
      /* ignore transient poll errors */
    }
  };

  useEffect(() => {
    poll();
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const running = !!status?.running;

  const start = async () => {
    setStopping(false);
    await fetch("/api/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    poll();
  };

  const stop = async () => {
    setStopping(true); // instant feedback; the current file finishes first
    await fetch("/api/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cancel" }),
    });
  };

  const folders = status?.defaultRoots ?? status?.roots ?? [];
  const hasLast =
    !!status && !running && status.startedAt !== null && status.found > 0;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Scan your computer for documents"
        className="flex h-9 items-center gap-2 rounded-lg border border-black/10 px-2.5 text-sm text-gray-600 transition-colors hover:bg-black/5 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/10"
      >
        {running ? (
          <Spinner className="h-3.5 w-3.5 text-indigo-500" />
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <ellipse cx="12" cy="5" rx="9" ry="3" />
            <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
            <path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3" />
          </svg>
        )}
        <span className="hidden sm:inline">Scan</span>
        {running && (
          <span className="rounded-full bg-indigo-100 px-1.5 text-xs font-semibold text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">
            {status!.ingested}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="hs-backdrop absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div className="hs-rise relative w-full max-w-lg rounded-2xl border border-black/10 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-[#15151a]">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">Scan my computer</h2>
                <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                  Index documents from your machine into a “My Computer”
                  collection.
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="shrink-0 rounded-lg border border-black/10 px-3 py-1 text-sm transition-colors hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10"
              >
                Close
              </button>
            </div>

            {!running ? (
              <div className="flex flex-col gap-4">
                <div>
                  <p className="mb-2 text-sm text-gray-500 dark:text-gray-400">
                    Looks for PDF, Word, Excel, PowerPoint, markdown, and text
                    files in:
                  </p>
                  <ul className="flex flex-col gap-1">
                    {folders.map((f) => (
                      <li
                        key={f}
                        className="truncate rounded-lg bg-black/[0.03] px-2.5 py-1 font-mono text-xs text-gray-600 dark:bg-white/5 dark:text-gray-300"
                      >
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
                <button
                  onClick={start}
                  className="self-start rounded-xl bg-indigo-600 px-4 py-2 font-medium text-white transition-colors hover:bg-indigo-500"
                >
                  Scan now
                </button>
                {hasLast && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Last scan: {status!.ingested} indexed, {status!.skipped}{" "}
                    unchanged, {status!.failed} failed.
                  </p>
                )}
                <p className="text-xs text-gray-400">
                  Indexed in place. Nothing is copied or uploaded. Re-scan any
                  time to pick up new files.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Spinner className="h-4 w-4 text-indigo-500" />
                  {stopping ? "Stopping…" : "Adding the files we found…"}
                </div>

                <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
                  <div className="hs-indeterminate h-full w-2/5 rounded-full bg-indigo-500" />
                </div>

                <div className="flex gap-4 text-sm">
                  <span>
                    <span className="text-xl font-semibold">{status!.ingested}</span>{" "}
                    <span className="text-gray-400">indexed</span>
                  </span>
                  <span>
                    <span className="text-xl font-semibold">{status!.skipped}</span>{" "}
                    <span className="text-gray-400">unchanged</span>
                  </span>
                  {status!.failed > 0 && (
                    <span>
                      <span className="text-xl font-semibold">{status!.failed}</span>{" "}
                      <span className="text-gray-400">skipped</span>
                    </span>
                  )}
                </div>

                {status!.current && (
                  <div className="truncate rounded-lg bg-black/[0.03] px-2.5 py-1.5 font-mono text-xs text-gray-500 dark:bg-white/5 dark:text-gray-400">
                    {status!.current}
                  </div>
                )}

                <button
                  onClick={stop}
                  disabled={stopping}
                  className="self-start rounded-xl border border-black/10 px-4 py-2 text-sm transition-colors hover:bg-black/5 disabled:opacity-50 dark:border-white/15 dark:hover:bg-white/10"
                >
                  {stopping ? "Stopping…" : "Stop"}
                </button>
              </div>
            )}

            {status?.error && (
              <p className="mt-3 text-xs text-red-600 dark:text-red-400">
                {status.error}
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
