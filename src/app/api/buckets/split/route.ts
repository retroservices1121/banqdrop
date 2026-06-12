import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser, loadMe } from "@/lib/user";
import { updateSplit } from "@/ledger/buckets";

const Body = z.object({ pcts: z.record(z.string(), z.number().int().min(0).max(100)) });

// POST /api/buckets/split — set the inbound split. Gate: new pct set sums to 100.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "not authenticated" }, { status: 401 });
  let parsed;
  try {
    parsed = Body.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "invalid pcts" }, { status: 400 });
  }
  try {
    await updateSplit(user.id, parsed.pcts);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 422 });
  }
  const fresh = await getCurrentUser();
  return NextResponse.json(await loadMe(fresh!));
}
