import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser, loadMe } from "@/lib/user";
import { rails } from "@/rails/factory";
import { debitMockChain } from "@/rails/mock/provider";

const Body = z.object({ amountUsd: z.number().positive().max(1_000_000) });

// POST /api/dev/spend — DEV ONLY. Simulates a card spend / send: lowers the on-chain
// balance WITHOUT touching buckets, creating drift. Reconciliation then attributes
// that drift to the isSpending bucket. (Real card webhooks attribute exactly later.)
export async function POST(req: Request) {
  if ((process.env.RAILS_PROVIDER ?? "mock") !== "mock") {
    return NextResponse.json({ error: "dev spend only available on mock rails" }, { status: 403 });
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
  debitMockChain(wallet.address, parsed.amountUsd);

  const fresh = await getCurrentUser();
  return NextResponse.json({ me: await loadMe(fresh!) });
}
