// Mock RailsProvider — lets us build and test the ENTIRE product (split-on-arrival,
// reconciliation, buckets UI, funding UI) with no live vendor. It implements the
// exact same contract OMS will. A deterministic fake wallet is derived from the
// user id; balances are tracked in-memory + nudged by mock deposits so the core
// invariant can be exercised end-to-end.
//
// Swap to the real OMS provider by setting RAILS_PROVIDER=oms (see ../factory.ts).

import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type {
  DepositEvent,
  FundingInit,
  FundingSource,
  KycStatus,
  RailsProvider,
  RailsUser,
  Wallet,
} from "../types";

const MOCK_SECRET = process.env.MOCK_WEBHOOK_SECRET ?? "dev-mock-secret";

/** Deterministic 0x address from a user id — stable across restarts. */
export function mockAddressFor(userId: string): string {
  const h = createHash("sha256").update(`banqdrop:${userId}`).digest("hex");
  return `0x${h.slice(0, 40)}`;
}

/** In-memory ledger of mock on-chain balances, keyed by address (cents as number).
 *  The reconciliation job reads this via getUsdcBalance to compare against the DB. */
const mockChainBalances = new Map<string, number>();

export function creditMockChain(address: string, amountUsd: number): number {
  const next = +(((mockChainBalances.get(address) ?? 0) + amountUsd).toFixed(2));
  mockChainBalances.set(address, next);
  return next;
}

export function debitMockChain(address: string, amountUsd: number): number {
  const next = +(((mockChainBalances.get(address) ?? 0) - amountUsd).toFixed(2));
  mockChainBalances.set(address, next);
  return next;
}

export function getMockChainBalance(address: string): number {
  return mockChainBalances.get(address) ?? 0;
}

function makeWallet(address: string): Wallet {
  return {
    address,
    chain: process.env.APP_CHAIN ?? "polygon",
    async getUsdcBalance() {
      return getMockChainBalance(address);
    },
  };
}

const mockFunding: FundingSource = {
  id: "mock",
  supportsDirectDeposit: true,
  supportsCashIn: true,
  async initiateFunding(user: RailsUser, amountUsd?: number): Promise<FundingInit> {
    // Hosted-widget style: points at our own dev funding simulator.
    const amt = amountUsd ? `&amount=${amountUsd}` : "";
    return { kind: "widget", url: `/dev/fund?user=${encodeURIComponent(user.id)}${amt}` };
  },
  async getKycStatus(): Promise<KycStatus> {
    return "approved"; // mock users are pre-cleared
  },
};

/** HMAC over the body, hex. Used to sign the dev deposit-trigger endpoint so the
 *  webhook-verification path is exercised exactly like a real provider. */
export function signMockWebhook(rawBody: string): string {
  return createHmac("sha256", MOCK_SECRET).update(rawBody).digest("hex");
}

export const mockRails: RailsProvider = {
  id: "mock",

  async ensureWallet(user: RailsUser): Promise<Wallet> {
    const address = user.walletAddress ?? mockAddressFor(user.id);
    return makeWallet(address);
  },

  async getKycStatus(): Promise<KycStatus> {
    return "approved";
  },

  funding: mockFunding,

  async parseDepositWebhook(rawBody, headers): Promise<DepositEvent[]> {
    const sig = headers["x-mock-signature"] ?? headers["X-Mock-Signature"] ?? "";
    const expected = signMockWebhook(rawBody);
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new Error("mock webhook signature mismatch");
    }
    const body = JSON.parse(rawBody) as {
      txHash: string;
      toAddress: string;
      amountUsd: number;
    };
    if (!body.txHash || !body.toAddress || typeof body.amountUsd !== "number") {
      return [];
    }
    return [
      {
        txHash: body.txHash,
        toAddress: body.toAddress,
        amountUsd: body.amountUsd,
        source: "mock",
      },
    ];
  },

  async registerWalletForEvents() {
    // no-op: mock provider delivers per-user events directly.
  },
};
