import os from "node:os";
import { join } from "node:path";
import { readdir } from "node:fs/promises";
import { isSupported } from "./rag/extract";
import { getOrCreateCollection, ingestFile } from "./rag/ingest";
import { env } from "./env";

// Default places where personal documents actually live.
export function defaultRoots(): string[] {
  if (env.SCAN_ROOTS) {
    return env.SCAN_ROOTS.split(",")
      .map((p) => p.trim())
      .filter(Boolean);
  }
  const home = os.homedir();
  return ["Desktop", "Documents", "Downloads"].map((d) => join(home, d));
}

// Folders we never descend into: system, app, and dependency trees.
const IGNORE_DIRS = new Set([
  "node_modules",
  "AppData",
  "Application Data",
  "Library",
  "Windows",
  "Program Files",
  "Program Files (x86)",
  "ProgramData",
  "$Recycle.Bin",
  "System Volume Information",
  ".cache",
  ".Trash",
  ".git",
]);

export type ScanState = {
  running: boolean;
  startedAt: number | null;
  found: number;
  ingested: number;
  skipped: number;
  failed: number;
  current: string | null;
  error: string | null;
  roots: string[];
};

// In-process scan state. Fine for a single self-hosted instance: the API starts
// a scan in the background and the UI polls this.
const state: ScanState & { cancel: boolean } = {
  running: false,
  startedAt: null,
  found: 0,
  ingested: 0,
  skipped: 0,
  failed: 0,
  current: null,
  error: null,
  roots: [],
  cancel: false,
};

export function scanStatus(): ScanState {
  const { cancel, ...rest } = state;
  void cancel;
  return { ...rest };
}

// Aborts the embedding request that is in flight when a scan is cancelled, so
// Stop is near-instant instead of waiting for the current file to finish.
let scanController: AbortController | null = null;

export function cancelScan() {
  if (state.running) {
    state.cancel = true;
    scanController?.abort();
  }
}

async function* walk(dir: string): AsyncGenerator<string> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return; // permission denied / unreadable: skip quietly
  }
  for (const entry of entries) {
    if (state.cancel) return;
    if (entry.name.startsWith("~$") || entry.name.startsWith(".")) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (IGNORE_DIRS.has(entry.name)) continue;
      yield* walk(full);
    } else if (isSupported(full)) {
      yield full;
    }
  }
}

/** Walk the roots and ingest every supported file into one collection. */
export async function startScan(
  roots: string[] = defaultRoots(),
  collectionName = "My Computer"
): Promise<void> {
  if (state.running) return;
  Object.assign(state, {
    running: true,
    startedAt: Date.now(),
    found: 0,
    ingested: 0,
    skipped: 0,
    failed: 0,
    current: null,
    error: null,
    roots,
    cancel: false,
  });

  scanController = new AbortController();
  try {
    const collectionId = await getOrCreateCollection(collectionName);
    for (const root of roots) {
      if (state.cancel) break;
      for await (const file of walk(root)) {
        if (state.cancel) break;
        state.found++;
        state.current = file;
        try {
          const res = await ingestFile(file, collectionId, scanController.signal);
          if (res.skipped) state.skipped++;
          else state.ingested++;
        } catch {
          // A cancel aborts the in-flight embed: that is not a real failure.
          if (!state.cancel) state.failed++;
        }
      }
    }
  } catch (err) {
    state.error = err instanceof Error ? err.message : String(err);
  } finally {
    state.running = false;
    state.current = null;
    state.cancel = false;
    scanController = null;
  }
}
