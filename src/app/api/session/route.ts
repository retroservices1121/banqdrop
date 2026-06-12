import { NextResponse } from "next/server";
import { z } from "zod";
import { ensureUser, setSession, clearSession, loadMe } from "@/lib/user";

const Body = z.object({ email: z.string().email() });

// POST /api/session — dev login: create-or-fetch user, seed buckets, set cookie.
export async function POST(req: Request) {
  let parsed;
  try {
    parsed = Body.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "valid email required" }, { status: 400 });
  }
  const user = await ensureUser(parsed.email);
  await setSession(user.id);
  return NextResponse.json(await loadMe(user));
}

// DELETE /api/session — log out.
export async function DELETE() {
  await clearSession();
  return NextResponse.json({ ok: true });
}
