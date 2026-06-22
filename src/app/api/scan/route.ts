import { scanStatus, startScan, cancelScan, defaultRoots } from "@/lib/scan";

// Current scan progress, plus the folders that would be scanned.
export async function GET() {
  return Response.json({ ...scanStatus(), defaultRoots: defaultRoots() });
}

// Start a scan in the background, or cancel a running one.
export async function POST(request: Request) {
  let body: { action?: string; roots?: string[] } = {};
  try {
    body = await request.json();
  } catch {
    // empty body is fine
  }

  if (body.action === "cancel") {
    cancelScan();
    return Response.json({ ok: true, ...scanStatus() });
  }

  const roots =
    Array.isArray(body.roots) && body.roots.length ? body.roots : undefined;
  // Fire and forget: the scan runs in the background, the UI polls GET /api/scan.
  void startScan(roots);
  return Response.json({ ok: true, ...scanStatus() });
}
