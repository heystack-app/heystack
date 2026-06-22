import { readFile } from "node:fs/promises";
import { basename, extname } from "node:path";
import { createHash } from "node:crypto";
import matter from "gray-matter";
import { extractText, getDocumentProxy } from "unpdf";
import mammoth from "mammoth";

// File types heystack can ingest today.
export const SUPPORTED_EXTENSIONS = new Set([
  ".md",
  ".mdx",
  ".txt",
  ".pdf",
  ".docx",
]);
const MARKDOWN = new Set([".md", ".mdx"]);

export function isSupported(filePath: string): boolean {
  return SUPPORTED_EXTENSIONS.has(extname(filePath).toLowerCase());
}

/**
 * Light cleanup for MDX: drop the leading block of ESM import/export lines that
 * docs frameworks (fumadocs, docusaurus) put at the top. We only strip the
 * leading block and stop at the first real content, so import/export lines shown
 * inside code examples are left intact.
 */
export function stripMdxNoise(content: string): string {
  const lines = content.split(/\r?\n/);
  let i = 0;
  while (i < lines.length) {
    const t = lines[i].trim();
    if (t === "" || /^(import|export)\s/.test(t)) i++;
    else break;
  }
  return lines.slice(i).join("\n").trim();
}

export type Extracted = {
  text: string; // the content to chunk
  title: string;
  mimeType: string;
  metadata: Record<string, unknown>;
  contentHash: string; // hash of the raw file bytes, for change detection
};

/**
 * Read a file and extract its text, dispatching on extension. Markdown keeps its
 * structure (and frontmatter), PDFs and Word docs are converted to plain text.
 * Returns null for unsupported types.
 */
export async function extractFile(filePath: string): Promise<Extracted | null> {
  const ext = extname(filePath).toLowerCase();
  const buf = await readFile(filePath);
  const contentHash = createHash("sha256").update(buf).digest("hex");
  const fallbackTitle = basename(filePath, ext);

  if (MARKDOWN.has(ext)) {
    const parsed = matter(buf.toString("utf8"));
    const text = ext === ".mdx" ? stripMdxNoise(parsed.content) : parsed.content;
    const title =
      typeof parsed.data.title === "string" ? parsed.data.title : fallbackTitle;
    return {
      text,
      title,
      mimeType: "text/markdown",
      metadata: parsed.data ?? {},
      contentHash,
    };
  }

  if (ext === ".txt") {
    return {
      text: buf.toString("utf8"),
      title: fallbackTitle,
      mimeType: "text/plain",
      metadata: {},
      contentHash,
    };
  }

  if (ext === ".pdf") {
    const pdf = await getDocumentProxy(new Uint8Array(buf));
    const { text } = await extractText(pdf, { mergePages: true });
    return {
      text,
      title: fallbackTitle,
      mimeType: "application/pdf",
      metadata: {},
      contentHash,
    };
  }

  if (ext === ".docx") {
    const { value } = await mammoth.extractRawText({ buffer: buf });
    return {
      text: value,
      title: fallbackTitle,
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      metadata: {},
      contentHash,
    };
  }

  return null;
}
