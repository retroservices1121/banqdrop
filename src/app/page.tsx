"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

// Mirrors MeDTO / BucketDTO from the server (money as plain numbers, never floats on-chain).
interface BucketDTO {
  id: string;
  name: string;
  color: string;
  pct: number;
  amountCents: number;
  amountUsd: number;
  isSpending: boolean;
  sortOrder: number;
}
interface MeDTO {
  user: { id: string; email: string | null; walletAddress: string; chain: string; kycStatus: string };
  buckets: BucketDTO[];
  totalLedgerCents: number;
  balanceUsd: number;
}

const usd = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

async function api<T>(url: string, body?: unknown, method = "POST"): Promise<T> {
  const res = await fetch(url, {
    method: body || method !== "GET" ? method : "GET",
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "request failed");
  return data as T;
}

export default function Home() {
  const [me, setMe] = useState<MeDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  const flash = useCallback((m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 3500);
  }, []);

  useEffect(() => {
    fetch("/api/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setMe(d))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Splash sub="loading…" />;
  if (!me) return <Onboarding onDone={setMe} />;

  return <Dashboard me={me} setMe={setMe} flash={flash} toast={toast} />;
}

function Splash({ sub }: { sub?: string }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-2 p-6 text-center">
      <h1 className="text-3xl font-semibold tracking-tight">banqdrop</h1>
      {sub && <p className="text-sm text-ink/50">{sub}</p>}
    </main>
  );
}

function Onboarding({ onDone }: { onDone: (m: MeDTO) => void }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function go() {
    setBusy(true);
    setErr(null);
    try {
      const me = await api<MeDTO>("/api/session", { email });
      onDone(me);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col justify-center gap-6 p-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">banqdrop</h1>
        <p className="text-sm text-ink/60">
          Money that lands splits itself into named buckets. One real balance, divided
          into envelopes you control.
        </p>
      </div>
      <div className="space-y-3">
        <input
          type="email"
          inputMode="email"
          placeholder="you@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && go()}
          className="w-full rounded-xl border border-ink/15 bg-white px-4 py-3 text-base outline-none focus:border-ink/40"
        />
        <button
          onClick={go}
          disabled={busy || !email}
          className="w-full rounded-xl bg-ink px-4 py-3 font-medium text-white disabled:opacity-40"
        >
          {busy ? "Setting up…" : "Open my account"}
        </button>
        {err && <p className="text-sm text-red-600">{err}</p>}
        <p className="text-center text-xs text-ink/40">
          Non-custodial wallet with assisted recovery · USDC on Polygon
        </p>
      </div>
    </main>
  );
}

function Dashboard({
  me,
  setMe,
  flash,
  toast,
}: {
  me: MeDTO;
  setMe: (m: MeDTO) => void;
  flash: (m: string) => void;
  toast: string | null;
}) {
  const spending = me.buckets.find((b) => b.isSpending) ?? me.buckets[0];
  const ledger = me.totalLedgerCents / 100;
  const drift = +(me.balanceUsd - ledger).toFixed(2);
  const [editing, setEditing] = useState(false);

  return (
    <main className="flex min-h-screen flex-col gap-5 p-5 pb-28">
      <header className="flex items-center justify-between pt-2">
        <span className="text-lg font-semibold tracking-tight">banqdrop</span>
        <button
          onClick={async () => {
            await fetch("/api/session", { method: "DELETE" });
            location.reload();
          }}
          className="text-xs text-ink/40"
        >
          {me.user.email}
        </button>
      </header>

      {/* Hero: ready to spend = the isSpending bucket (role, not name) */}
      <section className="rounded-3xl bg-ink p-6 text-white">
        <div className="flex items-center gap-2 text-xs text-white/60">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: spending?.color }} />
          Ready to spend · {spending?.name}
        </div>
        <div className="mt-1 text-5xl font-semibold tracking-tight">
          {usd(spending?.amountUsd ?? 0)}
        </div>
        <div className="mt-4 flex items-center justify-between text-xs text-white/50">
          <span>Live USDC balance {usd(me.balanceUsd)}</span>
          <InvariantPill drift={drift} />
        </div>
      </section>

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ink/70">Buckets</h2>
        <button
          onClick={() => setEditing((v) => !v)}
          className="text-sm font-medium text-ink/60 underline-offset-2 hover:underline"
        >
          {editing ? "Done" : "Edit split"}
        </button>
      </div>

      {editing ? (
        <SplitEditor me={me} setMe={setMe} flash={flash} onClose={() => setEditing(false)} />
      ) : (
        <ul className="space-y-2">
          {me.buckets.map((b) => (
            <BucketRow key={b.id} b={b} setMe={setMe} flash={flash} />
          ))}
        </ul>
      )}

      <DevTools setMe={setMe} flash={flash} />

      {toast && (
        <div className="fixed inset-x-0 bottom-5 mx-auto w-[92%] max-w-md rounded-xl bg-ink px-4 py-3 text-center text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
    </main>
  );
}

function InvariantPill({ drift }: { drift: number }) {
  const ok = Math.abs(drift) < 0.005;
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
        ok ? "bg-emerald-500/20 text-emerald-300" : "bg-amber-500/20 text-amber-300"
      }`}
    >
      {ok ? "✓ reconciled" : `drift ${usd(drift)}`}
    </span>
  );
}

function BucketRow({
  b,
  setMe,
  flash,
}: {
  b: BucketDTO;
  setMe: (m: MeDTO) => void;
  flash: (m: string) => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(b.name);

  async function saveName() {
    setRenaming(false);
    if (name.trim() && name.trim() !== b.name) {
      const me = await api<MeDTO>("/api/buckets/rename", { bucketId: b.id, name: name.trim() });
      setMe(me);
    } else {
      setName(b.name);
    }
  }

  async function makeSpending() {
    const me = await api<MeDTO>("/api/buckets/spending", { bucketId: b.id });
    setMe(me);
    flash(`"${b.name}" is now your spending bucket`);
  }

  return (
    <li className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm">
      <span className="h-9 w-9 shrink-0 rounded-full" style={{ background: b.color }} />
      <div className="min-w-0 flex-1">
        {renaming ? (
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={saveName}
            onKeyDown={(e) => e.key === "Enter" && saveName()}
            className="w-full rounded-md border border-ink/20 px-2 py-0.5 text-sm outline-none"
          />
        ) : (
          <button onClick={() => setRenaming(true)} className="block truncate text-left font-medium">
            {b.name}
          </button>
        )}
        <div className="text-xs text-ink/45">{b.pct}% of every deposit</div>
      </div>
      <div className="text-right">
        <div className="font-semibold tabular-nums">{usd(b.amountUsd)}</div>
      </div>
      <button
        onClick={makeSpending}
        title={b.isSpending ? "Spending bucket" : "Make spending bucket"}
        className={`text-xl ${b.isSpending ? "text-amber-400" : "text-ink/20 hover:text-ink/40"}`}
      >
        {b.isSpending ? "★" : "☆"}
      </button>
    </li>
  );
}

function SplitEditor({
  me,
  setMe,
  flash,
  onClose,
}: {
  me: MeDTO;
  setMe: (m: MeDTO) => void;
  flash: (m: string) => void;
  onClose: () => void;
}) {
  const [pcts, setPcts] = useState<Record<string, number>>(
    Object.fromEntries(me.buckets.map((b) => [b.id, b.pct]))
  );
  const total = useMemo(() => Object.values(pcts).reduce((s, v) => s + v, 0), [pcts]);
  const [busy, setBusy] = useState(false);

  function bump(id: string, delta: number) {
    setPcts((p) => ({ ...p, [id]: Math.max(0, Math.min(100, (p[id] ?? 0) + delta)) }));
  }

  async function save() {
    setBusy(true);
    try {
      const updated = await api<MeDTO>("/api/buckets/split", { pcts });
      setMe(updated);
      flash("Split updated");
      onClose();
    } catch (e) {
      flash((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <ul className="space-y-2">
        {me.buckets.map((b) => (
          <li key={b.id} className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm">
            <span className="h-7 w-7 shrink-0 rounded-full" style={{ background: b.color }} />
            <span className="flex-1 truncate font-medium">{b.name}</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => bump(b.id, -5)}
                className="h-7 w-7 rounded-full bg-ink/5 text-lg leading-none"
              >
                −
              </button>
              <span className="w-12 text-center font-semibold tabular-nums">{pcts[b.id]}%</span>
              <button
                onClick={() => bump(b.id, +5)}
                className="h-7 w-7 rounded-full bg-ink/5 text-lg leading-none"
              >
                +
              </button>
            </div>
          </li>
        ))}
      </ul>
      <div
        className={`flex items-center justify-between rounded-xl px-3 py-2 text-sm ${
          total === 100 ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
        }`}
      >
        <span>Total</span>
        <span className="font-semibold tabular-nums">{total}% / 100%</span>
      </div>
      <button
        onClick={save}
        disabled={total !== 100 || busy}
        className="w-full rounded-xl bg-ink px-4 py-3 font-medium text-white disabled:opacity-40"
      >
        {busy ? "Saving…" : total === 100 ? "Save split" : "Must total 100%"}
      </button>
    </div>
  );
}

// Dev-only harness to exercise split-on-arrival + reconciliation without real rails.
function DevTools({ setMe, flash }: { setMe: (m: MeDTO) => void; flash: (m: string) => void }) {
  const [amt, setAmt] = useState("100");

  async function fund() {
    const n = parseFloat(amt);
    if (!(n > 0)) return;
    const { results, me } = await api<{ results: { bucketSplits?: { name: string; addedCents: number }[] }[]; me: MeDTO }>(
      "/api/dev/fund",
      { amountUsd: n }
    );
    setMe(me);
    const split = results[0]?.bucketSplits
      ?.map((s) => `${s.name} +${usd(s.addedCents / 100)}`)
      .join(" · ");
    flash(`${usd(n)} landed → ${split ?? "split"}`);
  }
  async function spend() {
    const n = parseFloat(amt);
    if (!(n > 0)) return;
    const { me } = await api<{ me: MeDTO }>("/api/dev/spend", { amountUsd: n });
    setMe(me);
    flash(`Spent ${usd(n)} on-chain (creates drift until reconcile)`);
  }
  async function reconcile() {
    const { invariant, me } = await api<{ invariant: { ok: boolean; ledgerCents: number; chainCents: number }; me: MeDTO }>(
      "/api/reconcile"
    );
    setMe(me);
    flash(invariant.ok ? "✓ Reconciled — invariant holds" : "⚠ Invariant still off");
  }

  return (
    <section className="mt-2 space-y-2 rounded-2xl border border-dashed border-ink/15 p-3">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-ink/40">
        Dev harness (mock rails)
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm text-ink/50">$</span>
        <input
          value={amt}
          onChange={(e) => setAmt(e.target.value)}
          inputMode="decimal"
          className="w-20 rounded-lg border border-ink/15 px-2 py-1 text-sm outline-none"
        />
        <button onClick={fund} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white">
          Add money
        </button>
        <button onClick={spend} className="rounded-lg bg-ink/10 px-3 py-1.5 text-sm font-medium">
          Spend
        </button>
        <button onClick={reconcile} className="rounded-lg bg-ink/10 px-3 py-1.5 text-sm font-medium">
          Reconcile
        </button>
      </div>
    </section>
  );
}
