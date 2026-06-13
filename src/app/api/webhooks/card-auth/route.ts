import { NextResponse } from "next/server";
import { applyCapture, decideAuthorization, verifyStripeSignature } from "@/card/bridge/auth";

export const dynamic = "force-dynamic";

// POST /api/webhooks/card-auth — Stripe Issuing real-time authorization + transactions.
// Enforces the bucket model at the network edge: an authorization is approved only if it
// fits the isSpending bucket; captures attribute the spend to that bucket exactly.
//
// SCAFFOLD: confirm Stripe's exact real-time-authorization response contract at
// integration time (respond synchronously here vs. call the approve/decline API). Amounts
// from Stripe are in minor units (cents).
export async function POST(req: Request) {
  const rawBody = await req.text();
  const secret = process.env.STRIPE_ISSUING_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "card-auth webhook not configured" }, { status: 503 });
  }
  try {
    verifyStripeSignature(rawBody, req.headers.get("stripe-signature") ?? "", secret);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }

  const event = JSON.parse(rawBody) as {
    type: string;
    data: { object: { id: string; amount: number; card: string } };
  };
  const obj = event.data.object;

  switch (event.type) {
    case "issuing_authorization.request": {
      // Synchronous approve/decline based on the spending bucket balance.
      const decision = await decideAuthorization(obj.card, Math.abs(obj.amount));
      return NextResponse.json({ approved: decision.approved, metadata: { bucketId: decision.bucketId ?? "" } });
    }
    case "issuing_transaction.created": {
      // Settled spend -> attribute to the spending bucket exactly (keeps the invariant
      // without waiting for reconciliation).
      await applyCapture(obj.card, Math.abs(obj.amount));
      return NextResponse.json({ ok: true });
    }
    default:
      return NextResponse.json({ ignored: event.type });
  }
}
