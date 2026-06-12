# CLAUDE.md — banqdrop

Guidance for Claude Code. Read this fully before writing code. Decisions below were made
deliberately over a long design process — **do not re-derive or "improve" them without asking.**

This spec has two halves:
- **RAILS** (swappable): wallet, funding, KYC, settlement. Primary = **Polygon Open Money Stack (OMS)**.
  Fallback = the self-wired Base stack in `CLAUDE-base-stack.md` (Privy + Alchemy + MoonPay + Bridge).
- **PRODUCT** (the moat — never changes with rails): the bucket ledger. This is banqdrop. OMS does NOT
  build this; you do.

---

## What this is

An **envelope-native stablecoin account** (Simple/Qapital lineage, on crypto rails the user never sees).
Money that lands auto-splits into named **buckets** by percentages the user sets. A card spends from a
chosen bucket. Shipped as a **PWA** (not native — intentionally avoids Apple's crypto review).

Mental model: *a real USDC balance, with an off-chain ledger that divides it into envelopes.*

---

## Non-negotiable architecture decisions

1. **Buckets are a virtual ledger, NOT on-chain wallets.** ONE wallet, ONE real USDC balance. Buckets are
   Postgres rows (name, color, pct, amount). Never create per-bucket wallets.
2. **The DB is accounting only. It never holds keys, never moves funds.** OMS (or the fallback) custodies
   the wallet; our server only labels how the balance splits.
3. **Core invariant:** `sum(bucket.amount) == on-chain USDC balance`. Every path that changes a bucket
   amount preserves it. Reconcile on every deposit and on a periodic job.
4. **Non-custodial WITH assisted recovery.** Never claim "only you can ever access your keys."
5. **PWA, not native.** No App Store, no Capacitor.
6. **Rails sit behind interfaces.** Wallet, funding, and deposit-detection are contracts (below). OMS is
   the primary implementation; the Base stack is the fallback. The product never imports a vendor directly.

---

## RAILS: Polygon Open Money Stack (primary)

OMS is one API for **non-custodial wallets (any chain), fiat on/off-ramp (ACH + in-person cash-in),
KYC, and settlement.** It is meant to replace Privy + Alchemy + MoonPay + Bridge with a single integration.
Install path is an agent skill: `npx skills add docs.polygon.technology`, then scope with the OMS flow
(custody model, funding methods, jurisdiction/KYC, brand).

**VERIFY THESE GATES before committing to OMS. If any fails, switch to `CLAUDE-base-stack.md`:**
- [ ] Non-custodial OMS wallets support our auth model (email-create + passkey re-auth, assisted recovery).
- [ ] OMS exposes a **per-user deposit/transfer event** (webhook) we can hang split-on-arrival on.
      If not, we still need an on-chain webhook (Alchemy) on the wallet's chain — see Deposit detection.
- [ ] Solo-builder access is real (not enterprise-gated to the point we can't ship).
- [ ] Chain choice: OMS supports "any chain" — default to the cheapest viable for USDC settlement.
      Record the chosen chain + USDC contract once decided; the product is chain-agnostic.

**Rails contract (the product only ever talks to this):**
```ts
interface Wallet { address: string; chain: string; getUsdcBalance(): Promise<number>; }
interface RailsProvider {
  ensureWallet(user: User): Promise<Wallet>;          // OMS: non-custodial wallet; provision on signup
  getKycStatus(user: User): Promise<'none'|'pending'|'approved'|'rejected'>;
  funding: FundingSource;                              // see Funding
  // deposit events: prefer provider webhooks; else fall back to chain webhook (Alchemy)
}
```
OMS implements `RailsProvider`. The Base stack implements the SAME interface (Privy=ensureWallet,
MoonPay/Bridge=funding, Alchemy=deposit events). Swapping is a factory line, not a refactor.

---

## The spine: split-on-arrival

The heart of the product. It is **rails-agnostic** — it reacts to "USDC arrived for user X," however detected.

1. Deposit detected via the rails event source:
   - **Preferred:** OMS transaction/deposit webhook (verify signature).
   - **Fallback:** Alchemy Address Activity webhook on the wallet's chain, watching a *dynamic* address set
     (register each new wallet at signup — one webhook, many addresses; a static single-address webhook
     silently catches nothing for real users). Filter to inbound USDC only; dedupe by txHash+logIndex.
2. Resolve the user. Allocate the deposit across their buckets by `pct`, **largest-remainder rounding to
   cents** so the split sums EXACTLY (no penny drift).
3. Increment each `bucket.amount` + write a `Deposit` row in one DB transaction. Fire push:
   "$X landed, split across N buckets."

**Outflow reconciliation:** a card spend / send lowers the real balance but the chain doesn't say which
bucket. v1 rule: attribute outflows to the `isSpending` bucket. A periodic job compares
`sum(bucket.amount)` to the live balance and corrects drift against the spending bucket. (When a precise
card webhook exists, attribute exactly.)

---

## PRODUCT: the bucket ledger (the moat — unchanged regardless of rails)

```prisma
model User {
  id            String   @id            // auth/rails user id
  walletAddress String   @unique
  buckets       Bucket[]
  deposits      Deposit[]
  createdAt     DateTime @default(now())
}
model Bucket {
  id         String  @id @default(cuid())
  userId     String
  user       User    @relation(fields:[userId], references:[id])
  name       String                       // user-editable label
  color      String
  pct        Int                          // share of inbound; per-user buckets must sum to 100
  amount     Decimal @default(0)          // envelope balance (cents precision)
  isSpending Boolean @default(false)      // ROLE flag: "ready to spend" + card default. Decoupled from name.
  sortOrder  Int
}
model Deposit {
  id        String   @id @default(cuid())
  userId    String
  txHash    String   @unique              // dedupe key
  amountUsd Decimal
  source    String                        // "oms" | "onchain" | "moonpay" | "bridge"
  createdAt DateTime @default(now())
}
```
Rules:
- Exactly one bucket per user has `isSpending = true`. Renaming NEVER changes which bucket is the spending
  bucket (role ≠ label). Hero "ready to spend" and card default both follow `isSpending`.
- `pct` per user sums to 100; block allocation otherwise.
- Bucket names are free-text, off-chain metadata — rename is instant and free.

---

## Funding (FundingSource — OMS primary)

"Add money" is a swappable front-end. The interface owns INITIATION + KYC only. It NEVER credits buckets —
crediting happens once, from the deposit event (deduped by txHash). Provider status webhooks are UX-ONLY;
crediting off both = double-counting.

```ts
type FundingInit =
  | { kind: 'widget';  url: string }                                   // hosted ramp UI
  | { kind: 'account'; accountNumber: string; routingNumber: string }  // direct-deposit anchor
  | { kind: 'cash';    code: string; locationId: string };             // OMS in-person cash-in
interface FundingSource {
  id: 'oms' | 'moonpay' | 'bridge';
  supportsDirectDeposit: boolean;
  initiateFunding(user: User, amountUsd?: number): Promise<FundingInit>;
  getKycStatus(user: User): Promise<'none'|'pending'|'approved'|'rejected'>;
}
```
- **OMS (primary):** ACH on-ramp, direct-deposit-style accounts, AND `/cash-ins` (retail cash funding —
  reaches users with no debit card; no other provider here does this). KYC handled in-stack.
- **MoonPay / Bridge (fallback):** implement the same interface if OMS is rejected at a gate.
- Whatever the path, USDC lands on the wallet → the deposit event credits buckets. Nothing else does.

---

## Decisions already made — do NOT re-derive these wrong

- Buckets = off-chain ledger over one real balance (not multiple wallets).
- `isSpending` is a role flag, separate from the name; rename is free off-chain metadata.
- `pct` per user sums to 100; gate deposits on this.
- Crediting happens ONCE, from the deposit event, deduped by txHash. Provider status webhooks are UX-only.
- Non-custodial WITH assisted recovery — keep the copy honest.
- iOS cannot trigger "add to home screen" programmatically — show manual Share-sheet instructions,
  detect `display-mode: standalone`. Don't fake an install button.
- Do NOT assume OMS does something — verify against the gates above before building on it.

## Out of scope for v1 (do not build unless asked)

- DeFi / yield ("grow" buckets) — regulatory (GENIUS Act). Later, off the iOS surface.
- Gnosis card issuance — later (OMS may cover the card; verify).
- Native app shell.

---

## Build order (work in phases; commit per phase)

1. **OMS scope + access** — run the OMS skill, verify the gates above. If any gate fails, STOP and switch
   to `CLAUDE-base-stack.md`. Record chosen chain + USDC contract.
2. **Rails behind the contract** — implement `RailsProvider` over OMS: wallet provisioning on signup,
   KYC status, funding. Show wallet address + live USDC balance.
3. **Postgres + Prisma** — schema above; on first login upsert User + seed default buckets. If using the
   Alchemy fallback for events, register the new wallet to the webhook here.
4. **Buckets UI + rules** — buckets home (live balance), split editor (pct steppers, sum=100 gate), inline
   rename, `isSpending` star. (Port the design from the prototype.)
5. **Split-on-arrival** — deposit event (OMS webhook, else Alchemy) + allocation + reconciliation. The
   milestone that makes buckets real. Test end-to-end with a real deposit.
6. **Funding UI** — "Add money" via OMS (`FundingSource`): on-ramp + cash-in. Lets a non-crypto person fund.
7. **Card view + transactions** — bucket-tagged history; card draws from `isSpending` bucket.
8. **PWA** — manifest, service worker, add-to-home-screen onboarding + notification permission.

After each phase, verify the core invariant holds before moving on.

---

## Env

```
DATABASE_URL=                 # Railway Postgres
OMS_API_TOKEN=                # Open Money Stack API
OMS_WEBHOOK_SECRET=           # verify OMS deposit/status webhooks
APP_CHAIN=                    # chosen settlement chain (recorded at phase 1)
USDC_CONTRACT=                # USDC address on APP_CHAIN
# fallback rails (only if OMS rejected — see CLAUDE-base-stack.md):
# NEXT_PUBLIC_PRIVY_APP_ID= / PRIVY_APP_SECRET= / ALCHEMY_* / MOONPAY_* / BRIDGE_API_KEY=
```

Railway: single web service + Postgres plugin, deploy from GitHub (auto-deploy on main).
Commands: `npm run dev`, `npm run build`, `npx prisma migrate deploy` (on release).
