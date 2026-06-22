/**
 * Seed the demo knowledge base (the demo/ folder) into a "Demo" collection,
 * so a fresh install has something interesting to chat with immediately.
 *
 * Usage: npm run seed
 */
import { readdir, stat } from "node:fs/promises";
import { join, relative } from "node:path";
import { getOrCreateCollection, ingestFile } from "@/lib/rag/ingest";
import { isSupported } from "@/lib/rag/extract";
import { pool } from "@/db";

async function* walk(dir: string): AsyncGenerator<string> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith("~$")) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (isSupported(full)) yield full;
  }
}

async function main() {
  const demoDir = join(process.cwd(), "demo");
  try {
    await stat(demoDir);
  } catch {
    console.error(`No demo folder found at ${demoDir}`);
    process.exit(1);
  }

  const collectionId = await getOrCreateCollection("Demo");
  console.log('Seeding the "Demo" collection from demo/ ...');

  let added = 0;
  let skipped = 0;
  let failed = 0;
  for await (const file of walk(demoDir)) {
    // Store a clean, portable relative source (e.g. demo/coffee-guide.pdf)
    // rather than an absolute path with the machine's username.
    const source = relative(process.cwd(), file).split("\\").join("/");
    try {
      const res = await ingestFile(source, collectionId);
      if (res.skipped) {
        skipped++;
      } else {
        added += res.chunks;
        console.log(`  + ${file} (${res.chunks} chunks)`);
      }
    } catch (err) {
      failed++;
      console.warn(`  ! ${file}: ${err instanceof Error ? err.message : err}`);
    }
  }

  console.log(
    `Done. ${added} chunks added, ${skipped} unchanged, ${failed} failed.`
  );
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
