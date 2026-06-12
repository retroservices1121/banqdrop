import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/user";
import { depositDTO } from "@/lib/serialize";

export const dynamic = "force-dynamic";

// GET /api/transactions — bucket-tagged activity feed. v1 surfaces inbound deposits
// (each one split-on-arrival). Card spends attach here once a precise card webhook
// exists; until then outflows show via reconciliation against the spending bucket.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "not authenticated" }, { status: 401 });
  const deposits = await prisma.deposit.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return NextResponse.json({ deposits: deposits.map(depositDTO) });
}
