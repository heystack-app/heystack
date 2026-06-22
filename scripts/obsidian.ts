/**
 * Sync an Obsidian vault (a folder of markdown) into a collection.
 *
 * Usage: npm run obsidian -- <vaultPath> [collectionName] [--watch]
 * Examples:
 *   npm run obsidian -- "C:/Users/me/MyVault" "My Vault"
 *   npm run obsidian -- "C:/Users/me/MyVault" "My Vault" --watch
 */
import { getOrCreateCollection } from "@/lib/rag/ingest";
import { syncVault, watchVault } from "@/lib/connectors/obsidian";
import { pool } from "@/db";

async function main() {
  const args = process.argv.slice(2);
  const watch = args.includes("--watch");
  const positional = args.filter((a) => !a.startsWith("--"));
  const vaultPath = positional[0];
  const collectionName = positional[1] ?? "Obsidian";

  if (!vaultPath) {
    console.error(
      "Usage: npm run obsidian -- <vaultPath> [collectionName] [--watch]"
    );
    process.exit(1);
  }

  const collectionId = await getOrCreateCollection(collectionName);
  console.log(`Syncing vault "${vaultPath}" into "${collectionName}"...`);

  const summary = await syncVault(vaultPath, collectionId, (rel, res) => {
    if (!res.skipped) console.log(`  + ${rel} (${res.chunks} chunks)`);
  });
  console.log(
    `Sync done. ${summary.added} added, ${summary.chunks} chunks, ` +
      `${summary.skipped} unchanged, ${summary.removed} removed.`
  );

  if (watch) {
    console.log("Watching for changes. Press Ctrl+C to stop.");
    const watcher = watchVault(vaultPath, collectionId, (msg) => console.log(msg));
    const shutdown = async () => {
      await watcher.close();
      await pool.end();
      process.exit(0);
    };
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  } else {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
