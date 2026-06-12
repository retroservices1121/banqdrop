// The card-issuance contract. Like the rails contract, the PRODUCT only ever talks
// to this — never a card vendor directly. The mock issuer implements it now; Gnosis
// Pay (permissionless SIWE->JWT, card Safe on Gnosis Chain in USDCe) implements the
// SAME interface later. Swapping is a factory line (CARD_ISSUER env), not a refactor.
//
// The card always draws from the user's isSpending bucket (role, not name). Exact
// per-spend attribution needs provider webhooks (Gnosis Pay: Partnership tier); until
// then outflows reconcile against the spending bucket, same as today.

import type { RailsUser } from "@/rails/types";

export type CardStatus = "issued" | "active" | "frozen" | "cancelled";

export interface IssuedCard {
  providerCardId: string;
  last4: string;
  brand: string; // "visa"
  network: string; // settlement network (e.g. "gnosis")
  currency: string; // spendable token (e.g. "USDCe")
  status: CardStatus;
}

export interface IssueOptions {
  type?: "virtual" | "physical";
}

export interface CardIssuer {
  id: "mock" | "gnosispay";
  /** Network the card settles on + the token it spends. Surfaced for UI/wallet logic. */
  network: string;
  currency: string;
  /** Provision a card for the user at the provider. Idempotency/persistence is the
   *  caller's job (one Card row per user). */
  issueVirtualCard(user: RailsUser, opts?: IssueOptions): Promise<IssuedCard>;
  /** Freeze / unfreeze at the provider. */
  setFrozen(providerCardId: string, frozen: boolean): Promise<CardStatus>;
}
