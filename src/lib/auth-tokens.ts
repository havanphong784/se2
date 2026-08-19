import { SignJWT, jwtVerify } from "jose";

export const ACCESS_TOKEN_TTL_SECONDS = 10 * 60;
export const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;
export const REFRESH_COOKIE_NAME = "vocabloom_refresh";

const encoder = new TextEncoder();

function secret(name: "JWT_ACCESS_SECRET" | "JWT_REFRESH_SECRET") {
  const value = process.env[name];
  if (!value) throw new Error(`${name} must be configured.`);
  return encoder.encode(value);
}

export type AccessTokenClaims = {
  sub: string;
  jti: string;
  type: "access";
};

export async function createAccessToken(userId: string) {
  return new SignJWT({ type: "access" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setJti(crypto.randomUUID())
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TOKEN_TTL_SECONDS}s`)
    .sign(secret("JWT_ACCESS_SECRET"));
}

export async function verifyAccessToken(token: string): Promise<AccessTokenClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secret("JWT_ACCESS_SECRET"), {
      algorithms: ["HS256"],
    });
    if (payload.type !== "access" || typeof payload.sub !== "string" || typeof payload.jti !== "string") {
      return null;
    }
    return { sub: payload.sub, jti: payload.jti, type: "access" };
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
