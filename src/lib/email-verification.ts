import { createHash, randomBytes, randomInt } from "node:crypto";
import { and, desc, eq, isNotNull, isNull, lt, ne, or } from "drizzle-orm";

import { getDb } from "@/db";
import { emailVerificationTokens, users } from "@/db/schema";

const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
const GRACE_PERIOD_MS = 60 * 1000;

type Db = NonNullable<ReturnType<typeof getDb>>;

export type ConsumeVerificationInput =
  | string
  | {
      token?: string;
      email?: string;
      code?: string;
    };

export function hashEmailVerificationToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function hashOtp(userId: string, code: string) {
  return createHash("sha256").update(`${userId}:${code.trim()}`).digest("hex");
}

export const hashOtpCode = hashOtp;

export function createEmailVerificationToken(userId?: string) {
  const token = randomBytes(32).toString("hex");
  const tokenHash = hashEmailVerificationToken(token);
  const otpCode = randomInt(100000, 1000000).toString();
  const otpHash = userId ? hashOtp(userId, otpCode) : undefined;
  return { token, tokenHash, otpCode, otpHash };
}

export async function createVerificationToken(
  db: Db,
  userId: string,
): Promise<{ token: string; otpCode: string }> {
  const { token, tokenHash, otpCode } = createEmailVerificationToken();
  const otpHash = hashOtp(userId, otpCode);
  await db.insert(emailVerificationTokens).values({
    userId,
    tokenHash,
    otpHash,
    expiresAt: new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS),
  });
  return { token, otpCode };
}

export async function consumeVerificationToken(
  db: Db,
  input: ConsumeVerificationInput,
): Promise<boolean> {
  const tokenParam = typeof input === "string" ? input : input?.token;
  const emailParam = typeof input === "object" ? input?.email : undefined;
  const codeParam = typeof input === "object" ? input?.code : undefined;

  const now = new Date();

  async function finalizeConsumption(
    recordId: string,
    userId: string,
  ): Promise<boolean> {
    return db.transaction(async (tx) => {
      const [consumed] = await tx
        .update(emailVerificationTokens)
        .set({ consumedAt: now })
        .where(
          and(
            eq(emailVerificationTokens.id, recordId),
            isNull(emailVerificationTokens.consumedAt),
          ),
        )
        .returning({ id: emailVerificationTokens.id });

      if (!consumed) {
        const [current] = await tx
          .select({ consumedAt: emailVerificationTokens.consumedAt })
          .from(emailVerificationTokens)
          .where(eq(emailVerificationTokens.id, recordId))
          .limit(1);

        if (
          current?.consumedAt &&
          now.getTime() - current.consumedAt.getTime() <= GRACE_PERIOD_MS
        ) {
          return true;
        }
        return false;
      }

      await tx
        .update(users)
        .set({ emailVerifiedAt: now, updatedAt: now })
        .where(eq(users.id, userId));

      const graceThreshold = new Date(now.getTime() - GRACE_PERIOD_MS);
      await tx
        .delete(emailVerificationTokens)
        .where(
          and(
            eq(emailVerificationTokens.userId, userId),
            ne(emailVerificationTokens.id, recordId),
            or(
              lt(emailVerificationTokens.expiresAt, now),
              and(
                isNotNull(emailVerificationTokens.consumedAt),
                lt(emailVerificationTokens.consumedAt, graceThreshold),
              ),
            ),
          ),
        );

      return true;
    });
  }

  if (typeof tokenParam === "string" && /^[a-f0-9]{64}$/.test(tokenParam.trim())) {
    const tokenHash = hashEmailVerificationToken(tokenParam.trim());
    const [record] = await db
      .select({
        id: emailVerificationTokens.id,
        userId: emailVerificationTokens.userId,
        consumedAt: emailVerificationTokens.consumedAt,
        expiresAt: emailVerificationTokens.expiresAt,
      })
      .from(emailVerificationTokens)
      .where(eq(emailVerificationTokens.tokenHash, tokenHash))
      .limit(1);

    if (!record) return false;
    if (record.expiresAt <= now) return false;

    if (record.consumedAt !== null) {
      const elapsed = now.getTime() - record.consumedAt.getTime();
      return elapsed >= 0 && elapsed <= GRACE_PERIOD_MS;
    }

    return finalizeConsumption(record.id, record.userId);
  }

  if (typeof emailParam === "string" && typeof codeParam === "string") {
    const cleanEmail = emailParam.trim().toLowerCase();
    const cleanCode = codeParam.trim();
    if (!cleanEmail || !/^\d{6}$/.test(cleanCode)) {
      return false;
    }

    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, cleanEmail))
      .limit(1);

    if (!user) return false;

    const otpHash = hashOtp(user.id, cleanCode);
    const [record] = await db
      .select({
        id: emailVerificationTokens.id,
        userId: emailVerificationTokens.userId,
        consumedAt: emailVerificationTokens.consumedAt,
        expiresAt: emailVerificationTokens.expiresAt,
      })
      .from(emailVerificationTokens)
      .where(
        and(
          eq(emailVerificationTokens.userId, user.id),
          eq(emailVerificationTokens.otpHash, otpHash),
        ),
      )
      .orderBy(desc(emailVerificationTokens.createdAt))
      .limit(1);

    if (!record) return false;
    if (record.expiresAt <= now) return false;

    if (record.consumedAt !== null) {
      const elapsed = now.getTime() - record.consumedAt.getTime();
      return elapsed >= 0 && elapsed <= GRACE_PERIOD_MS;
    }

    return finalizeConsumption(record.id, record.userId);
  }

  return false;
}
