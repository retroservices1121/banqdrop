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

## Decisions made

1. **Real card uses the BRIDGE model, not a chain pivot.** Main balance + buckets stay on the
   chosen settlement chain (Polygon via OMS, or Base via the fallback). When a card is funded,
   the **`isSpending` bucket's funds bridge into a Gnosis Pay Safe** that the card spends from.
   - Implication for the invariant: with a card live there are two on-chain balances (main
     chain + Gnosis Safe). The invariant generalizes to
     `sum(bucket.amount) == main-chain balance + Gnosis-Safe balance`, and reconciliation must
     account for in-flight bridge transfers. Build this only when wiring the real issuer.
2. **Stay on `CARD_ISSUER=mock` until the target market is confirmed.** Market is currently
   "global / undecided"; Gnosis Pay can't issue to US cardholders yet, so don't commit real
   issuance to a market that may be US-heavy.
3. **Exact card-spend attribution waits for Gnosis Pay Partnership webhooks.** Until then,
   outflows reconcile against the `isSpending` bucket (the existing v1 reconciliation rule).

## When we go real (checklist, do NOT build yet)

- [ ] Confirm cardholder market is Gnosis-Pay-supported (EU/UK/LATAM).
- [ ] Implement `gnosispay` `CardIssuer` (SIWE→JWT auth, Safe creation, virtual-card issue,
      freeze). Reports `network: "gnosis"`, `currency: "USDCe"` (or `EURe`).
- [ ] Bridge step: move `isSpending` bucket funds main-chain → Gnosis Safe; reconcile both
      balances + in-flight transfers into the invariant.
- [ ] Upgrade to Partnership tier for card webhooks → exact per-spend bucket attribution +
      sensitive card-detail display.
