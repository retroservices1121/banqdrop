import { NextResponse } from "next/server";
import { getCurrentUser, loadMe } from "@/lib/user";

export const dynamic = "force-dynamic";

// GET /api/me — current user snapshot with live balance.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "not authenticated" }, { status: 401 });
  return NextResponse.json(await loadMe(user));
}
