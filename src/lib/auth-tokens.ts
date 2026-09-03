import { SignJWT, jwtVerify } from "jose";

export const ACCESS_TOKEN_TTL_SECONDS = 10 * 60;
export const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;
export const REFRESH_COOKIE_NAME = "vocabloom_refresh";

const encoder = new TextEncoder();

function secret() {
  const value = process.env.JWT_ACCESS_SECRET;
  if (!value || encoder.encode(value).byteLength < 32 || value.startsWith("replace-with-")) {
    throw new Error("JWT_ACCESS_SECRET must contain at least 32 non-placeholder bytes.");
  }
  return encoder.encode(value);
}

export type AccessTokenClaims = {
  sub: string;
  jti: string;
  type: "access";
  authVersion: number;
};

export async function createAccessToken(userId: string, authVersion: number) {
  return new SignJWT({ type: "access", authVersion })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setJti(crypto.randomUUID())
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TOKEN_TTL_SECONDS}s`)
    .sign(secret());
}

export async function verifyAccessToken(token: string): Promise<AccessTokenClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secret(), {
      algorithms: ["HS256"],
    });
    if (
      payload.type !== "access"
      || typeof payload.sub !== "string"
      || typeof payload.jti !== "string"
      || typeof payload.authVersion !== "number"
      || !Number.isSafeInteger(payload.authVersion)
    ) {
      return null;
    }
    return { sub: payload.sub, jti: payload.jti, type: "access", authVersion: payload.authVersion };
  } catch {
    return null;
  }
}

export function createRefreshToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function hashRefreshToken(token: string) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(token));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function refreshCookieOptions(maxAge = REFRESH_TOKEN_TTL_SECONDS) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    maxAge,
    path: "/",
  };
}

export const noStoreHeaders = { "Cache-Control": "no-store" };
