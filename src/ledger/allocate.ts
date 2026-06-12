// Largest-remainder (Hamilton) allocation of an inbound deposit across buckets by
// pct, in integer CENTS, so the split sums EXACTLY to the deposit — no penny drift.
//
// Guarantee: sum(result) === amountCents, for any pct[] summing to 100.

import type { Cents } from "@/lib/money";

export interface AllocInput {
  id: string;
  pct: number; // integer; the set must sum to 100
  sortOrder: number; // deterministic tie-break
}

/** Returns a map of bucketId -> cents to add. Sum of values === amountCents. */
export function allocateByPct(amountCents: Cents, buckets: AllocInput[]): Map<string, Cents> {
  const result = new Map<string, Cents>();
  if (buckets.length === 0) return result;

  const totalPct = buckets.reduce((s, b) => s + b.pct, 0);
  if (totalPct !== 100) {
    throw new Error(`bucket pct must sum to 100, got ${totalPct}`);
  }

  // base[i] = floor(amount * pct / 100); track fractional remainder numerator.
  const rows = buckets.map((b) => {
    const numerator = amountCents * b.pct; // exact integer
    const base = Math.floor(numerator / 100);
    const remainder = numerator % 100; // 0..99
    return { id: b.id, sortOrder: b.sortOrder, base, remainder };
  });

  const distributed = rows.reduce((s, r) => s + r.base, 0);
  let leftover = amountCents - distributed; // number of +1c to hand out (>= 0)

  // Hand the leftover cents to the largest remainders first.
  // Tie-break: lower sortOrder wins (stable, deterministic).
  const order = [...rows].sort((a, b) => {
    if (b.remainder !== a.remainder) return b.remainder - a.remainder;
    return a.sortOrder - b.sortOrder;
  });

  for (const r of rows) result.set(r.id, r.base);
  for (let i = 0; i < leftover; i++) {
    const r = order[i];
    result.set(r.id, (result.get(r.id) ?? 0) + 1);
  }

  return result;
}
