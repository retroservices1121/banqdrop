"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

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
interface DepositDTO {
  id: string;
  txHash: string;
  amountUsd: number;
  source: string;
  createdAt: string;
}
type FundingInit =
  | { kind: "widget"; url: string }
  | { kind: "account"; accountNumber: string; routingNumber: string }
  | { kind: "cash"; code: string; locationId: string };

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
      onDone(await api<MeDTO>("/api/session", { email }));
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
  const [view, setView] = useState<"home" | "card">("home");
  const spending = me.buckets.find((b) => b.isSpending) ?? me.buckets[0];
  const drift = +(me.balanceUsd - me.totalLedgerCents / 100).toFixed(2);

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

      {view === "home" ? (
        <HomeView me={me} setMe={setMe} flash={flash} spending={spending} drift={drift} />
      ) : (
        <CardView me={me} spending={spending} />
      )}

      <BottomNav view={view} setView={setView} />

      {toast && (
        <div className="fixed inset-x-0 bottom-24 mx-auto w-[92%] max-w-md rounded-xl bg-ink px-4 py-3 text-center text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
    </main>
  );
}

function HomeView({
  me,
  setMe,
  flash,
  spending,
  drift,
}: {
  me: MeDTO;
  setMe: (m: MeDTO) => void;
  flash: (m: string) => void;
  spending: BucketDTO;
  drift: number;
}) {
  const [editing, setEditing] = useState(false);
  return (
    <>
      <section className="rounded-3xl bg-ink p-6 text-white">
        <div className="flex items-center gap-2 text-xs text-white/60">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: spending?.color }} />
          Ready to spend · {spending?.name}
        </div>
        <div className="mt-1 text-5xl font-semibold tracking-tight">{usd(spending?.amountUsd ?? 0)}</div>
        <div className="mt-4 flex items-center justify-between text-xs text-white/50">
          <span>Live USDC balance {usd(me.balanceUsd)}</span>
          <InvariantPill drift={drift} />
        </div>
      </section>

      <AddMoney flash={flash} />

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
    </>
  );
}

function AddMoney({ flash }: { flash: (m: string) => void }) {
  const router = useRouter();
  const [sheet, setSheet] = useState<FundingInit | null>(null);
  const [busy, setBusy] = useState(false);

  async function start() {
    setBusy(true);
    try {
      const { init } = await api<{ init: FundingInit }>("/api/funding/initiate", {});
      if (init.kind === "widget") {
        router.push(init.url); // hosted ramp (OMS in prod; simulated locally)
      } else {
        setSheet(init); // cash code / direct-deposit account
      }
    } catch (e) {
      flash((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        onClick={start}
        disabled={busy}
        className="w-full rounded-2xl bg-emerald-600 px-4 py-3 font-medium text-white disabled:opacity-50"
      >
        {busy ? "Starting…" : "Add money"}
      </button>
      {sheet && sheet.kind !== "widget" && (
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          {sheet.kind === "account" ? (
            <div className="space-y-1 text-sm">
              <div className="font-semibold">Direct deposit</div>
              <div className="text-ink/60">Routing {sheet.routingNumber}</div>
              <div className="text-ink/60">Account {sheet.accountNumber}</div>
            </div>
          ) : (
            <div className="space-y-1 text-sm">
              <div className="font-semibold">Cash-in code</div>
              <div className="text-2xl font-bold tracking-widest">{sheet.code}</div>
              <div className="text-ink/60">Show this at location {sheet.locationId}</div>
            </div>
          )}
          <button onClick={() => setSheet(null)} className="mt-3 text-sm text-ink/45">
            Close
          </button>
        </div>
      )}
    </>
  );
}

function CardView({ me, spending }: { me: MeDTO; spending: BucketDTO }) {
  return (
    <>
      <section
        className="relative overflow-hidden rounded-3xl p-6 text-white shadow-lg"
        style={{ background: `linear-gradient(135deg, ${spending?.color}, #0d0f1a)` }}
      >
        <div className="text-xs uppercase tracking-widest text-white/70">banqdrop card</div>
        <div className="mt-8 font-mono text-lg tracking-widest">•••• •••• •••• 4242</div>
        <div className="mt-4 flex items-end justify-between">
          <div>
            <div className="text-[10px] uppercase text-white/60">Spends from</div>
            <div className="font-semibold">{spending?.name}</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase text-white/60">Available</div>
            <div className="font-semibold tabular-nums">{usd(spending?.amountUsd ?? 0)}</div>
          </div>
        </div>
      </section>
      <p className="text-center text-xs text-ink/45">
        The card draws from your spending bucket. Change it with the ★ on any bucket.
      </p>
      <div className="rounded-xl bg-ink/5 px-3 py-2 text-center text-[11px] text-ink/45">
        {me.user.walletAddress.slice(0, 10)}…{me.user.walletAddress.slice(-6)} · {me.user.chain} · KYC{" "}
        {me.user.kycStatus}
      </div>
      <Activity />
    </>
  );
}

function Activity() {
  const [deposits, setDeposits] = useState<DepositDTO[] | null>(null);
  useEffect(() => {
    fetch("/api/transactions")
      .then((r) => (r.ok ? r.json() : { deposits: [] }))
      .then((d) => setDeposits(d.deposits));
  }, []);

  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold text-ink/70">Activity</h2>
      {!deposits ? (
        <p className="text-sm text-ink/40">loading…</p>
      ) : deposits.length === 0 ? (
        <p className="rounded-2xl bg-white p-4 text-center text-sm text-ink/40 shadow-sm">
          No deposits yet. Tap “Add money”.
        </p>
      ) : (
        <ul className="space-y-2">
          {deposits.map((d) => (
            <li key={d.id} className="flex items-center justify-between rounded-2xl bg-white p-3 shadow-sm">
              <div>
                <div className="font-medium">Deposit · split across buckets</div>
                <div className="text-xs text-ink/45">
                  {new Date(d.createdAt).toLocaleString()} · {d.source}
                </div>
              </div>
              <div className="font-semibold tabular-nums text-emerald-600">+{usd(d.amountUsd)}</div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function BottomNav({ view, setView }: { view: "home" | "card"; setView: (v: "home" | "card") => void }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 mx-auto flex w-full max-w-md items-center justify-around border-t border-ink/10 bg-paper/95 py-2 backdrop-blur">
      {(["home", "card"] as const).map((v) => (
        <button
          key={v}
          onClick={() => setView(v)}
          className={`flex flex-col items-center gap-0.5 px-8 py-1 text-xs ${
            view === v ? "font-semibold text-ink" : "text-ink/40"
          }`}
        >
          <span className="text-lg">{v === "home" ? "◎" : "▭"}</span>
          {v === "home" ? "Buckets" : "Card"}
        </button>
      ))}
    </nav>
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
      setMe(await api<MeDTO>("/api/buckets/rename", { bucketId: b.id, name: name.trim() }));
    } else {
      setName(b.name);
    }
  }
  async function makeSpending() {
    setMe(await api<MeDTO>("/api/buckets/spending", { bucketId: b.id }));
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
      setMe(await api<MeDTO>("/api/buckets/split", { pcts }));
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
              <button onClick={() => bump(b.id, -5)} className="h-7 w-7 rounded-full bg-ink/5 text-lg leading-none">
                −
              </button>
              <span className="w-12 text-center font-semibold tabular-nums">{pcts[b.id]}%</span>
              <button onClick={() => bump(b.id, +5)} className="h-7 w-7 rounded-full bg-ink/5 text-lg leading-none">
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

// Dev-only harness to exercise spend + reconcile without real rails.
function DevTools({ setMe, flash }: { setMe: (m: MeDTO) => void; flash: (m: string) => void }) {
  const [amt, setAmt] = useState("40");

  async function spend() {
    const n = parseFloat(amt);
    if (!(n > 0)) return;
    const { me } = await api<{ me: MeDTO }>("/api/dev/spend", { amountUsd: n });
    setMe(me);
    flash(`Spent ${usd(n)} on-chain (creates drift until reconcile)`);
  }
  async function reconcile() {
    const { invariant, me } = await api<{ invariant: { ok: boolean }; me: MeDTO }>("/api/reconcile");
    setMe(me);
    flash(invariant.ok ? "✓ Reconciled — invariant holds" : "⚠ Invariant still off");
  }

  return (
    <section className="mt-2 space-y-2 rounded-2xl border border-dashed border-ink/15 p-3">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-ink/40">
        Dev harness (mock rails) — simulate card spend
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm text-ink/50">$</span>
        <input
          value={amt}
          onChange={(e) => setAmt(e.target.value)}
          inputMode="decimal"
          className="w-20 rounded-lg border border-ink/15 px-2 py-1 text-sm outline-none"
        />
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
