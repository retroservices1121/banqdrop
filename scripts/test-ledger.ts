// Property test for the core invariant of split-on-arrival: the largest-remainder
// allocator must distribute EVERY cent — sum(parts) === amount — for any pct set
// that sums to 100, and must be deterministic. No DB required.
//
//   npm run test:ledger

import { allocateByPct, type AllocInput } from "../src/ledger/allocate";

let failures = 0;
function check(cond: boolean, msg: string) {
  if (!cond) {
    failures++;
    console.error("  ✗", msg);
  }
}

function buckets(pcts: number[]): AllocInput[] {
  return pcts.map((pct, i) => ({ id: `b${i}`, pct, sortOrder: i }));
}

function sum(m: Map<string, number>): number {
  let s = 0;
  for (const v of m.values()) s += v;
  return s;
}

// Deterministic pseudo-random pct sets summing to 100 (no Math.random — stable).
function randomSplit(seed: number, n: number): number[] {
  const parts: number[] = [];
  let remaining = 100;
  let s = seed;
  for (let i = 0; i < n - 1; i++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const max = remaining - (n - 1 - i); // leave at least 1 each for the rest
    const v = max <= 1 ? 1 : 1 + (s % max);
    parts.push(v);
    remaining -= v;
  }
  parts.push(remaining);
  return parts;
}

console.log("allocateByPct — exact-sum invariant");

// 1. Edge amounts across the default split.
const defaultPct = [40, 30, 20, 10];
for (const amt of [0, 1, 3, 7, 99, 100, 101, 333, 100000, 1, 2, 99999999]) {
  const m = allocateByPct(amt, buckets(defaultPct));
  check(sum(m) === amt, `default split: amount ${amt} -> sum ${sum(m)}`);
}

// 2. The classic penny-drift trap: three equal thirds of $0.10 (10c).
const thirds = allocateByPct(10, buckets([34, 33, 33]));
check(sum(thirds) === 10, `thirds of 10c sum to 10 (got ${sum(thirds)})`);

// 3. Fuzz: many random splits x many amounts.
let cases = 0;
for (let n = 1; n <= 8; n++) {
  for (let seed = 1; seed <= 200; seed++) {
    const pcts = randomSplit(seed, n);
    if (pcts.reduce((a, b) => a + b, 0) !== 100) continue; // skip malformed
    for (const amt of [0, 1, 5, 13, 100, 137, 9999, 123456]) {
      const m = allocateByPct(amt, buckets(pcts));
      check(sum(m) === amt, `n=${n} seed=${seed} amt=${amt} pct=[${pcts}] sum=${sum(m)}`);
      check([...m.values()].every((v) => v >= 0), `n=${n} seed=${seed} amt=${amt} negative part`);
      cases++;
    }
  }
}

// 4. Determinism: same inputs -> identical output.
const a = allocateByPct(137, buckets([40, 30, 20, 10]));
const b = allocateByPct(137, buckets([40, 30, 20, 10]));
check(JSON.stringify([...a]) === JSON.stringify([...b]), "allocation is deterministic");

// 5. Reject non-100 splits (the deposit gate).
let threw = false;
try {
  allocateByPct(100, buckets([50, 30]));
} catch {
  threw = true;
}
check(threw, "rejects pct not summing to 100");

console.log(`  ran ${cases + 19} cases`);
if (failures === 0) {
  console.log("✓ all invariant checks passed");
  process.exit(0);
} else {
  console.error(`✗ ${failures} failures`);
  process.exit(1);
}
