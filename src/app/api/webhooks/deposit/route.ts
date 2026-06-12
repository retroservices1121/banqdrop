import { NextResponse } from "next/server";
import { ingestWebhook } from "@/ledger/deposit";

export const dynamic = "force-dynamic";

// POST /api/webhooks/deposit — the provider-agnostic deposit event sink.
// Reads the RAW body (signatures are computed over raw bytes), verifies + credits
// via the rails contract. This is where OMS's deposit webhook (or the Alchemy
// fallback) points. Crediting happens here ONCE, deduped by txHash.
export async function POST(req: Request) {
  const rawBody = await req.text();
  const headers: Record<string, string> = {};
  req.headers.forEach((v, k) => (headers[k] = v));

  try {
    const results = await ingestWebhook(rawBody, headers);
    return NextResponse.json({ ok: true, results });
  } catch (e) {
    // Signature failures land here -> 400 so the provider retries / alerts.
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 400 });
  }
}
