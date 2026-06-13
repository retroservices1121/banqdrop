// Stripe Issuing + Bridge CardIssuer — the US-capable path. The card links the user's
// NON-CUSTODIAL USDC wallet and spends JIT at authorization (Bridge pulls funds via a
// prior on-chain approval). This fits banqdrop natively: the card draws from the same
// one balance the bucket ledger sits over — no separate Safe/bridge like Gnosis Pay.
//
// SCAFFOLD: request shapes follow Stripe's Bridge stablecoin-card docs but are not yet
// verified against a live account (onboarding is ~6–8 weeks; see CARD.md). It activates
// when STRIPE_SECRET_KEY is set. The spending-bucket enforcement lives in the real-time
// authorization webhook (src/app/api/webhooks/card-auth), not here.

import type { CardIssuer, CardStatus, IssuedCard } from "../types";
import type { RailsUser } from "@/rails/types";

const NETWORK = process.env.CARD_NETWORK ?? "base"; // chain Bridge pulls USDC from
const CURRENCY = "USDC";
const STRIPE = "https://api.stripe.com/v1";

function secretKey(): string {
  const k = process.env.STRIPE_SECRET_KEY;
  if (!k) {
    throw new Error(
      "CARD_ISSUER=bridge needs STRIPE_SECRET_KEY (Stripe Issuing + Bridge onboarding — see CARD.md)"
    );
  }
  return k;
}

async function stripe(path: string, form: Record<string, string>) {
  const res = await fetch(`${STRIPE}${path}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${secretKey()}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(form).toString(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`stripe ${path}: ${data?.error?.message ?? res.status}`);
  return data;
}

export const bridgeIssuer: CardIssuer = {
  id: "bridge",
  network: NETWORK,
  currency: CURRENCY,

  async issueVirtualCard(user: RailsUser): Promise<IssuedCard> {
    // 1) Cardholder (US KYC). Production sends full legal name, billing address, email,
    //    phone, DOB and accepted Terms — Stripe/Bridge run KYC. Persist cardholder id
    //    on the User when wiring for real.
    const cardholder = await stripe("/issuing/cardholders", {
      type: "individual",
      name: user.email ?? user.id,
      email: user.email ?? "",
      "billing[address][country]": "US",
      // billing[address][line1/city/state/postal_code], individual[first_name]/[last_name]…
    });

    // 2) Virtual card linked to the user's NON-CUSTODIAL wallet; spends JIT from USDC.
    const card = await stripe("/issuing/cards", {
      type: "virtual",
      currency: "usd",
      status: "active",
      cardholder: cardholder.id,
      "crypto_wallet[type]": "standard", // non-custodial (user's wallet)
      "crypto_wallet[chain]": NETWORK,
      "crypto_wallet[currency]": "usdc",
      "crypto_wallet[address]": user.walletAddress ?? "",
    });

    return {
      providerCardId: card.id,
      last4: card.last4,
      brand: card.brand ?? "visa",
      network: NETWORK,
      currency: CURRENCY,
      status: "active",
    };
  },

  async setFrozen(providerCardId: string, frozen: boolean): Promise<CardStatus> {
    await stripe(`/issuing/cards/${providerCardId}`, { status: frozen ? "inactive" : "active" });
    return frozen ? "frozen" : "active";
  },
};
