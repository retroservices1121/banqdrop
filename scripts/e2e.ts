// End-to-end ledger test against a REAL Postgres (needs DATABASE_URL). Exercises
// the whole spine without HTTP: seed -> deposits (split-on-arrival) -> dedupe ->
// split change -> simulated spend -> reconcile, asserting the core invariant
//   sum(bucket.amount) == on-chain USDC balance
// holds at every step.
//
//   npm run e2e   (after DATABASE_URL is set + `prisma db push`)

import { prisma } from "../src/lib/db";
import { creditDeposit } from "../src/ledger/deposit";
import { reconcileUser, verifyInvariant } from "../src/ledger/reconcile";
import { seedDefaultBuckets, updateSplit } from "../src/ledger/buckets";
import {
  creditMockChain,
  debitMockChain,
  mockAddressFor,
} from "../src/rails/mock/provider";
import { randomUUID } from "node:crypto";

let fails = 0;
function ok(cond: boolean, msg: string) {
  console.log(`${cond ? "  ✓" : "  ✗"} ${msg}`);
  if (!cond) fails++;
}

async function ledgerCents(userId: string) {
  const bs = await prisma.bucket.findMany({ where: { userId } });
  return bs.reduce((s, b) => s + Math.round(b.amount.times(100).toNumber()), 0);
}

async function main() {
  const userId = "usr_e2e_test";
  const address = mockAddressFor(userId); // lowercase hex

  // Clean slate.
  await prisma.deposit.deleteMany({ where: { userId } });
  await prisma.bucket.deleteMany({ where: { userId } });
  await prisma.user.deleteMany({ where: { id: userId } });
  creditMockChain(address, -1e12); // not used; ensure map key exists at 0 below
  debitMockChain(address, -1e12);

  await prisma.user.create({
    data: { id: userId, walletAddress: address.toLowerCase(), chain: "polygon", email: null },
  });
  await seedDefaultBuckets(userId);

  console.log("split-on-arrival");
  const deposits = [100, 33.33, 0.01, 1234.56, 7.77];
  let total = 0;
  for (const amt of deposits) {
    creditMockChain(address, amt);
    const r = await creditDeposit({
      txHash: `mock:${randomUUID()}`,
      toAddress: address,
      amountUsd: amt,
      source: "mock",
    });
    total += Math.round(amt * 100);
    ok(r.status === "credited", `credited $${amt}`);
    const inv = await verifyInvariant(userId);
    ok(inv.ok, `invariant holds after $${amt} (ledger=${inv.ledgerCents} chain=${inv.chainCents})`);
  }
  ok((await ledgerCents(userId)) === total, `ledger sums to all deposits (${total}c)`);

  console.log("idempotency");
  const dupHash = `mock:${randomUUID()}`;
  creditMockChain(address, 50);
  const first = await creditDeposit({ txHash: dupHash, toAddress: address, amountUsd: 50, source: "mock" });
  const before = await ledgerCents(userId);
  const second = await creditDeposit({ txHash: dupHash, toAddress: address, amountUsd: 50, source: "mock" });
  const after = await ledgerCents(userId);
  ok(first.status === "credited" && second.status === "duplicate", "same txHash credited once");
  ok(before === after, "duplicate did not change the ledger");
  // chain was credited +50 but ledger only counted once -> reconcile will absorb it below.

  console.log("split change re-allocates future deposits");
  const buckets = await prisma.bucket.findMany({ where: { userId }, orderBy: { sortOrder: "asc" } });
  // 100/0/0/0 -> entire next deposit lands in the first bucket.
  await updateSplit(userId, {
    [buckets[0].id]: 100,
    [buckets[1].id]: 0,
    [buckets[2].id]: 0,
    [buckets[3].id]: 0,
  });
  const b0Before = Math.round((await prisma.bucket.findUniqueOrThrow({ where: { id: buckets[0].id } })).amount.times(100).toNumber());
  creditMockChain(address, 10);
  await creditDeposit({ txHash: `mock:${randomUUID()}`, toAddress: address, amountUsd: 10, source: "mock" });
  const b0After = Math.round((await prisma.bucket.findUniqueOrThrow({ where: { id: buckets[0].id } })).amount.times(100).toNumber());
  ok(b0After - b0Before === 1000, "100% split routed the full $10 to bucket 0");

  console.log("reconcile absorbs outflow + the earlier duplicate surplus");
  debitMockChain(address, 25); // simulate a card spend (chain only)
  const report = await reconcileUser(userId);
  const inv = await verifyInvariant(userId);
  ok(inv.ok, `invariant restored after reconcile (ledger=${inv.ledgerCents} chain=${inv.chainCents})`);
  ok(report.corrected, `reconcile applied drift to spending bucket (${report.note ?? ""})`);

  console.log(fails === 0 ? "\n✓ e2e passed" : `\n✗ ${fails} e2e failures`);
  await prisma.$disconnect();
  process.exit(fails === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
