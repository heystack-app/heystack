import { sql } from "drizzle-orm";
import { db } from "@/db";

export type DocChunk = {
  id: string;
  chunkIndex: number;
  sectionPath: string | null;
  content: string;
};

export type DocView = {
  id: string;
  title: string;
  source: string;
  mimeType: string;
  chunks: DocChunk[];
};

// Return a full document reconstructed from its stored chunks, in order, so the
// UI can show the whole source and highlight the cited part.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const docRes = await db.execute(sql`
      select id, title, source, mime_type from documents where id = ${id} limit 1
    `);
    const docRows = docRes.rows as {
      id: string;
      title: string;
      source: string;
      mime_type: string;
    }[];
    if (docRows.length === 0) {
      return Response.json({ error: "Document not found" }, { status: 404 });
    }

    const chunkRes = await db.execute(sql`
      select id, chunk_index, section_path, content
      from chunks where document_id = ${id} order by chunk_index
    `);
    const chunks = (
      chunkRes.rows as {
        id: string;
        chunk_index: number;
        section_path: string | null;
        content: string;
      }[]
    ).map((c) => ({
      id: c.id,
      chunkIndex: c.chunk_index,
      sectionPath: c.section_path,
      content: c.content,
    }));

    const doc: DocView = {
      id: docRows[0].id,
      title: docRows[0].title,
      source: docRows[0].source,
      mimeType: docRows[0].mime_type,
      chunks,
    };
    return Response.json(doc);
  } catch (err) {
    console.error("document fetch error", err);
    return Response.json({ error: "Could not load document" }, { status: 400 });
  }
}
