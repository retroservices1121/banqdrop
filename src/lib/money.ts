// Money is handled in integer CENTS internally (no float drift). Bucket.amount is
// a Prisma Decimal(18,2) at the DB boundary. These helpers convert at the edges.
import { Prisma } from "@prisma/client";

export type Cents = number; // integer

export function dollarsToCents(usd: number): Cents {
  return Math.round(usd * 100);
}

export function centsToDollars(cents: Cents): number {
  return +(cents / 100).toFixed(2);
}

/** Prisma Decimal -> integer cents. */
export function decimalToCents(d: Prisma.Decimal): Cents {
  return Math.round(d.times(100).toNumber());
}

/** integer cents -> Prisma Decimal (dollars, 2dp). */
export function centsToDecimal(cents: Cents): Prisma.Decimal {
  return new Prisma.Decimal(cents).dividedBy(100);
}

export function formatUsd(cents: Cents): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    cents / 100
  );
}
