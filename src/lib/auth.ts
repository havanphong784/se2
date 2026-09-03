import { and, eq, gt, isNotNull, isNull } from "drizzle-orm";
import { cookies } from "next/headers";

import { getDb } from "@/db";
import { refreshTokens, users } from "@/db/schema";
import { hashRefreshToken, REFRESH_COOKIE_NAME, verifyAccessToken } from "@/lib/auth-tokens";

export type AuthUser = {
  id: string;
  displayName: string;
  email: string;
  emailVerifiedAt: Date | null;
  authVersion: number;
};

type Db = NonNullable<ReturnType<typeof getDb>>;

export async function getAuthUser(db: Db, userId: string): Promise<AuthUser | null> {
  const [user] = await db
    .select({
      id: users.id,
      displayName: users.displayName,
      email: users.email,
      emailVerifiedAt: users.emailVerifiedAt,
      authVersion: users.authVersion,
    })
    .from(users)
    .where(and(eq(users.id, userId), isNotNull(users.emailVerifiedAt)))
    .limit(1);
  return user ?? null;
}

export async function requireAuth(request: Request, db: Db): Promise<AuthUser | null> {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return null;

  const claims = await verifyAccessToken(authorization.slice("Bearer ".length));
  if (!claims) return null;
  const user = await getAuthUser(db, claims.sub);
  return user?.authVersion === claims.authVersion ? user : null;
}

export async function getCurrentAuthUser(db: Db): Promise<AuthUser | null> {
  try {
    const token = (await cookies()).get(REFRESH_COOKIE_NAME)?.value;
    if (!token) return null;
    const [session] = await db
      .select({ userId: refreshTokens.userId })
      .from(refreshTokens)
      .where(
        and(
          eq(refreshTokens.tokenHash, await hashRefreshToken(token)),
          isNull(refreshTokens.revokedAt),
          gt(refreshTokens.expiresAt, new Date()),
        ),
      )
      .limit(1);
    return session ? getAuthUser(db, session.userId) : null;
  } catch {
    return null;
  }
}
