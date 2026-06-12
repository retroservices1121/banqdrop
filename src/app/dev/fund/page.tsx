"use client";

// Simulated hosted ramp — the target of the mock FundingSource 'widget' FundingInit.
// Stands in for OMS's hosted on-ramp UI. It does NOT credit buckets; it triggers the
// mock deposit event (POST /api/dev/fund), which credits ONCE via split-on-arrival.

import { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";

function Ramp() {
  const params = useSearchParams();
  const router = useRouter();
  const [amount, setAmount] = useState(params.get("amount") ?? "100");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  async function deposit() {
    const n = parseFloat(amount);
    if (!(n > 0)) return;
    setBusy(true);
    const res = await fetch("/api/dev/fund", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ amountUsd: n }),
    });
    const data = await res.json();
    setBusy(false);
    if (res.ok) {
      const split = data.results?.[0]?.bucketSplits
        ?.map((s: { name: string; addedCents: number }) => `${s.name} +$${(s.addedCents / 100).toFixed(2)}`)
        .join(" · ");
      setDone(split ?? "Deposited");
      setTimeout(() => router.push("/"), 1400);
    } else {
      setDone(data.error ?? "failed");
    }
  }

  return (
    <main className="flex min-h-screen flex-col justify-center gap-5 p-6">
      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <div className="text-xs font-semibold uppercase tracking-wide text-ink/40">
          Hosted on-ramp (simulated)
        </div>
        <h1 className="mt-1 text-xl font-semibold">Add money to banqdrop</h1>
        <p className="mt-1 text-sm text-ink/55">
          In production this is the OMS hosted ramp (ACH / debit / cash). USDC lands on
          your wallet, then auto-splits across your buckets.
        </p>
        <div className="mt-4 flex items-center gap-2">
          <span className="text-2xl font-semibold text-ink/40">$</span>
          <input
            autoFocus
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="decimal"
            className="w-full rounded-xl border border-ink/15 px-3 py-2 text-2xl font-semibold outline-none focus:border-ink/40"
          />
        </div>
        {done ? (
          <div className="mt-4 rounded-xl bg-emerald-50 px-3 py-3 text-center text-sm text-emerald-700">
            ✓ {done}
            <div className="text-xs text-emerald-600/70">returning…</div>
          </div>
        ) : (
          <button
            onClick={deposit}
            disabled={busy}
            className="mt-4 w-full rounded-xl bg-ink px-4 py-3 font-medium text-white disabled:opacity-40"
          >
            {busy ? "Processing…" : `Deposit $${amount || "0"}`}
          </button>
        )}
        <button onClick={() => router.push("/")} className="mt-2 w-full py-2 text-sm text-ink/45">
          Cancel
        </button>
      </div>
    </main>
  );
}

export default function DevFundPage() {
  return (
    <Suspense fallback={<main className="p-6 text-sm text-ink/50">Loading…</main>}>
      <Ramp />
    </Suspense>
  );
}
