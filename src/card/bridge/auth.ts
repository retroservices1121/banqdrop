// Real-time card authorization against the bucket ledger. This is what makes the card
// "spend from one bucket" exact instead of approximate: Stripe Issuing asks us to
// approve/decline each authorization synchronously, so we check the isSpending bucket's
// balance and decide. On capture we attribute the spend to that bucket precisely — which
// also retires the reconciliation-only attribution TODO for card spends.

import { createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/db";
import { centsToDecimal, decimalToCents } from "@/lib/money";

/** Verify Stripe's `Stripe-Signature: t=...,v1=...` header (HMAC-SHA256 of `t.body`). */
export function verifyStripeSignature(rawBody: string, sigHeader: string, secret: string): void {
  const parts: Record<string, string> = {};
  for (const kv of sigHeader.split(",")) {
    const [k, v] = kv.split("=");
    if (k && v) parts[k.trim()] = v.trim();
  }
  if (!parts.t || !parts.v1) throw new Error("malformed Stripe-Signature");
  const expected = createHmac("sha256", secret).update(`${parts.t}.${rawBody}`).digest("hex");
  const a = Buffer.from(parts.v1);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new Error("Stripe signature mismatch");
  }
}

export interface AuthDecision {
  approved: boolean;
  reason?: string;
  bucketId?: string;
  userId?: string;
  availableCents?: number;
}

async function spendingBucketFor(stripeCardId: string) {
  const card = await prisma.card.findFirst({
    where: { providerCardId: stripeCardId },
    include: { user: { include: { buckets: true } } },
  });
  if (!card) return null;
  const spending = card.user.buckets.find((b) => b.isSpending) ?? null;
  return spending ? { spending, userId: card.userId } : null;
}

/** Decide a real-time authorization: approve only if it fits the spending bucket. */
export async function decideAuthorization(
  stripeCardId: string,
  amountCents: number
): Promise<AuthDecision> {
  const found = await spendingBucketFor(stripeCardId);
  if (!found) return { approved: false, reason: "unknown card or no spending bucket" };
  const availableCents = decimalToCents(found.spending.amount);
  return {
    approved: amountCents <= availableCents,
    bucketId: found.spending.id,
    userId: found.userId,
    availableCents,
  };
}

/** Exact attribution on capture: decrement the spending bucket by the captured amount.
 *  NOTE before production: dedupe by the Stripe transaction id (add a CardSpend record)
 *  so retried webhooks can't double-decrement, and surface spends in the activity feed. */
export async function applyCapture(stripeCardId: string, amountCents: number): Promise<void> {
  const found = await spendingBucketFor(stripeCardId);
  if (!found) return;
  const current = decimalToCents(found.spending.amount);
  const dec = Math.min(amountCents, current); // never below zero
  await prisma.bucket.update({
    where: { id: found.spending.id },
    data: { amount: { decrement: centsToDecimal(dec) } },
  });
}
