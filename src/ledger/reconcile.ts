// Reconciliation. The chain doesn't say which bucket an outflow (card spend / send)
// came from. v1 rule: attribute drift to the isSpending bucket. This job compares
// sum(bucket.amount) to the live on-chain balance and corrects the difference
// against the spending bucket, restoring the invariant.

import { prisma } from "@/lib/db";
import { rails } from "@/rails/factory";
import { centsToDecimal, decimalToCents } from "@/lib/money";
import { Prisma } from "@prisma/client";

export interface ReconcileReport {
  userId: string;
  ledgerCents: number;
  chainCents: number;
  driftCents: number; // chain - ledger; negative = outflow not yet reflected
  corrected: boolean;
  note?: string;
}

export async function reconcileUser(userId: string): Promise<ReconcileReport> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { buckets: true },
  });
  if (!user) throw new Error(`no user ${userId}`);

  const wallet = await rails.ensureWallet(user);
  const chainCents = Math.round((await wallet.getUsdcBalance()) * 100);
  const ledgerCents = user.buckets.reduce((s, b) => s + decimalToCents(b.amount), 0);
  const driftCents = chainCents - ledgerCents;

  if (driftCents === 0) {
    return { userId, ledgerCents, chainCents, driftCents, corrected: false };
  }

  const spending =
    user.buckets.find((b) => b.isSpending) ??
    [...user.buckets].sort((a, b) => a.sortOrder - b.sortOrder)[0];
  if (!spending) {
    return {
      userId,
      ledgerCents,
      chainCents,
      driftCents,
      corrected: false,
      note: "no buckets to reconcile against",
    };
  }

  // Apply drift to the spending bucket, clamped so it never goes negative.
  const spendingCents = decimalToCents(spending.amount);
  const applied = Math.max(driftCents, -spendingCents);
  await prisma.bucket.update({
    where: { id: spending.id },
    data: { amount: { increment: centsToDecimal(applied) } },
  });

  return {
    userId,
    ledgerCents,
    chainCents,
    driftCents,
    corrected: true,
    note:
      applied !== driftCents
        ? `clamped: spending bucket floored at 0 (residual ${driftCents - applied}c)`
        : `applied ${applied}c to "${spending.name}"`,
  };
}

/** Hard invariant check used by tests + the periodic job. */
export async function verifyInvariant(userId: string): Promise<{
  ok: boolean;
  ledgerCents: number;
  chainCents: number;
}> {
  const user = await prisma.user.findUnique({ where: { id: userId }, include: { buckets: true } });
  if (!user) throw new Error(`no user ${userId}`);
  const wallet = await rails.ensureWallet(user);
  const chainCents = Math.round((await wallet.getUsdcBalance()) * 100);
  const ledgerCents = user.buckets.reduce(
    (s, b) => s + decimalToCents(b.amount as Prisma.Decimal),
    0
  );
  return { ok: ledgerCents === chainCents, ledgerCents, chainCents };
}
