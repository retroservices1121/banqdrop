"use client";

// Marketing landing at "/". The actual app lives at /app. App previews below are
// rendered with the SAME UI the live app shows (default buckets after a $1,000
// deposit), so the landing is honest — not prototype mockups.

import { useEffect, useState } from "react";
import Link from "next/link";

interface BIPEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const usd = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

// Default buckets after a $1,000 deposit — exactly what /app seeds + splits.
const BUCKETS = [
  { name: "Spending", color: "#22c55e", pct: 40, usd: 400, spending: true },
  { name: "Bills", color: "#3b82f6", pct: 30, usd: 300, spending: false },
  { name: "Savings", color: "#a855f7", pct: 20, usd: 200, spending: false },
  { name: "Fun", color: "#f59e0b", pct: 10, usd: 100, spending: false },
];

const FEATURES = [
  { t: "Money splits itself", d: "Every deposit auto-divides across your named buckets by the percentages you set — no manual transfers, no penny drift." },
  { t: "Spend from a bucket", d: "A card draws from whichever bucket you choose. Move the role anytime; renaming a bucket is free." },
  { t: "Fund it any way", d: "Bank transfer, debit, direct deposit, or in-person cash. USDC lands, buckets fill the instant it arrives." },
  { t: "Yours, with a safety net", d: "A non-custodial wallet with assisted recovery. One real balance, divided into envelopes you control." },
];

export default function Landing() {
  return (
    <main className="min-h-screen bg-paper text-ink">
      <Header />
      <Hero />
      <BrandBand />
      <Showcase />
      <Features />
      <HowItWorks />
      <InstallSection />
      <Footer />
    </main>
  );
}

function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-semibold tracking-tight ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/logo.png" alt="banqdrop" className="h-7 w-7 object-contain" />
      banqdrop
    </span>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-ink/10 bg-paper/80 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-3">
        <Wordmark className="text-lg" />
        <Link href="/app" className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-white hover:bg-ink/90">
          Open the app
        </Link>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="mx-auto grid max-w-5xl items-center gap-12 px-5 py-14 md:grid-cols-2 md:py-20">
      <div className="space-y-6">
        <span className="inline-block rounded-full bg-ink/5 px-3 py-1 text-xs font-medium text-ink/60">
          Envelope budgeting on stablecoin rails
        </span>
        <h1 className="text-4xl font-semibold leading-[1.04] tracking-tight md:text-6xl">
          Money that lands <span className="text-emerald-600">splits itself.</span>
        </h1>
        <p className="max-w-md text-lg text-ink/60">
          banqdrop is an envelope-native account. Deposits auto-divide into named buckets by the
          percentages you set — and a card spends from whichever bucket you pick.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/app" className="rounded-xl bg-ink px-5 py-3 font-medium text-white hover:bg-ink/90">
            Open the app
          </Link>
          <InstallButton />
        </div>
        <p className="text-xs text-ink/40">
          Installs as an app — no App Store. Non-custodial with assisted recovery · USDC.
        </p>
      </div>
      <div className="flex justify-center">
        <PhoneFrame>
          <BucketsScreen />
        </PhoneFrame>
      </div>
    </section>
  );
}

function BrandBand() {
  return (
    <section className="bg-ink py-12 text-white">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 px-5 text-center">
        <video
          src="/brand/logo-animation.mp4"
          autoPlay
          muted
          loop
          playsInline
          className="h-28 w-auto rounded-2xl ring-1 ring-white/10"
        />
        <p className="max-w-lg text-lg text-white/70">
          One real balance. Divided into envelopes. Spent with a card — all on rails you never have to think about.
        </p>
      </div>
    </section>
  );
}

function Showcase() {
  return (
    <section className="border-b border-ink/10 bg-white py-14">
      <div className="mx-auto max-w-5xl px-5">
        <h2 className="text-center text-sm font-semibold uppercase tracking-widest text-ink/40">
          The actual app
        </h2>
        <div className="mt-8 flex snap-x gap-8 overflow-x-auto pb-4 md:justify-center">
          <div className="shrink-0 snap-center">
            <PhoneFrame>
              <SplitScreen />
            </PhoneFrame>
            <p className="mt-3 text-center text-sm text-ink/50">Set your split — must total 100%</p>
          </div>
          <div className="shrink-0 snap-center">
            <PhoneFrame>
              <CardScreen />
            </PhoneFrame>
            <p className="mt-3 text-center text-sm text-ink/50">A card that spends from one bucket</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function Features() {
  return (
    <section className="mx-auto max-w-5xl px-5 py-16">
      <div className="grid gap-4 sm:grid-cols-2">
        {FEATURES.map((f) => (
          <div key={f.t} className="rounded-2xl border border-ink/10 bg-white p-6">
            <h3 className="text-lg font-semibold">{f.t}</h3>
            <p className="mt-1 text-sm text-ink/60">{f.d}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    { n: "1", t: "Open your account", d: "Email gets you a wallet in seconds. Buckets are seeded for you." },
    { n: "2", t: "Set your split", d: "Decide what share of every deposit goes to each bucket. Must total 100%." },
    { n: "3", t: "Add money", d: "Fund it — the deposit splits across buckets the instant it lands." },
  ];
  return (
    <section className="bg-ink py-16 text-white">
      <div className="mx-auto max-w-5xl px-5">
        <h2 className="text-2xl font-semibold tracking-tight">How it works</h2>
        <div className="mt-8 grid gap-6 md:grid-cols-3">
          {steps.map((s) => (
            <div key={s.n} className="space-y-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500 font-semibold">
                {s.n}
              </div>
              <h3 className="font-semibold">{s.t}</h3>
              <p className="text-sm text-white/60">{s.d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function InstallSection() {
  return (
    <section className="mx-auto max-w-5xl px-5 py-16 text-center">
      <h2 className="text-3xl font-semibold tracking-tight">Get banqdrop</h2>
      <p className="mx-auto mt-2 max-w-md text-ink/60">
        Add it to your home screen and it runs like a native app — full screen, with alerts when money
        lands. No store, no download wait.
      </p>
      <div className="mt-6 flex justify-center">
        <InstallButton large />
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-ink/10 bg-white">
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 px-5 py-8 text-sm text-ink/50 sm:flex-row">
        <Wordmark className="text-base text-ink/70" />
        <p>Non-custodial with assisted recovery · USDC · PWA</p>
        <Link href="/app" className="font-medium text-ink/70 hover:text-ink">
          Open the app →
        </Link>
      </div>
    </footer>
  );
}

/* ---------- App previews (rendered with the real UI) ---------- */

function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative w-[268px] rounded-[2.6rem] border-[10px] border-ink bg-ink shadow-2xl">
      <div className="absolute left-1/2 top-0 z-10 h-5 w-28 -translate-x-1/2 rounded-b-2xl bg-ink" />
      <div className="h-[540px] overflow-hidden rounded-[2rem] bg-paper">{children}</div>
    </div>
  );
}

function BucketsScreen() {
  const spending = BUCKETS.find((b) => b.spending)!;
  return (
    <div className="flex h-full flex-col gap-3 p-4">
      <div className="flex items-center justify-between pt-1">
        <span className="text-sm font-semibold">banqdrop</span>
        <span className="text-[10px] text-ink/40">you@email.com</span>
      </div>
      <div className="rounded-2xl bg-ink p-4 text-white">
        <div className="flex items-center gap-1.5 text-[10px] text-white/60">
          <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: spending.color }} />
          Ready to spend · {spending.name}
        </div>
        <div className="mt-0.5 text-3xl font-semibold tracking-tight">{usd(spending.usd)}</div>
        <div className="mt-3 flex items-center justify-between text-[10px] text-white/50">
          <span>Live balance {usd(1000)}</span>
          <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-emerald-300">✓ reconciled</span>
        </div>
      </div>
      <div className="text-[11px] font-semibold text-ink/60">Buckets</div>
      <ul className="space-y-1.5">
        {BUCKETS.map((b) => (
          <li key={b.name} className="flex items-center gap-2 rounded-xl bg-white p-2 shadow-sm">
            <span className="h-7 w-7 shrink-0 rounded-full" style={{ background: b.color }} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{b.name}</div>
              <div className="text-[10px] text-ink/45">{b.pct}% of every deposit</div>
            </div>
            <div className="text-sm font-semibold tabular-nums">{usd(b.usd)}</div>
            <span className={`text-base ${b.spending ? "text-amber-400" : "text-ink/20"}`}>
              {b.spending ? "★" : "☆"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SplitScreen() {
  return (
    <div className="flex h-full flex-col gap-2 p-4">
      <div className="flex items-center justify-between pt-1">
        <span className="text-sm font-semibold">Edit split</span>
        <span className="text-[11px] text-ink/50">Done</span>
      </div>
      <ul className="space-y-1.5">
        {BUCKETS.map((b) => (
          <li key={b.name} className="flex items-center gap-2 rounded-xl bg-white p-2 shadow-sm">
            <span className="h-6 w-6 shrink-0 rounded-full" style={{ background: b.color }} />
            <span className="flex-1 truncate text-sm font-medium">{b.name}</span>
            <div className="flex items-center gap-1.5">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-ink/5 text-base">−</span>
              <span className="w-9 text-center text-sm font-semibold tabular-nums">{b.pct}%</span>
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-ink/5 text-base">+</span>
            </div>
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-between rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
        <span>Total</span>
        <span className="font-semibold tabular-nums">100% / 100%</span>
      </div>
      <div className="mt-auto rounded-xl bg-ink py-2.5 text-center text-sm font-medium text-white">
        Save split
      </div>
    </div>
  );
}

function CardScreen() {
  const spending = BUCKETS.find((b) => b.spending)!;
  return (
    <div className="flex h-full flex-col gap-3 p-4">
      <div className="pt-1 text-sm font-semibold">Card</div>
      <div
        className="rounded-2xl p-4 text-white shadow-lg"
        style={{ background: `linear-gradient(135deg, ${spending.color}, #0d0f1a)` }}
      >
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-widest text-white/70">banqdrop card</span>
          <span className="rounded-full bg-emerald-400/30 px-2 py-0.5 text-[9px] text-emerald-100">active</span>
        </div>
        <div className="mt-7 font-mono text-sm tracking-widest">•••• •••• •••• 9099</div>
        <div className="mt-3 flex items-end justify-between">
          <div>
            <div className="text-[9px] uppercase text-white/60">Spends from</div>
            <div className="text-sm font-semibold">{spending.name}</div>
          </div>
          <div className="text-right">
            <div className="text-[9px] uppercase text-white/60">Available</div>
            <div className="text-sm font-semibold tabular-nums">{usd(spending.usd)}</div>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between rounded-xl bg-white p-2.5 text-[11px] shadow-sm">
        <span className="text-ink/60">visa · USDC · mock</span>
        <span className="rounded-lg bg-ink/10 px-2.5 py-1 font-medium">Freeze</span>
      </div>
      <div className="text-[11px] font-semibold text-ink/60">Activity</div>
      <div className="flex items-center justify-between rounded-xl bg-white p-2.5 shadow-sm">
        <div>
          <div className="text-xs font-medium">Deposit · split across buckets</div>
          <div className="text-[10px] text-ink/45">just now · mock</div>
        </div>
        <div className="text-sm font-semibold text-emerald-600">+{usd(1000)}</div>
      </div>
    </div>
  );
}

/* ---------- Install CTA ---------- */

function InstallButton({ large = false }: { large?: boolean }) {
  const [evt, setEvt] = useState<BIPEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [standalone, setStandalone] = useState(false);
  const [showIosHelp, setShowIosHelp] = useState(false);

  useEffect(() => {
    setStandalone(
      window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true
    );
    setIos(/iphone|ipad|ipod/i.test(window.navigator.userAgent));
    const onBIP = (e: Event) => {
      e.preventDefault();
      setEvt(e as BIPEvent);
    };
    window.addEventListener("beforeinstallprompt", onBIP);
    return () => window.removeEventListener("beforeinstallprompt", onBIP);
  }, []);

  const cls = `rounded-xl font-medium ${large ? "px-6 py-3 text-base" : "px-5 py-3"} bg-emerald-600 text-white hover:bg-emerald-700`;

  if (standalone) return <Link href="/app" className={cls}>Open banqdrop</Link>;
  if (evt)
    return (
      <button
        onClick={async () => {
          await evt.prompt();
          await evt.userChoice;
          setEvt(null);
        }}
        className={cls}
      >
        Install app
      </button>
    );
  if (ios)
    return (
      <div className="space-y-2">
        <button onClick={() => setShowIosHelp((v) => !v)} className={cls}>
          Add to Home Screen
        </button>
        {showIosHelp && (
          <p className="text-sm text-ink/60">
            Tap the Share icon <span className="font-semibold">⎙</span>, then{" "}
            <span className="font-semibold">“Add to Home Screen.”</span>
          </p>
        )}
      </div>
    );
  return <Link href="/app" className={cls}>Launch web app</Link>;
}
