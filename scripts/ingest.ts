/**
 * Ingest a markdown file or a folder of markdown into a collection.
 *
 * Usage: npm run ingest -- <file-or-folder> [collectionName]
 * Example: npm run ingest -- "C:/Users/me/ObsidianVault" "My Notes"
 */
import { readdir, stat } from "node:fs/promises";
import { join, extname } from "node:path";
import { getOrCreateCollection, ingestMarkdownFile } from "@/lib/rag/ingest";
import { pool } from "@/db";

async function* walk(dir: string): AsyncGenerator<string> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (extname(entry.name).toLowerCase() === ".md") yield full;
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
  for (const file of files) {
    const res = await ingestMarkdownFile(file, collectionId);
    if (res.skipped) {
      skipped++;
    } else {
      added += res.chunks;
      console.log(`  + ${file} (${res.chunks} chunks)`);
    }
  }
  console.log(`Done. ${added} chunks added, ${skipped} unchanged/skipped.`);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
