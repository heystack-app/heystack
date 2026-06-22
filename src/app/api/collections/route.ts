import { sql } from "drizzle-orm";
import { db } from "@/db";

export type CollectionInfo = { id: string; name: string; documents: number };

// List collections with their document counts, for the UI picker.
export async function GET() {
  try {
    const res = await db.execute(sql`
      select col.id, col.name, count(d.id)::int as documents
      from collections col
      left join documents d on d.collection_id = col.id
      group by col.id, col.name
      order by col.name
    `);
    return Response.json({ collections: res.rows as CollectionInfo[] });
  } catch (err) {
    console.error("collections error", err);
    return Response.json({ error: "Could not load collections" }, { status: 500 });
  }
}
