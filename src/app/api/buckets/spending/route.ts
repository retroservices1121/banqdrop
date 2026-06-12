import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser, loadMe } from "@/lib/user";
import { setSpendingBucket } from "@/ledger/buckets";

const Body = z.object({ bucketId: z.string() });

// POST /api/buckets/spending — move the spending ROLE (card default). Never touches names.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "not authenticated" }, { status: 401 });
  let parsed;
  try {
    parsed = Body.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "invalid input" }, { status: 400 });
  }
  if (!user.buckets.some((b) => b.id === parsed.bucketId)) {
    return NextResponse.json({ error: "no such bucket" }, { status: 404 });
  }
  await setSpendingBucket(user.id, parsed.bucketId);
  const fresh = await getCurrentUser();
  return NextResponse.json(await loadMe(fresh!));
}
