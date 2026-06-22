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

export function ScanPanel({ onChanged }: { onChanged?: () => void }) {
  const [status, setStatus] = useState<ScanStatus | null>(null);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasRunning = useRef(false);

  const refresh = async () => {
    try {
      const r = await fetch("/api/scan");
      const s: ScanStatus = await r.json();
      setStatus(s);
      if (s.running) {
        wasRunning.current = true;
        timer.current = setTimeout(refresh, 1500);
      } else if (wasRunning.current) {
        wasRunning.current = false;
        onChanged?.(); // a scan just finished: refresh the collection list
      }
    } catch {
      /* ignore transient errors while polling */
    }
  };

  useEffect(() => {
    refresh();
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const start = async () => {
    setOpen(true);
    await fetch("/api/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    refresh();
  };

  const stop = async () => {
    await fetch("/api/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cancel" }),
    });
  };

  const folders = status?.defaultRoots ?? status?.roots ?? [];
  const running = !!status?.running;
  const hasLast =
    !!status && !running && status.found > 0 && status.startedAt !== null;

  return (
    <div className="rounded-2xl border border-black/5 bg-white shadow-sm dark:border-white/10 dark:bg-white/5">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-medium">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-500">
            <rect x="2" y="3" width="20" height="14" rx="2" />
            <path d="M8 21h8M12 17v4" />
          </svg>
          Scan my computer
          {running && (
            <span className="flex items-center gap-1 text-xs font-normal text-indigo-600 dark:text-indigo-400">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-indigo-500" />
              scanning…
            </span>
          )}
        </span>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="border-t border-black/5 px-4 py-3 text-sm dark:border-white/10">
          {!running ? (
            <div className="flex flex-col gap-3">
              <p className="text-gray-500 dark:text-gray-400">
                Index supported files (PDF, Word, Excel, PowerPoint, markdown,
                text) found in:
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
              <div className="flex items-center gap-3">
                <button
                  onClick={start}
                  className="rounded-xl bg-indigo-600 px-4 py-2 font-medium text-white transition-colors hover:bg-indigo-500"
                >
                  Scan now
                </button>
                {hasLast && (
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    Last scan: {status!.ingested} indexed, {status!.skipped}{" "}
                    unchanged, {status!.failed} failed
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400">
                Indexed in place into the “My Computer” collection. Nothing is
                copied or uploaded. Re-scan any time to pick up new files.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium">
                  {status!.ingested} indexed
                  <span className="text-gray-400">
                    {" "}
                    · {status!.skipped} unchanged · {status!.found} seen
                  </span>
                </span>
                <button
                  onClick={stop}
                  className="rounded-lg border border-black/10 px-3 py-1 text-sm transition-colors hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10"
                >
                  Stop
                </button>
              </div>
              {status!.current && (
                <div className="truncate rounded-lg bg-black/[0.03] px-2.5 py-1 font-mono text-xs text-gray-500 dark:bg-white/5 dark:text-gray-400">
                  {status!.current}
                </div>
              )}
            </div>
          )}
          {status?.error && (
            <p className="mt-2 text-xs text-red-600 dark:text-red-400">
              {status.error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
