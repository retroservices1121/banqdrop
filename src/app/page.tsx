// Buckets home — wired to live data in Phase 4. Placeholder for now so the tree
// builds; the rails contract + ledger core are already in place underneath.
export const dynamic = "force-dynamic";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
      <h1 className="text-2xl font-semibold">banqdrop</h1>
      <p className="text-sm text-ink/60">
        An envelope-native stablecoin account. Money that lands splits itself into buckets.
      </p>
      <p className="mt-4 rounded-full bg-ink/5 px-3 py-1 text-xs text-ink/50">
        rails: mock · chain: polygon · invariant: enforced
      </p>
    </main>
  );
}
