# CARD.md — banqdrop card issuance (decision record)

Guidance for Claude Code. Decisions below were made deliberately — **do not re-derive
or "improve" them without asking.** Companion to `CLAUDE.md` (rails) and the bucket
ledger (the moat).

## What's built (mock, shipped)

Card issuance sits behind a **vendor-agnostic `CardIssuer` contract** (`src/card/types.ts`)
— the product never imports a card vendor directly, same discipline as the rails contract.

- `mock` issuer (`src/card/mock/issuer.ts`) — issue / show / freeze, no vendor. Reports the
  current settlement chain (Polygon/USDC).
- Factory selects by `CARD_ISSUER` env (`mock` | `gnosispay`). Gnosis Pay is a deliberate
  stub until the decisions below resolve.
- `Card` Prisma model (one per user) stores `provider`, `providerCardId`, `last4`,
  `network`, `currency`, `status`. Migration `1_add_card` applied.
- Routes: `GET /api/card`, `POST /api/card/issue` (idempotent), `POST /api/card/freeze`.
- The card draws from the user's **`isSpending` bucket** (role, not name) — unchanged rule.

## Gnosis Pay gate-check (2026-06-12)

- ✅ **Permissionless dev access** — SIWE → JWT, no waitlist. Issue/manage cards, KYC, balance
  queries immediately. (Webhooks for exact per-spend attribution + showing sensitive card
  details + scaled branded programs need the **Partnership** tier.)
- ✅ **Custody fits** — self-custodial Safe with Delay + Roles modules = "non-custodial with
  assisted recovery."
- ⚠️ **Chain/token** — card spends from a **Safe on Gnosis Chain** in **USDCe/EURe/GBPe**, NOT
  native USDC on Polygon/Base.
- ❌ **US not supported** (as of 2026-06): EU/EEA (32), UK, Argentina, Brazil only. US "planned."

## US cards — Stripe Issuing + Bridge (the path for US cardholders)

Gnosis Pay can't issue to US cardholders (as of 2026-06). For the US the path is **Stripe Issuing
+ Bridge** (Bridge = Stripe's stablecoin arm; OCC conditional national-bank-charter approval Feb 2026):

- **US cardholders supported** — Stripe's Bridge stablecoin-card docs show US-state cardholders + a
  `customer_region_supports_cards` KYC gate.
- **Non-custodial, JIT from USDC** — link the user's own wallet (`crypto_wallet[type]=standard`); at
  authorization Bridge pulls USDC just-in-time via a prior on-chain approval. The card draws from the
  SAME one balance the bucket ledger sits over — **no separate Safe/bridge** like Gnosis.
- **Exact bucket attribution, built in** — Stripe Issuing's real-time authorization webhook lets us
  approve/decline against the `isSpending` bucket and attribute each spend precisely.
- **Access** — Stripe Issuing account + Bridge developer account + ~6–8 week onboarding (KYB/compliance).
  Not permissionless, but no hard waitlist wall.
- **Parallel alternatives** (same `CardIssuer` contract): **Rain** (NYC; USDC settlement; non-custodial;
  Mastercard Principal Member) and **Baanx** (US-owned; powers MetaMask Card US). The custodial
  program-manager route (Lithic/Marqeta + sponsor bank + off-ramp) is the heavy fallback that breaks
  the non-custodial spend story.

## Decisions made

1. **US = Stripe Issuing + Bridge (`CARD_ISSUER=bridge`); ex-US = Gnosis Pay (`gnosispay`).** Both are
   implementations of the same `CardIssuer` contract; pick per cardholder market.
2. **US architecture is JIT-from-wallet — NOT a chain pivot or a Gnosis cross-chain Safe.** The card
   spends JIT from the user's USDC on the settlement chain (`CARD_NETWORK`, default `base`). A spend
   lowers the one real balance → attribute to `isSpending`. Invariant stays
   `sum(bucket.amount) == on-chain USDC balance` (no second balance).
   - The Gnosis cross-chain Safe model (two balances, bridge transfers) ONLY applies if we choose
     `gnosispay` for an ex-US market.
3. **Bucket enforcement is at the network edge** — the real-time authorization webhook
   (`/api/webhooks/card-auth`) approves only if the auth fits the spending bucket and decrements that
   bucket on capture. This replaces reconciliation-only attribution for card spends.
4. **Stay on `CARD_ISSUER=mock`** until a provider is onboarded. The `bridge` issuer + auth webhook are
   **scaffolded** (activate when `STRIPE_SECRET_KEY` is set); request shapes follow Stripe's Bridge docs
   but are unverified against a live account.

## When we go real (checklist)

- [ ] Apply: **Stripe Issuing + Bridge** (primary, US) and **Rain** (parallel). Onboard as Spredd Markets (KYB).
- [ ] Confirm US cardholder eligibility + the supported `CARD_NETWORK` chain for USDC JIT.
- [ ] Fill `STRIPE_SECRET_KEY`, `STRIPE_ISSUING_WEBHOOK_SECRET`, `BRIDGE_API_KEY`; finish the `bridge`
      issuer (full cardholder KYC fields) and verify the real-time-authorization response contract.
- [ ] Add a `CardSpend` record to dedupe captures (exact-once) + surface card spends in Activity.
- [ ] (ex-US only) implement the `gnosispay` issuer + the Gnosis cross-chain Safe model.
