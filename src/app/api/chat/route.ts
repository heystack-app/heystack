import { ask } from "@/lib/rag/ask";

// Route handlers are dynamic by default in Next 16, which is what we want here.
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

  try {
    const result = await ask(question, { collectionId: body.collectionId });
    return Response.json(result);
  } catch (err) {
    console.error("chat error", err);
    return Response.json(
      { error: "Something went wrong answering your question." },
      { status: 500 }
    );
  }
}
