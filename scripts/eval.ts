/**
 * Retrieval quality eval. Measures recall@k over the seeded "Demo" collection:
 * for each question, did the expected source appear in the top-k results?
 *
 * Requires Ollama + a seeded Demo collection (`npm run seed`). Run: `npm run eval`.
 * Exits non-zero if recall falls below the threshold, so it can gate releases.
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import { db, pool } from "@/db";
import { retrieve } from "@/lib/rag/retrieve";

type Case = { question: string; expect: string[]; topK?: number };

const THRESHOLD = 0.8;

async function main() {
  const cases: Case[] = JSON.parse(
    await readFile(join(process.cwd(), "eval", "cases.json"), "utf8")
  );

  const r = await db.execute(
    sql`select id from collections where name='Demo' limit 1`
  );
  const rows = r.rows as { id: string }[];
  if (rows.length === 0) {
    console.error('No "Demo" collection found. Run `npm run seed` first.');
    process.exit(1);
  }
  const collectionId = rows[0].id;

  console.log(
    `RAG retrieval eval — recall@k over the Demo set (${cases.length} cases)\n`
  );

  let hits = 0;
  for (const c of cases) {
    const topK = c.topK ?? 5;
    const res = await retrieve(c.question, { collectionId, topK });
    const sources = res.map((x) => x.source.toLowerCase());
    const hit = c.expect.some((e) =>
      sources.some((s) => s.includes(e.toLowerCase()))
    );
    if (hit) hits++;
    console.log(`${hit ? "PASS" : "FAIL"}  ${c.question}`);
    if (!hit) {
      console.log(`        expected one of [${c.expect.join(", ")}]`);
      console.log(
        `        got: ${res.map((x) => x.title).join(" | ") || "(nothing)"}`
      );
    }
  }

  const recall = cases.length ? hits / cases.length : 0;
  console.log(
    `\nRecall@k: ${hits}/${cases.length} = ${(recall * 100).toFixed(0)}%  ` +
      `(threshold ${THRESHOLD * 100}%)`
  );
  await pool.end();

  if (recall < THRESHOLD) {
    console.error("Eval failed: below threshold.");
    process.exit(1);
  }
  console.log("Eval passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
