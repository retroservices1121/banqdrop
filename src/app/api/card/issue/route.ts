import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/user";
import { cardIssuer } from "@/card/factory";
import { cardDTO } from "../route";

// POST /api/card/issue — provision a card via the CardIssuer contract (idempotent:
// one card per user). The card draws from the user's isSpending bucket.
export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "not authenticated" }, { status: 401 });

  const existing = await prisma.card.findUnique({ where: { userId: user.id } });
  if (existing) return NextResponse.json({ card: cardDTO(existing) });

  const issued = await cardIssuer.issueVirtualCard(user);
  const card = await prisma.card.create({
    data: {
      userId: user.id,
      provider: cardIssuer.id,
      providerCardId: issued.providerCardId,
      last4: issued.last4,
      brand: issued.brand,
      network: issued.network,
      currency: issued.currency,
      status: issued.status,
    },
  });
  return NextResponse.json({ card: cardDTO(card) });
}
