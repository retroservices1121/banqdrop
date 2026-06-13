// Card-issuer swap point. One env line picks the implementation — never a refactor.
//   CARD_ISSUER=mock       -> mock issuer (default; build + test with no vendor)
//   CARD_ISSUER=gnosispay  -> Gnosis Pay (Safe on Gnosis Chain, USDCe; SIWE->JWT)
//
// DECISION (2026-06-12, see CARD.md): real card uses the BRIDGE model — main balance
// stays on Polygon/Base; the isSpending bucket's funds bridge into a Gnosis Pay Safe
// that the card spends from. Mock stays in place until the target market is confirmed
// (Gnosis Pay is not available to US cardholders yet). The card's own network/currency
// already live on IssuedCard, so the card settles on Gnosis while the main wallet does
// not — no schema change needed when the gnosispay impl lands.

import type { CardIssuer } from "./types";
import { mockIssuer } from "./mock/issuer";
import { bridgeIssuer } from "./bridge/issuer";

function selectIssuer(): CardIssuer {
  const choice = (process.env.CARD_ISSUER ?? "mock").toLowerCase();
  switch (choice) {
    case "mock":
      return mockIssuer;
    case "bridge":
      // Stripe Issuing + Bridge (US-capable, JIT from USDC). Scaffolded; activates once
      // STRIPE_SECRET_KEY is set after onboarding. Bucket enforcement is in the
      // /api/webhooks/card-auth real-time authorization route.
      return bridgeIssuer;
    case "gnosispay":
      throw new Error(
        "CARD_ISSUER=gnosispay but the Gnosis Pay issuer is not wired yet (ex-US; pending chain + market decision)."
      );
    default:
      throw new Error(`Unknown CARD_ISSUER: ${choice}`);
  }
}

export const cardIssuer: CardIssuer = selectIssuer();
