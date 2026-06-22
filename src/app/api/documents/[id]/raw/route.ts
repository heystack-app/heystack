import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { sql } from "drizzle-orm";
import { db } from "@/db";

// Serve the original file bytes for a document, so the UI can embed it (e.g. a
// PDF in an iframe) instead of showing extracted text.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const res = await db.execute(sql`
      select source, mime_type from documents where id = ${id} limit 1
    `);
    const rows = res.rows as { source: string; mime_type: string }[];
    if (rows.length === 0) return new Response("Not found", { status: 404 });

    const buf = await readFile(rows[0].source);
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": rows[0].mime_type || "application/octet-stream",
        "Content-Disposition": `inline; filename="${encodeURIComponent(
          basename(rows[0].source)
        )}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("raw document error", err);
    return new Response("Could not load file", { status: 400 });
  }
}
