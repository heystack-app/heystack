import { readFile, readdir } from "node:fs/promises";
import { join, relative, sep, basename, extname } from "node:path";
import matter from "gray-matter";
import { watch, type FSWatcher } from "chokidar";
import {
  upsertDocument,
  removeDocument,
  listSources,
  hashContent,
  type IngestResult,
} from "@/lib/rag/ingest";
import { stripMdxNoise } from "@/lib/rag/extract";

const IGNORED_DIRS = new Set([".obsidian", ".trash", ".git", "node_modules"]);

export type ObsidianParse = {
  content: string;
  tags: string[];
  links: string[];
};

/**
 * Normalize Obsidian-flavored markdown so it embeds cleanly, and pull out its
 * tags and outgoing links as metadata.
 * - [[Note]] -> Note, [[Note|Alias]] -> Alias, [[Note#Heading]] -> Note Heading
 * - ![[Embed]] -> Embed (full transclusion resolution is a later enhancement)
 * - #tag captured as metadata (left in the text, where it can aid retrieval)
 *
 * Without this, raw "[[...]]" syntax pollutes the embeddings and hurts recall.
 */
export function parseObsidian(markdown: string): ObsidianParse {
  const links: string[] = [];

  // Embeds first: ![[Target]] / ![[Target#Heading]] / ![[Target|Alias]]
  let content = markdown.replace(/!\[\[([^\]]+)\]\]/g, (_m, inner: string) => {
    const target = inner.split("|")[0].split("#")[0].trim();
    if (target) links.push(target);
    return inner.split("|").pop()!.replace("#", " ").trim();
  });

  // Wiki-links: [[Target]] / [[Target|Alias]] / [[Target#Heading]]
  content = content.replace(/\[\[([^\]]+)\]\]/g, (_m, inner: string) => {
    const [targetPart, alias] = inner.split("|");
    const target = targetPart.split("#")[0].trim();
    if (target) links.push(target);
    return alias ? alias.trim() : targetPart.replace("#", " ").trim();
  });

  // Tags: #tag, #nested/tag. Simple scan, good enough for metadata.
  const tags = new Set<string>();
  const tagRe = /(?:^|\s)#([A-Za-z0-9_][A-Za-z0-9_/-]*)/g;
  let m: RegExpExecArray | null;
  while ((m = tagRe.exec(content))) tags.add(m[1]);

  return { content, tags: [...tags], links: [...new Set(links)] };
}

const toPosix = (p: string) => p.split(sep).join("/");

const MARKDOWN_EXTS = new Set([".md", ".mdx"]);
const isMarkdown = (p: string) => MARKDOWN_EXTS.has(extname(p).toLowerCase());

/** True for paths inside an ignored or hidden directory of the vault. */
function isIgnored(vaultPath: string, fullPath: string): boolean {
  const rel = relative(vaultPath, fullPath);
  if (!rel || rel.startsWith("..")) return false; // the vault root itself
  return rel
    .split(/[\\/]/)
    .some((seg) => IGNORED_DIRS.has(seg) || (seg.startsWith(".") && seg !== "."));
}

/** Walk a vault directory, yielding absolute paths of .md files. */
async function* walkVault(dir: string): AsyncGenerator<string> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (IGNORED_DIRS.has(entry.name) || entry.name.startsWith(".")) continue;
      yield* walkVault(join(dir, entry.name));
    } else if (isMarkdown(entry.name)) {
      yield join(dir, entry.name);
    }
  }
}

/** Ingest one note, using its vault-relative path as the stable source id. */
export async function ingestNote(
  vaultPath: string,
  filePath: string,
  collectionId: string
): Promise<IngestResult> {
  const raw = await readFile(filePath, "utf8");
  const parsed = matter(raw);
  const base =
    extname(filePath).toLowerCase() === ".mdx"
      ? stripMdxNoise(parsed.content)
      : parsed.content;
  const obs = parseObsidian(base);
  const source = toPosix(relative(vaultPath, filePath));
  const title =
    typeof parsed.data.title === "string"
      ? parsed.data.title
      : basename(filePath, extname(filePath));
  const aliases = Array.isArray(parsed.data.aliases) ? parsed.data.aliases : [];

  return upsertDocument({
    collectionId,
    source,
    title,
    markdown: obs.content,
    contentHash: hashContent(raw),
    metadata: { ...parsed.data, tags: obs.tags, links: obs.links, aliases },
  });
}

export type SyncSummary = {
  added: number;
  chunks: number;
  skipped: number;
  removed: number;
};

/** Full sync: ingest every note, then remove notes that no longer exist. */
export async function syncVault(
  vaultPath: string,
  collectionId: string,
  onFile?: (rel: string, res: IngestResult) => void
): Promise<SyncSummary> {
  const seen = new Set<string>();
  let added = 0;
  let chunks = 0;
  let skipped = 0;

  for await (const filePath of walkVault(vaultPath)) {
    const rel = toPosix(relative(vaultPath, filePath));
    seen.add(rel);
    const res = await ingestNote(vaultPath, filePath, collectionId);
    if (res.skipped) skipped++;
    else {
      added++;
      chunks += res.chunks;
    }
    onFile?.(rel, res);
  }

  // Drop documents whose source file is gone from the vault.
  let removed = 0;
  for (const source of await listSources(collectionId)) {
    if (!seen.has(source) && (await removeDocument(collectionId, source))) {
      removed++;
    }
  }

  return { added, chunks, skipped, removed };
}

/**
 * Watch a vault and keep the collection in sync as files change. Returns the
 * watcher so the caller can close it. This is the "live sync" that makes the
 * connector feel native: edit a note, ask about it moments later.
 */
export function watchVault(
  vaultPath: string,
  collectionId: string,
  log: (msg: string) => void = () => {}
): FSWatcher {
  const watcher = watch(vaultPath, {
    ignored: (p: string) => isIgnored(vaultPath, p),
    ignoreInitial: true,
    persistent: true,
  });

  const rel = (p: string) => toPosix(relative(vaultPath, p));

  watcher
    .on("add", async (p) => {
      if (!isMarkdown(p)) return;
      await ingestNote(vaultPath, p, collectionId);
      log(`added: ${rel(p)}`);
    })
    .on("change", async (p) => {
      if (!isMarkdown(p)) return;
      await ingestNote(vaultPath, p, collectionId);
      log(`updated: ${rel(p)}`);
    })
    .on("unlink", async (p) => {
      if (!isMarkdown(p)) return;
      await removeDocument(collectionId, rel(p));
      log(`removed: ${rel(p)}`);
    });

  return watcher;
}
