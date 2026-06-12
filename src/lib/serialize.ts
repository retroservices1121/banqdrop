// DTOs for the client. Prisma Decimal -> plain numbers (cents + usd) so JSON is
// lossless and the UI never does float math on money.
import type { Bucket, Deposit, User } from "@prisma/client";
import { centsToDollars, decimalToCents } from "./money";

export interface BucketDTO {
  id: string;
  name: string;
  color: string;
  pct: number;
  amountCents: number;
  amountUsd: number;
  isSpending: boolean;
  sortOrder: number;
}

export function bucketDTO(b: Bucket): BucketDTO {
  const cents = decimalToCents(b.amount);
  return {
    id: b.id,
    name: b.name,
    color: b.color,
    pct: b.pct,
    amountCents: cents,
    amountUsd: centsToDollars(cents),
    isSpending: b.isSpending,
    sortOrder: b.sortOrder,
  };
}

export interface DepositDTO {
  id: string;
  txHash: string;
  amountUsd: number;
  source: string;
  createdAt: string;
}

export function depositDTO(d: Deposit): DepositDTO {
  return {
    id: d.id,
    txHash: d.txHash,
    amountUsd: centsToDollars(decimalToCents(d.amountUsd)),
    source: d.source,
    createdAt: d.createdAt.toISOString(),
  };
}

export interface MeDTO {
  user: { id: string; email: string | null; walletAddress: string; chain: string; kycStatus: string };
  buckets: BucketDTO[];
  totalLedgerCents: number;
  balanceUsd: number; // live on-chain USDC balance
}

export function meDTO(
  user: User,
  buckets: Bucket[],
  balanceUsd: number
): MeDTO {
  const dtos = buckets.map(bucketDTO).sort((a, b) => a.sortOrder - b.sortOrder);
  return {
    user: {
      id: user.id,
      email: user.email,
      walletAddress: user.walletAddress,
      chain: user.chain,
      kycStatus: user.kycStatus,
    },
    buckets: dtos,
    totalLedgerCents: dtos.reduce((s, b) => s + b.amountCents, 0),
    balanceUsd,
  };
}
