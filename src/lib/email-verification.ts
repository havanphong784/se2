import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";

import { getDb } from "@/db";
import { emailVerificationTokens, users } from "@/db/schema";

const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
type Db = NonNullable<ReturnType<typeof getDb>>;

export function hashEmailVerificationToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function createEmailVerificationToken() {
  const token = randomBytes(32).toString("hex");
  return { token, tokenHash: hashEmailVerificationToken(token) };
}

export async function createVerificationToken(db: Db, userId: string) {
  const { token, tokenHash } = createEmailVerificationToken();
  await db.transaction(async (tx) => {
    await tx.delete(emailVerificationTokens).where(eq(emailVerificationTokens.userId, userId));
    await tx.insert(emailVerificationTokens).values({
      userId,
      tokenHash,
      expiresAt: new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS),
    });
  });
  return token;
}

export async function consumeVerificationToken(db: Db, token: string) {
  const now = new Date();
  return db.transaction(async (tx) => {
    const [record] = await tx
      .select({ id: emailVerificationTokens.id, userId: emailVerificationTokens.userId })
      .from(emailVerificationTokens)
      .where(
        and(
          eq(emailVerificationTokens.tokenHash, hashEmailVerificationToken(token)),
          gt(emailVerificationTokens.expiresAt, now),
          isNull(emailVerificationTokens.consumedAt),
        ),
      )
      .limit(1);
    if (!record) return false;

    const [consumed] = await tx
      .update(emailVerificationTokens)
      .set({ consumedAt: now })
      .where(and(eq(emailVerificationTokens.id, record.id), isNull(emailVerificationTokens.consumedAt)))
      .returning({ id: emailVerificationTokens.id });
    if (!consumed) return false;

    await tx.update(users).set({ emailVerifiedAt: now, updatedAt: now }).where(eq(users.id, record.userId));
    await tx.delete(emailVerificationTokens).where(eq(emailVerificationTokens.userId, record.userId));
    return true;
  });
}
