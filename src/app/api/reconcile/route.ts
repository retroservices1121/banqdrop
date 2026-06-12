import { NextResponse } from "next/server";
import { getCurrentUser, loadMe } from "@/lib/user";
import { reconcileUser, verifyInvariant } from "@/ledger/reconcile";

// POST /api/reconcile — run reconciliation for the current user (v1: drift -> spending
// bucket) and report whether the invariant sum(bucket)==balance now holds.
export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "not authenticated" }, { status: 401 });
  const report = await reconcileUser(user.id);
  const invariant = await verifyInvariant(user.id);
  const fresh = await getCurrentUser();
  return NextResponse.json({ report, invariant, me: await loadMe(fresh!) });
}
