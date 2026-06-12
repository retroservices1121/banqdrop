// SPLIT-ON-ARRIVAL — the spine. Reacts to "USDC arrived for user X", however
// detected (mock now; OMS webhook / Alchemy fallback later). Crediting happens
// ONCE here, deduped by txHash. Provider status webhooks are UX-only and must
// never call this.

import { prisma } from "@/lib/db";
import { allocateByPct } from "./allocate";
import { centsToDecimal, dollarsToCents } from "@/lib/money";
import type { DepositEvent } from "@/rails/types";

export interface CreditResult {
  status: "credited" | "duplicate" | "no_user" | "ignored";
  txHash: string;
  amountUsd?: number;
  bucketSplits?: { bucketId: string; name: string; addedCents: number }[];
}

/** Idempotently credit one inbound deposit and split it across the user's buckets.
 *  All mutations (N bucket increments + the Deposit row) happen in ONE transaction,
 *  preserving the invariant sum(bucket.amount) == on-chain balance. */
export async function creditDeposit(evt: DepositEvent): Promise<CreditResult> {
  if (!(evt.amountUsd > 0)) return { status: "ignored", txHash: evt.txHash };

  const user = await prisma.user.findUnique({
    where: { walletAddress: evt.toAddress.toLowerCase() },
    include: { buckets: { orderBy: { sortOrder: "asc" } } },
  });
  if (!user) return { status: "no_user", txHash: evt.txHash };

  // Fast-path dedupe (the @unique on txHash is the hard guarantee below).
  const existing = await prisma.deposit.findUnique({ where: { txHash: evt.txHash } });
  if (existing) return { status: "duplicate", txHash: evt.txHash };

  const amountCents = dollarsToCents(evt.amountUsd);
  const alloc = allocateByPct(
    amountCents,
    user.buckets.map((b) => ({ id: b.id, pct: b.pct, sortOrder: b.sortOrder }))
  );

  try {
    await prisma.$transaction([
      // Create the Deposit row first: a duplicate txHash throws P2002 -> rollback,
      // so buckets are never double-credited.
      prisma.deposit.create({
        data: {
          userId: user.id,
          txHash: evt.txHash,
          amountUsd: centsToDecimal(amountCents),
          source: evt.source,
        },
      }),
      ...user.buckets
        .filter((b) => (alloc.get(b.id) ?? 0) !== 0)
        .map((b) =>
          prisma.bucket.update({
            where: { id: b.id },
            data: { amount: { increment: centsToDecimal(alloc.get(b.id)!) } },
          })
        ),
    ]);
  } catch (e: unknown) {
    if (typeof e === "object" && e && "code" in e && (e as { code: string }).code === "P2002") {
      return { status: "duplicate", txHash: evt.txHash };
    }
    throw e;
  }

  return {
    status: "credited",
    txHash: evt.txHash,
    amountUsd: evt.amountUsd,
    bucketSplits: user.buckets.map((b) => ({
      bucketId: b.id,
      name: b.name,
      addedCents: alloc.get(b.id) ?? 0,
    })),
  };
}
