import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/user";

export const dynamic = "force-dynamic";

// GET /api/card — the user's card (or null). Card draws from the isSpending bucket.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "not authenticated" }, { status: 401 });
  const card = await prisma.card.findUnique({ where: { userId: user.id } });
  return NextResponse.json({ card: card ? cardDTO(card) : null });
}

export function cardDTO(c: {
  last4: string;
  brand: string;
  network: string;
  currency: string;
  status: string;
  provider: string;
}) {
  return {
    last4: c.last4,
    brand: c.brand,
    network: c.network,
    currency: c.currency,
    status: c.status,
    provider: c.provider,
  };
}
