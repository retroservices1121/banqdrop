// Card-issuer swap point. One env line picks the implementation — never a refactor.
//   CARD_ISSUER=mock       -> mock issuer (default; build + test with no vendor)
//   CARD_ISSUER=gnosispay  -> Gnosis Pay (Safe on Gnosis Chain, USDCe; SIWE->JWT)
//
// The Gnosis Pay impl is intentionally NOT wired yet: it forces the settlement-chain
// decision (the card spends from a Gnosis-Chain Safe, not Polygon/Base) and the target
// market must support Gnosis Pay (not US, as of 2026-06). See the card contract notes.

import type { CardIssuer } from "./types";
import { mockIssuer } from "./mock/issuer";

function selectIssuer(): CardIssuer {
  const choice = (process.env.CARD_ISSUER ?? "mock").toLowerCase();
  switch (choice) {
    case "mock":
      return mockIssuer;
    case "gnosispay":
      throw new Error(
        "CARD_ISSUER=gnosispay but the Gnosis Pay issuer is not wired yet (pending chain + market decision)."
      );
    default:
      throw new Error(`Unknown CARD_ISSUER: ${choice}`);
  }
}

export const cardIssuer: CardIssuer = selectIssuer();
