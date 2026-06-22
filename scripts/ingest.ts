/**
 * Ingest a file or a folder into a collection. Supports markdown, mdx, txt,
 * pdf, and docx.
 *
 * Usage: npm run ingest -- <file-or-folder> [collectionName]
 * Example: npm run ingest -- "C:/Users/me/Documents" "My Docs"
 */
import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { getOrCreateCollection, ingestFile } from "@/lib/rag/ingest";
import { isSupported } from "@/lib/rag/extract";
import { pool } from "@/db";

async function* walk(dir: string): AsyncGenerator<string> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    // Skip Office lock/temp files like ~$report.docx.
    if (entry.name.startsWith("~$")) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (isSupported(full)) yield full;
  }
}

async function main() {
  const target = process.argv[2];
  const collectionName = process.argv[3] ?? "My Notes";
  if (!target) {
    console.error("Usage: npm run ingest -- <file-or-folder> [collectionName]");
    process.exit(1);
  }

  const collectionId = await getOrCreateCollection(collectionName);
  const info = await stat(target);
  const files: string[] = [];
  if (info.isDirectory()) {
    for await (const f of walk(target)) files.push(f);
  } else {
    files.push(target);
  }

  console.log(`Ingesting ${files.length} file(s) into "${collectionName}"...`);
  let added = 0;
  let skipped = 0;
  let failed = 0;
  for (const file of files) {
    try {
      const res = await ingestFile(file, collectionId);
      if (res.skipped) {
        skipped++;
      } else {
        added += res.chunks;
        console.log(`  + ${file} (${res.chunks} chunks)`);
      }
    } catch (err) {
      // One unreadable file should not abort the whole batch.
      failed++;
      console.warn(`  ! ${file}: ${err instanceof Error ? err.message : err}`);
    }
  }
  console.log(
    `Done. ${added} chunks added, ${skipped} unchanged/skipped, ${failed} failed.`
  );
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
