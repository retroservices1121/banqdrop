// Mock CardIssuer — lets us build + test the card flow (issue, show, freeze) with no
// vendor. Implements the exact contract Gnosis Pay will. Reports the CURRENT settlement
// chain (mock rails = Polygon/USDC); the Gnosis Pay impl will report gnosis/USDCe.

import { createHash } from "node:crypto";
import type { CardIssuer, CardStatus, IssuedCard } from "../types";
import type { RailsUser } from "@/rails/types";

const NETWORK = process.env.APP_CHAIN ?? "polygon";
const CURRENCY = "USDC";

export const mockIssuer: CardIssuer = {
  id: "mock",
  network: NETWORK,
  currency: CURRENCY,

  async issueVirtualCard(user: RailsUser): Promise<IssuedCard> {
    const h = createHash("sha256").update(`card:${user.id}`).digest("hex");
    const last4 = (parseInt(h.slice(0, 8), 16) % 10000).toString().padStart(4, "0");
    return {
      providerCardId: `mockcard_${h.slice(0, 16)}`,
      last4,
      brand: "visa",
      network: NETWORK,
      currency: CURRENCY,
      status: "active",
    };
  },

  async setFrozen(_providerCardId: string, frozen: boolean): Promise<CardStatus> {
    return frozen ? "frozen" : "active";
  },
};
