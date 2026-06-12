import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser, loadMe } from "@/lib/user";
import { rails } from "@/rails/factory";
import { creditMockChain, signMockWebhook } from "@/rails/mock/provider";
import { ingestWebhook } from "@/ledger/deposit";

const Body = z.object({ amountUsd: z.number().positive().max(1_000_000) });

// POST /api/dev/fund — DEV ONLY. Simulates "USDC arrived" end-to-end: bumps the
// mock on-chain balance, then delivers a SIGNED deposit webhook through the exact
// same ingest path a real provider would hit. Proves split-on-arrival + invariant.
export async function POST(req: Request) {
  if ((process.env.RAILS_PROVIDER ?? "mock") !== "mock") {
    return NextResponse.json({ error: "dev funding only available on mock rails" }, { status: 403 });
  }
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "not authenticated" }, { status: 401 });

  let parsed;
  try {
    parsed = Body.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "amountUsd required (> 0)" }, { status: 400 });
  }

  const wallet = await rails.ensureWallet(user);
  // 1) Funds land on-chain (mock).
  creditMockChain(wallet.address, parsed.amountUsd);
  // 2) Provider fires a signed deposit webhook -> our ingest path credits buckets.
  const payload = JSON.stringify({
    txHash: `mock:${randomUUID()}`,
    toAddress: wallet.address,
    amountUsd: parsed.amountUsd,
  });
  const results = await ingestWebhook(payload, { "x-mock-signature": signMockWebhook(payload) });

  const fresh = await getCurrentUser();
  return NextResponse.json({ results, me: await loadMe(fresh!) });
}
