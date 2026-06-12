// Session + user bootstrap. On first login we upsert the User (wallet provisioned
// via the rails contract) and seed default buckets — exactly once. Auth here is a
// lightweight dev session (signed-less cookie holding the user id); it is the seam
// where OMS email-create + passkey re-auth slots in later behind the same shape.

import "server-only";
import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import type { Bucket, User } from "@prisma/client";
import { prisma } from "./db";
import { rails } from "@/rails/factory";
import { seedDefaultBuckets } from "@/ledger/buckets";
import { meDTO, type MeDTO } from "./serialize";

const COOKIE = "bd_uid";

/** Stable user id derived from email — deterministic so re-login finds the same user. */
export function userIdFromEmail(email: string): string {
  const h = createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
  return `usr_${h.slice(0, 24)}`;
}

/** Create-or-fetch the user, provision wallet, seed buckets on first touch. */
export async function ensureUser(email: string): Promise<User & { buckets: Bucket[] }> {
  const cleanEmail = email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cleanEmail)) {
    throw new Error("invalid email");
  }
  const id = userIdFromEmail(cleanEmail);

  const wallet = await rails.ensureWallet({ id, email: cleanEmail });
  const kyc = await rails.getKycStatus({ id, email: cleanEmail, walletAddress: wallet.address });

  // Upsert without clobbering an existing wallet address.
  const user = await prisma.user.upsert({
    where: { id },
    create: {
      id,
      email: cleanEmail,
      walletAddress: wallet.address.toLowerCase(),
      chain: wallet.chain,
      kycStatus: kyc,
    },
    update: { kycStatus: kyc },
  });

  // Register the wallet with the event source if the provider needs it (Base/Alchemy).
  await rails.registerWalletForEvents?.(wallet);

  // Seed default buckets exactly once.
  const count = await prisma.bucket.count({ where: { userId: id } });
  if (count === 0) await seedDefaultBuckets(id);

  const buckets = await prisma.bucket.findMany({
    where: { userId: id },
    orderBy: { sortOrder: "asc" },
  });
  return { ...user, buckets };
}

export async function setSession(userId: string) {
  const jar = await cookies();
  jar.set(COOKIE, userId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearSession() {
  (await cookies()).delete(COOKIE);
}

export async function currentUserId(): Promise<string | null> {
  return (await cookies()).get(COOKIE)?.value ?? null;
}

export async function getCurrentUser(): Promise<(User & { buckets: Bucket[] }) | null> {
  const id = await currentUserId();
  if (!id) return null;
  const user = await prisma.user.findUnique({
    where: { id },
    include: { buckets: { orderBy: { sortOrder: "asc" } } },
  });
  return user;
}

/** Assemble the client-facing snapshot: user + buckets + LIVE on-chain balance. */
export async function loadMe(user: User & { buckets: Bucket[] }): Promise<MeDTO> {
  const wallet = await rails.ensureWallet(user);
  const balanceUsd = await wallet.getUsdcBalance();
  return meDTO(user, user.buckets, balanceUsd);
}
