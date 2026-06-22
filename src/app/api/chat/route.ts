import { askStream } from "@/lib/rag/ask";

// Streams newline-delimited JSON events:
//   {"type":"citations","citations":[...]}   once, up front
//   {"type":"token","text":"..."}            many, as the answer is generated
//   {"type":"done"}                          at the end
//   {"type":"error","message":"..."}         if generation fails mid-stream
export async function POST(request: Request) {
  let body: { question?: string; collectionId?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const question = body.question?.trim();
  if (!question) {
    return Response.json({ error: "Missing 'question'" }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
      try {
        const { citations, tokens } = await askStream(question, {
          collectionId: body.collectionId || undefined,
        });
        send({ type: "citations", citations });
        for await (const text of tokens) send({ type: "token", text });
        send({ type: "done" });
      } catch (err) {
        console.error("chat stream error", err);
        send({
          type: "error",
          message: "Something went wrong answering your question.",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
