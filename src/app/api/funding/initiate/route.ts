import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/user";
import { rails } from "@/rails/factory";

// POST /api/funding/initiate — start an "add money" flow via the FundingSource
// contract. INITIATION + KYC only: this NEVER credits buckets. Crediting happens
// once, later, from the deposit event (deduped by txHash). Returns a FundingInit
// the client renders (hosted widget url / cash code / direct-deposit account).
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "not authenticated" }, { status: 401 });

  let amountUsd: number | undefined;
  try {
    const body = await req.json().catch(() => ({}));
    if (typeof body.amountUsd === "number" && body.amountUsd > 0) amountUsd = body.amountUsd;
  } catch {
    /* amount is optional */
  }

  const kyc = await rails.funding.getKycStatus(user);
  const init = await rails.funding.initiateFunding(user, amountUsd);
  return NextResponse.json({
    init,
    kyc,
    supportsDirectDeposit: rails.funding.supportsDirectDeposit,
    supportsCashIn: rails.funding.supportsCashIn,
    provider: rails.funding.id,
  });
}
