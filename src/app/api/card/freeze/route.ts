import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/user";
import { cardIssuer } from "@/card/factory";
import { cardDTO } from "../route";

const Body = z.object({ frozen: z.boolean() });

// POST /api/card/freeze — freeze / unfreeze at the provider, mirror status locally.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "not authenticated" }, { status: 401 });

  let parsed;
  try {
    parsed = Body.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "frozen (boolean) required" }, { status: 400 });
  }
  const card = await prisma.card.findUnique({ where: { userId: user.id } });
  if (!card) return NextResponse.json({ error: "no card" }, { status: 404 });

  const status = await cardIssuer.setFrozen(card.providerCardId, parsed.frozen);
  const updated = await prisma.card.update({ where: { userId: user.id }, data: { status } });
  return NextResponse.json({ card: cardDTO(updated) });
}
