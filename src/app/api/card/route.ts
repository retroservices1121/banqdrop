import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/user";
import { cardDTO } from "@/lib/serialize";

export const dynamic = "force-dynamic";

// GET /api/card — the user's card (or null). Card draws from the isSpending bucket.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "not authenticated" }, { status: 401 });
  const card = await prisma.card.findUnique({ where: { userId: user.id } });
  return NextResponse.json({ card: card ? cardDTO(card) : null });
}
