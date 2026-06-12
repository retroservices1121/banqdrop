# CLAUDE-base-stack.md — banqdrop (FALLBACK rails)

> **This is the FALLBACK implementation.** Primary is `CLAUDE.md` (Polygon Open Money Stack).
> Use this self-wired Base stack (Privy + Alchemy + MoonPay + Bridge) ONLY if OMS fails a
> verification gate in `CLAUDE.md` — e.g. it can't give non-custodial wallets with a per-user
> deposit event, or solo access isn't available. The PRODUCT half (buckets, split-on-arrival,
> invariant, role flag, rename) is identical in both files — only the rails differ.

Guidance for Claude Code. Read this fully before writing code. The decisions below were made
deliberately over a long design process — **do not re-derive or "improve" them without asking.**

---

## What this is

An **envelope-native stablecoin account** (Simple/Qapital lineage, on crypto rails the user never sees).
Money that lands auto-splits into named **buckets** (Rent / Spend / Stack / …) by percentages the user
sets. A card spends from a chosen bucket. Shipped as a **PWA** (not a native app).

One-line mental model: *a real USDC wallet on Base, with an off-chain ledger that divides its balance
into envelopes.*

---

## Non-negotiable architecture decisions

1. **Buckets are a virtual ledger, NOT on-chain wallets.** The user has ONE embedded wallet with ONE
   real USDC balance on Base. Buckets are rows in Postgres (name, color, pct, amount). Never create
   four wallets/sub-accounts in v1.
2. **The DB is accounting only. It never holds keys and never moves funds.** Privy custodies the wallet
   (non-custodial, user-controlled). Our server only tracks how the real balance is *labeled* across buckets.
3. **Core invariant:** `sum(bucket.amount) === on-chain USDC balance`. Every code path that changes a
   bucket amount must preserve this. Reconcile on every deposit and on a periodic job.
4. **The product is non-custodial WITH assisted recovery.** Never write marketing/UI copy claiming
   "only you can ever access your keys." Recovery is Privy-assisted (automatic mode).
5. **PWA, not native.** No App Store. This intentionally avoids Apple's crypto review. Don't add Capacitor
   or a native shell.

---

## Stack

- **Next.js (App Router), TypeScript.** (The existing `/app` + `/lib` are a JS sketch — convert to TS as you build.)
- **Privy** (`@privy-io/react-auth`) for auth + embedded wallets. Email creates accounts; passkeys are
  added post-login for fast re-auth (Privy CANNOT create accounts via passkey).
- **viem** for on-chain reads. Chain: **Base mainnet**. Asset: native USDC `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` (6 decimals).
- **Postgres** via **Prisma**.
- **Railway**, deployed from **GitHub** (auto-deploy on push to main). Railway provides `DATABASE_URL`.

## Deploy / env

Single Railway web service + Railway Postgres plugin. Env vars:

```
NEXT_PUBLIC_PRIVY_APP_ID=     # client
PRIVY_APP_SECRET=             # server-side token verification
DATABASE_URL=                 # provided by Railway Postgres
BASE_RPC_URL=                 # your own Alchemy Base RPC (don't ship the public one)
ALCHEMY_WEBHOOK_SIGNING_KEY=  # verify incoming webhook HMAC (X-Alchemy-Signature)
ALCHEMY_NOTIFY_TOKEN=         # auth token for the Notify API (register addresses)
ALCHEMY_WEBHOOK_ID=           # the Address Activity webhook these addresses attach to
NEXT_PUBLIC_MOONPAY_PUBLISHABLE_KEY=   # client widget key (v1 on-ramp)
MOONPAY_SECRET_KEY=           # server-side: sign widget URLs (required) + API
MOONPAY_WEBHOOK_SECRET=       # verify MoonPay's transaction-status webhook (UX only — see Funding)
# later phases:
BRIDGE_API_KEY=               # swap-in funding source (virtual accounts / direct deposit)
GNOSIS_API_KEY=
```

Commands: `npm run dev`, `npm run build`, `npx prisma migrate dev`, `npx prisma migrate deploy` (run on Railway release).

---

## Data model (Prisma sketch — refine as needed, keep the invariant)

```prisma
model User {
  id            String   @id            // Privy DID
  walletAddress String   @unique        // embedded wallet on Base
  buckets       Bucket[]
  deposits      Deposit[]
  createdAt     DateTime @default(now())
}

model Bucket {
  id         String  @id @default(cuid())
  userId     String
  user       User    @relation(fields: [userId], references: [id])
  name       String                       // user-editable label
  color      String
  pct        Int                          // share of inbound; all buckets for a user must sum to 100
  amount     Decimal @default(0)          // current envelope balance (cents precision)
  isSpending Boolean @default(false)      // ROLE flag: drives "ready to spend" + card default. Decoupled from name.
  sortOrder  Int
}

model Deposit {
  id        String   @id @default(cuid())
  userId    String
  txHash    String   @unique              // dedupe key
  amountUsd Decimal
  source    String                        // "onchain" | "bridge"
  createdAt DateTime @default(now())
}
```

Rules:
- Exactly one bucket per user has `isSpending = true`. Renaming a bucket NEVER changes which one is the
  spending bucket (role ≠ label). The hero "ready to spend" and the card default both follow `isSpending`.
- `pct` must sum to 100 before any deposit allocates. Block allocation otherwise.

---

## The spine: split-on-arrival engine

This is the heart of the product. Build it as an **Alchemy Address Activity webhook**, not a poller.

**The critical setup gotcha:** ONE Alchemy webhook watches a *dynamic set of addresses*. There is no
webhook-per-user. On every user signup, after the embedded wallet provisions, **register that wallet
address to the webhook** via Alchemy's Notify address-management API (`ALCHEMY_NOTIFY_TOKEN`,
`ALCHEMY_WEBHOOK_ID`). A static single-address webhook will pass your own test and catch nothing for
real users — do not build that.

1. Alchemy POSTs address activity (Base) to `/api/webhooks/deposit`.
2. Handler reads the **raw body** (Next route: disable body parsing) and verifies the
   **`X-Alchemy-Signature` HMAC-SHA256** against `ALCHEMY_WEBHOOK_SIGNING_KEY`. Reject on mismatch.
3. **Filter the payload**: Address Activity includes ALL activity for the address. Keep only
   transfers where `contractAddress == USDC_BASE` AND direction is **inbound** (`to` == the user's wallet).
   Ignore everything else (ETH, other tokens, outbound). Outbound is handled by reconciliation, not here.
4. **Dedupe by `txHash` + `logIndex`** (Alchemy retries). Resolve the user by `walletAddress`.
5. Allocate the deposit across that user's buckets by `pct`, using **largest-remainder rounding to cents**
   so the split sums EXACTLY to the deposit (no penny drift).
6. Increment each `bucket.amount` and write a `Deposit` row in one DB transaction. Fire a push:
   "$X landed, split across N buckets."

**Outflow reconciliation (important):** a card spend / on-chain send lowers the real balance but the chain
doesn't know which bucket it came from. v1 rule: attribute outflows to the **spending bucket** (decrement
`isSpending` bucket). A periodic reconcile job compares `sum(bucket.amount)` to the live on-chain balance and
corrects drift against the spending bucket. (When the Gnosis card webhook lands, attribute precisely instead.)

---

## Funding (FundingSource abstraction)

"Add money" is a **swappable front-end**, not a hardcoded vendor. Build a `FundingSource` interface so
v1 ships on MoonPay and Bridge slots in later without touching the split engine.

**Hard rule — the interface owns INITIATION + KYC only. It NEVER detects or credits deposits.**
Settlement is always the Alchemy on-chain webhook above. Every provider just delivers USDC to the user's
Base wallet; the existing webhook catches the arrival and credits buckets. Do not give providers their own
crediting path.

```ts
type FundingInit =
  | { kind: 'widget'; url: string }                                  // MoonPay: open hosted widget
  | { kind: 'account'; accountNumber: string; routingNumber: string }; // Bridge: persistent deposit details

interface FundingSource {
  id: 'moonpay' | 'bridge';
  supportsDirectDeposit: boolean;                 // false (MoonPay), true (Bridge — the "get paid into it" anchor)
  initiateFunding(user: User, amountUsd?: number): Promise<FundingInit>;
  getKycStatus(user: User): Promise<'none' | 'pending' | 'approved' | 'rejected'>;
}
```

**v1 implementation — `MoonPayFundingSource`:**
- `initiateFunding` returns a `widget` URL pointed at the user's Base wallet, **server-signed** with
  `MOONPAY_SECRET_KEY` (MoonPay requires URL signing — never build the URL client-side).
- KYC happens inside MoonPay's widget; mirror status via `getKycStatus`.
- The purchased USDC lands on Base → the **Alchemy webhook** credits buckets. Nothing else does.

**Provider status webhooks are UX-ONLY (double-credit guardrail):**
MoonPay also sends its own transaction-status webhook (`MOONPAY_WEBHOOK_SECRET`). Use it ONLY to show
pending/complete state in the UI. It must NEVER touch `bucket.amount` — crediting happens once, from the
on-chain webhook, deduped by `txHash`. Crediting off both = double-counting.

**Tagging `Deposit.source`:** on `initiateFunding`, persist a pending funding intent (provider + user +
expected amount). When the on-chain webhook fires, match the arrival to an open intent to set
`source = 'moonpay'`; unmatched inbound USDC (hand-sent) defaults to `source = 'onchain'`.

**Bridge later** implements the same interface with `supportsDirectDeposit: true` and an `account` init
(virtual account + routing number). Same back half. Swapping providers is one factory line, not a refactor.

---

## Decisions already made — do NOT re-derive these wrong

- Passkeys cannot create Privy accounts → email-create, passkey-link for re-auth.
- Buckets = off-chain ledger over one real balance (not multiple wallets).
- `isSpending` is a role flag, separate from the bucket name; rename is free off-chain metadata.
- `pct` per user sums to 100; gate deposits on this.
- iOS cannot trigger "add to home screen" programmatically — onboarding shows manual Share-sheet
  instructions and detects `display-mode: standalone`. Don't fake an install button on iOS.
- Non-custodial WITH assisted recovery — keep the copy honest.

## Out of scope for v1 (do not build unless asked)

- DeFi / yield ("grow" buckets) — regulatory (GENIUS Act). Later phase, off the iOS surface.
- Bridge direct-deposit / virtual accounts and Gnosis card — later phases. (v1 funds via MoonPay behind
  the `FundingSource` interface; Bridge is a swap-in, not a v1 build.)
- Native app shell.

---

## Build order (work in phases; commit per phase)

1. **Scaffold + Privy auth** — TS Next App Router, PrivyProvider (Base, email, auto embedded wallet),
   login gate, show wallet address. Confirm a real Base wallet provisions on login.
2. **Postgres + Prisma** — schema above, migrations, on first login upsert User + seed default buckets.
   **In the same signup path, register the new wallet address to the Alchemy webhook** (Notify API).
   This is easy to forget and breaks deposits for every real user if missed.
3. **Buckets UI + rules** — buckets home (live balance via viem), split editor (pct steppers, sum=100 gate),
   inline rename, `isSpending` star toggle. (Port the design from the prototype.)
4. **Split-on-arrival engine** — the Alchemy webhook + signature verify + inbound-USDC filter + allocation
   + reconciliation above. This is the milestone that makes buckets *real*. Test with a real Base USDC
   transfer to a registered address, end to end.
5. **Funding (MoonPay)** — the `FundingSource` interface + `MoonPayFundingSource`: signed widget URL,
   "Add money" button, pending-intent tagging. Crediting stays on the Alchemy webhook only. This is what
   lets a non-crypto person actually fund the account.
6. **Card view + transactions** — bucket-tagged history; card draws from `isSpending` bucket.
7. **PWA** — manifest, service worker, add-to-home-screen onboarding + notification permission capture.
8. **(Later)** Bridge as a second `FundingSource` (direct deposit); Gnosis card issuance.

After each phase, verify the core invariant holds before moving on.
