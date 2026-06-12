// The rails contract. The PRODUCT only ever talks to these interfaces — never a
// vendor directly. OMS is the intended primary implementation; the mock provider
// (and, later, the Base stack) implement the SAME interface. Swapping is a factory
// line, not a refactor.

export type KycStatus = "none" | "pending" | "approved" | "rejected";

export interface Wallet {
  address: string;
  chain: string;
  getUsdcBalance(): Promise<number>;
}

/** Minimal user shape the rails layer needs. Mirrors the Prisma User. */
export interface RailsUser {
  id: string;
  email?: string | null;
  walletAddress?: string | null;
}

/** How a funding flow is started. The interface owns INITIATION + KYC only —
 *  it NEVER credits buckets. Crediting happens once, from the deposit event. */
export type FundingInit =
  | { kind: "widget"; url: string } // hosted ramp UI
  | { kind: "account"; accountNumber: string; routingNumber: string } // direct-deposit anchor
  | { kind: "cash"; code: string; locationId: string }; // OMS in-person cash-in

export interface FundingSource {
  id: "oms" | "moonpay" | "bridge" | "mock";
  supportsDirectDeposit: boolean;
  supportsCashIn: boolean;
  initiateFunding(user: RailsUser, amountUsd?: number): Promise<FundingInit>;
  getKycStatus(user: RailsUser): Promise<KycStatus>;
}

/** A normalized inbound-deposit event, however it was detected (provider webhook
 *  preferred, on-chain webhook fallback). The spine reacts to THIS, rails-agnostic. */
export interface DepositEvent {
  /** Unique idempotency key. onchain = `${txHash}:${logIndex}`. */
  txHash: string;
  /** Wallet address the funds landed on. */
  toAddress: string;
  amountUsd: number;
  source: "oms" | "onchain" | "moonpay" | "bridge" | "mock";
}

export interface RailsProvider {
  id: "oms" | "mock" | "base";
  /** Provision (or fetch) the user's non-custodial wallet. Called on signup. */
  ensureWallet(user: RailsUser): Promise<Wallet>;
  getKycStatus(user: RailsUser): Promise<KycStatus>;
  funding: FundingSource;

  /** Verify a raw webhook payload's signature and normalize it to DepositEvent[].
   *  Returns [] for non-deposit events. Throws on signature failure. */
  parseDepositWebhook(rawBody: string, headers: Record<string, string>): Promise<DepositEvent[]>;

  /** Register a freshly-provisioned wallet with the event source if required.
   *  OMS: no-op (per-user webhook). Base/Alchemy: add address to the dynamic set. */
  registerWalletForEvents?(wallet: Wallet): Promise<void>;
}
