export type Chunk = {
  content: string;
  sectionPath: string;
  index: number;
};

// Keep chunks under the embedding model's comfortable input size.
const MAX_CHARS = 4000;

/**
 * Structural, markdown-aware chunking.
 *
 * Splits at heading boundaries and tracks the section path (e.g.
 * "Setup > Docker > Compose"), which gives the model context about where a
 * chunk lives. Sections longer than MAX_CHARS fall back to paragraph, then
 * line, then hard splitting, so we never cut mid-code-block on a blind
 * character count. This is the "good chunking" the research flagged as a
 * real quality lever over naive fixed-size splitting.
 */
export function chunkMarkdown(markdown: string): Chunk[] {
  const lines = markdown.split(/\r?\n/);
  const sections: { path: string; body: string }[] = [];
  const headingStack: { level: number; text: string }[] = [];
  let buffer: string[] = [];

  const flush = () => {
    const body = buffer.join("\n").trim();
    if (body.length > 0) {
      sections.push({ path: headingStack.map((h) => h.text).join(" > "), body });
    }
    buffer = [];
  };

  for (const line of lines) {
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      flush();
      const level = heading[1].length;
      while (
        headingStack.length &&
        headingStack[headingStack.length - 1].level >= level
      ) {
        headingStack.pop();
      }
      headingStack.push({ level, text: heading[2].trim() });
    } else {
      buffer.push(line);
    }
  }
  flush();

  const chunks: Chunk[] = [];
  let index = 0;
  for (const section of sections) {
    for (const piece of splitToSize(section.body, MAX_CHARS)) {
      chunks.push({ content: piece, sectionPath: section.path, index: index++ });
    }
  }
  return chunks;
}

function splitToSize(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) return [text];

  const out: string[] = [];
  let current = "";
  const push = () => {
    if (current.trim().length) out.push(current.trim());
    current = "";
  };

  // Prefer paragraph boundaries, then single lines.
  for (const para of text.split(/\n{2,}/)) {
    const units = para.length > maxChars ? para.split(/\r?\n/) : [para];
    for (const u of units) {
      if (current.length + u.length + 2 > maxChars) push();
      current += (current ? "\n\n" : "") + u;
    }
  }
  push();

  // Final safeguard: hard-split anything still over the limit.
  return out.flatMap((piece) => {
    if (piece.length <= maxChars) return [piece];
    const parts: string[] = [];
    for (let i = 0; i < piece.length; i += maxChars) {
      parts.push(piece.slice(i, i + maxChars));
    }
    return parts;
  });
}
