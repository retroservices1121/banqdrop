// Bucket ledger operations. All off-chain metadata + accounting; never touches keys
// or funds. Enforces the per-user rules: pct sums to 100, exactly one isSpending.

import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";

type Tx = Prisma.TransactionClient | PrismaClient;

/** Default envelopes seeded on first login. pct sums to 100; exactly one isSpending. */
export const DEFAULT_BUCKETS = [
  { name: "Spending", color: "#22c55e", pct: 40, isSpending: true, sortOrder: 0 },
  { name: "Bills", color: "#3b82f6", pct: 30, isSpending: false, sortOrder: 1 },
  { name: "Savings", color: "#a855f7", pct: 20, isSpending: false, sortOrder: 2 },
  { name: "Fun", color: "#f59e0b", pct: 10, isSpending: false, sortOrder: 3 },
] as const;

export async function seedDefaultBuckets(userId: string, db: Tx = prisma) {
  await db.bucket.createMany({
    data: DEFAULT_BUCKETS.map((b) => ({ ...b, userId })),
  });
}

export async function listBuckets(userId: string) {
  return prisma.bucket.findMany({
    where: { userId },
    orderBy: { sortOrder: "asc" },
  });
}

/** Update the split. Gate: the new pct set MUST sum to 100. */
export async function updateSplit(userId: string, pcts: Record<string, number>) {
  const buckets = await prisma.bucket.findMany({ where: { userId } });
  const total = buckets.reduce((s, b) => s + (pcts[b.id] ?? b.pct), 0);
  if (total !== 100) {
    throw new Error(`pct must sum to 100, got ${total}`);
  }
  await prisma.$transaction(
    buckets
      .filter((b) => pcts[b.id] !== undefined && pcts[b.id] !== b.pct)
      .map((b) =>
        prisma.bucket.update({ where: { id: b.id }, data: { pct: pcts[b.id] } })
      )
  );
}

/** Rename is instant + free — off-chain label only. Never changes isSpending. */
export async function renameBucket(userId: string, bucketId: string, name: string) {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("name required");
  await prisma.bucket.update({
    where: { id: bucketId, userId },
    data: { name: trimmed },
  });
}

/** Move the spending ROLE to a bucket. Exactly one isSpending per user — enforced
 *  by clearing all others in the same transaction. Independent of the name. */
export async function setSpendingBucket(userId: string, bucketId: string) {
  await prisma.$transaction([
    prisma.bucket.updateMany({ where: { userId }, data: { isSpending: false } }),
    prisma.bucket.update({ where: { id: bucketId, userId }, data: { isSpending: true } }),
  ]);
}

export async function getSpendingBucket(userId: string, db: Tx = prisma) {
  return db.bucket.findFirst({ where: { userId, isSpending: true } });
}
