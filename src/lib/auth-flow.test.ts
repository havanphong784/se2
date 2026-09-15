import assert from "node:assert/strict";
import { pbkdf2Sync } from "node:crypto";
import { describe, it } from "node:test";
import { SignJWT } from "jose";
import { NextRequest } from "next/server";

import { middleware, publicAuthPaths } from "../../middleware";
import { authRateLimits, refreshTokens, users } from "@/db/schema";
import { hashPassword, needsPasswordRehash, verifyPassword } from "./auth-crypto";
import {
  createEmailVerificationToken,
  hashEmailVerificationToken,
  hashOtp,
  hashOtpCode,
} from "./email-verification";
import { clientIp, isRateLimited, resetRateLimit, type Limit } from "./auth-rate-limit";
import {
  createAccessToken,
  createRefreshToken,
  hashRefreshToken,
  verifyAccessToken,
} from "./auth-tokens";
import {
  createRefreshSession,
  rotateRefreshSession,
  REFRESH_GRACE_PERIOD_MS,
} from "./auth-sessions";

process.env.JWT_ACCESS_SECRET = "test-access-secret-at-least-32-characters-long";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret-at-least-32-characters-long";

const demoUser = {
  id: "e4a2a110-8b17-4972-9a3d-4c34a9ef86a4",
  email: "demo-user@vocabloom.test",
  displayName: "Demo User",
  password: "DemoSecurePassword123!@",
  authVersion: 1,
};

type MockUserRow = {
  id: string;
  email: string;
  displayName: string;
  authVersion: number;
  updatedAt: Date | null;
};

type MockRefreshTokenRow = {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  replacedById: string | null;
  lastUsedAt: Date | null;
  createdAt: Date;
};

type MockRateLimitRow = {
  keyHash: string;
  windowStartedAt: Date;
  attempts: number;
};

function extractParams(sqlObj: unknown): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  function walk(node: unknown): void {
    if (!node) return;
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (typeof node === "object" && node !== null && "queryChunks" in node) {
      const chunks = (node as { queryChunks: unknown[] }).queryChunks;
      for (let i = 0; i < chunks.length; i++) {
        const c = chunks[i] as { name?: string };
        const valHolder = chunks[i + 2] as { value?: unknown } | undefined;
        if (c && c.name && valHolder && valHolder.value !== undefined) {
          result[c.name] = valHolder.value;
        }
      }
      walk(chunks);
    }
  }
  walk(sqlObj);
  return result;
}

function hasNullCheck(sqlObj: unknown, fieldName: string): boolean {
  let found = false;
  function walk(node: unknown): void {
    if (!node || found) return;
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (typeof node === "object" && node !== null && "queryChunks" in node) {
      const chunks = (node as { queryChunks: unknown[] }).queryChunks;
      for (let i = 0; i < chunks.length; i++) {
        const c = chunks[i] as { name?: string };
        const valHolder = chunks[i + 1] as { value?: unknown } | undefined;
        if (
          c &&
          c.name === fieldName &&
          valHolder &&
          Array.isArray(valHolder.value) &&
          valHolder.value.join("").toLowerCase().includes("is null")
        ) {
          found = true;
          return;
        }
      }
      walk(chunks);
    }
  }
  walk(sqlObj);
  return found;
}

function createMockAuthDb() {
  const usersTable: MockUserRow[] = [
    {
      id: demoUser.id,
      email: demoUser.email,
      displayName: demoUser.displayName,
      authVersion: demoUser.authVersion,
      updatedAt: new Date(),
    },
  ];
  const tokensTable: MockRefreshTokenRow[] = [];
  const rateLimitsTable: MockRateLimitRow[] = [];

  const mock = {
    insert: (table: unknown) => ({
      values: (data: Record<string, unknown>) => {
        if (table === authRateLimits) {
          return {
            onConflictDoUpdate: () => ({
              returning: async () => {
                const keyHash = data.keyHash as string;
                const windowStartedAt = data.windowStartedAt as Date;
                let bucket = rateLimitsTable.find(
                  (b) =>
                    b.keyHash === keyHash &&
                    b.windowStartedAt.getTime() === windowStartedAt.getTime(),
                );
                if (bucket) {
                  bucket.attempts += 1;
                } else {
                  bucket = { keyHash, windowStartedAt, attempts: 1 };
                  rateLimitsTable.push(bucket);
                }
                return [{ attempts: bucket.attempts }];
              },
            }),
          };
        }

        if (table === refreshTokens) {
          const row: MockRefreshTokenRow = {
            id: `tok-${tokensTable.length + 1}-${crypto.randomUUID().slice(0, 8)}`,
            userId: data.userId as string,
            tokenHash: data.tokenHash as string,
            expiresAt: data.expiresAt as Date,
            revokedAt: null,
            replacedById: null,
            lastUsedAt: null,
            createdAt: new Date(),
          };
          tokensTable.push(row);
          return {
            returning: async () => [{ id: row.id }],
            then: (resolve: (rows: MockRefreshTokenRow[]) => unknown) =>
              Promise.resolve([row]).then(resolve),
          };
        }

        return {
          returning: async () => [],
          then: (resolve: (rows: unknown[]) => unknown) => Promise.resolve([]).then(resolve),
        };
      },
    }),

    select: () => ({
      from: (table: unknown) => ({
        where: (condition: unknown) => {
          const params = extractParams(condition);
          let rows: unknown[] = [];
          if (table === refreshTokens) {
            rows = tokensTable.filter((t) => {
              if (params.token_hash && t.tokenHash !== params.token_hash) return false;
              if (params.id && t.id !== params.id) return false;
              if (params.user_id && t.userId !== params.user_id) return false;
              return true;
            });
          }
          const makeBuilder = (resRows: unknown[]) => ({
            for: () => makeBuilder(resRows),
            limit: (n: number) => makeBuilder(resRows.slice(0, n)),
            then: (resolve: (data: unknown[]) => unknown) =>
              Promise.resolve(resRows).then(resolve),
          });
          return makeBuilder(rows);
        },
      }),
    }),

    update: (table: unknown) => ({
      set: (values: Record<string, unknown>) => ({
        where: (condition: unknown) => {
          const params = extractParams(condition);
          const needsRevokedNull = hasNullCheck(condition, "revoked_at");
          const res: Array<{ id: string }> = [];

          if (table === refreshTokens) {
            const targets = tokensTable.filter((t) => {
              if (params.id && t.id !== params.id) return false;
              if (params.user_id && t.userId !== params.user_id) return false;
              if (needsRevokedNull && t.revokedAt !== null) return false;
              return true;
            });
            for (const t of targets) {
              if (values.revokedAt !== undefined) t.revokedAt = values.revokedAt as Date;
              if (values.lastUsedAt !== undefined) t.lastUsedAt = values.lastUsedAt as Date;
              if (values.replacedById !== undefined)
                t.replacedById = values.replacedById as string;
              res.push({ id: t.id });
            }
          } else if (table === users) {
            const targets = usersTable.filter((u) => {
              if (params.id && u.id !== params.id) return false;
              return true;
            });
            for (const u of targets) {
              if (values.authVersion !== undefined) u.authVersion += 1;
              if (values.updatedAt !== undefined) u.updatedAt = values.updatedAt as Date;
              res.push({ id: u.id });
            }
          }

          return {
            returning: async () => res,
            then: (resolve: (data: unknown[]) => unknown) => Promise.resolve(res).then(resolve),
          };
        },
      }),
    }),

    delete: (table: unknown) => ({
      where: async (condition: unknown) => {
        const params = extractParams(condition);
        if (table === authRateLimits && params.key_hash) {
          const idx = rateLimitsTable.findIndex((r) => r.keyHash === params.key_hash);
          if (idx >= 0) rateLimitsTable.splice(idx, 1);
        }
        return [];
      },
    }),

    transaction: async <T>(cb: (tx: unknown) => Promise<T>): Promise<T> =>
      cb(mock),

    _state: { usersTable, tokensTable, rateLimitsTable },
  };

  return mock;
}

type MockDb = ReturnType<typeof createMockAuthDb>;

describe("Vocabloom Auth Flow End-to-End Test Suite", () => {
  describe("Password Security", () => {
    it("hashes demo password with hashPassword and verifies correct and incorrect passwords", async () => {
      const passwordHash = await hashPassword(demoUser.password);

      assert.ok(passwordHash.startsWith("pbkdf2-sha512:600000:"));
      assert.equal(
        await verifyPassword(demoUser.password, passwordHash),
        true,
        "Correct password must be verified successfully",
      );
      assert.equal(
        await verifyPassword("WrongPassword123!", passwordHash),
        false,
        "Incorrect password must be rejected",
      );
      assert.equal(
        await verifyPassword("", passwordHash),
        false,
        "Empty password must be rejected",
      );
    });

    it("correctly checks needsPasswordRehash for current and legacy hashes", async () => {
      const currentHash = await hashPassword(demoUser.password);
      assert.equal(
        needsPasswordRehash(currentHash),
        false,
        "Current 600,000-iteration PBKDF2 hash does not need rehash",
      );

      const legacySalt = "0123456789abcdef0123456789abcdef";
      const legacyHash = `${legacySalt}:${pbkdf2Sync(demoUser.password, legacySalt, 1_000, 64, "sha512").toString("hex")}`;
      assert.equal(
        await verifyPassword(demoUser.password, legacyHash),
        true,
        "Legacy 1,000-iteration hash still verifies",
      );
      assert.equal(
        needsPasswordRehash(legacyHash),
        true,
        "Legacy hash must require rehash to upgrade security",
      );

      assert.equal(needsPasswordRehash(null), false);
      assert.equal(needsPasswordRehash(undefined), false);
    });

    it("fails closed when verifying malformed or null hashes", async () => {
      assert.equal(await verifyPassword(demoUser.password, null), false);
      assert.equal(await verifyPassword(demoUser.password, undefined), false);
      assert.equal(await verifyPassword(demoUser.password, "malformed:hash"), false);
      assert.equal(
        await verifyPassword(demoUser.password, "pbkdf2-sha512:invalid:salt:hash"),
        false,
      );
    });
  });

  describe("Verification Token & OTP", () => {
    it("generates 64-character hex token and 6-digit OTP code for demo user", () => {
      const { token, tokenHash, otpCode, otpHash } =
        createEmailVerificationToken(demoUser.id);

      assert.match(
        token,
        /^[a-f0-9]{64}$/,
        "Verification token must be a 64-character hexadecimal string",
      );
      assert.equal(
        tokenHash,
        hashEmailVerificationToken(token),
        "tokenHash must match sha256 of the token",
      );
      assert.equal(tokenHash.length, 64);

      assert.match(otpCode, /^\d{6}$/, "OTP must be exactly 6 numeric digits");
      const otpNum = Number.parseInt(otpCode, 10);
      assert.ok(
        otpNum >= 100000 && otpNum <= 999999,
        "OTP numeric value must fall within 100000..999999",
      );

      assert.ok(otpHash, "otpHash must be present when userId is provided");
      assert.equal(
        otpHash,
        hashOtp(demoUser.id, otpCode),
        "otpHash must match hashOtp with demoUser.id and otpCode",
      );
    });

    it("validates hashOtp uniqueness, whitespace trimming, and mismatch resistance", () => {
      const otpCode = "654321";
      const expectedHash = hashOtp(demoUser.id, otpCode);

      assert.equal(
        hashOtp(demoUser.id, `  ${otpCode}  `),
        expectedHash,
        "Whitespace around OTP code must be trimmed before hashing",
      );
      assert.equal(
        hashOtpCode(demoUser.id, otpCode),
        expectedHash,
        "hashOtpCode alias must yield the identical hash",
      );

      const wrongCodeHash = hashOtp(demoUser.id, "123456");
      assert.notEqual(
        expectedHash,
        wrongCodeHash,
        "Different OTP codes for same user must produce distinct hashes",
      );

      const otherUserId = "other-user-uuid-9999";
      const otherUserHash = hashOtp(otherUserId, otpCode);
      assert.notEqual(
        expectedHash,
        otherUserHash,
        "Same OTP code for different users must produce distinct hashes",
      );
    });
  });

  describe("OTP Rate Limiting & Brute Force Prevention", () => {
    it("blocks verification attempts after exceeding maxAttempts for IP and target scopes", async () => {
      const db = createMockAuthDb() as unknown as MockDb;
      const ip = "203.0.113.42";
      const target = demoUser.email;

      const otpLimits: Limit[] = [
        { scope: "verify-otp-ip", key: ip, maxAttempts: 5, windowSeconds: 15 * 60 },
        { scope: "verify-otp-target", key: target, maxAttempts: 3, windowSeconds: 15 * 60 },
      ];

      // Attempts 1 to 3: under or at target limit (maxAttempts: 3)
      assert.equal(await isRateLimited(db as never, otpLimits), false, "Attempt 1 should be allowed");
      assert.equal(await isRateLimited(db as never, otpLimits), false, "Attempt 2 should be allowed");
      assert.equal(await isRateLimited(db as never, otpLimits), false, "Attempt 3 should be allowed");

      // Attempt 4: target attempts = 4 > 3 -> rate limited!
      assert.equal(
        await isRateLimited(db as never, otpLimits),
        true,
        "Attempt 4 must be blocked because target maxAttempts (3) was exceeded",
      );

      // Verify that IP scope independently protects against distributed attacks across targets
      const ipOnlyLimit: Limit[] = [
        { scope: "verify-otp-ip", key: ip, maxAttempts: 5, windowSeconds: 15 * 60 },
      ];
      // Attempts so far for this IP: 4
      assert.equal(
        await isRateLimited(db as never, ipOnlyLimit),
        false,
        "Attempt 5 on IP scope should still pass (attempts=5 <= maxAttempts=5)",
      );
      assert.equal(
        await isRateLimited(db as never, ipOnlyLimit),
        true,
        "Attempt 6 on IP scope must be blocked (attempts=6 > maxAttempts=5)",
      );
    });
  });

  describe("Rate Limit Reset on Success", () => {
    it("clears rate limit bucket after successful OTP verification or login", async () => {
      const db = createMockAuthDb() as unknown as MockDb;
      const ip = "198.51.100.25";
      const cleanEmail = demoUser.email;

      const loginLimits: Limit[] = [
        { scope: "login-ip", key: ip, maxAttempts: 2, windowSeconds: 15 * 60 },
        { scope: "login-email", key: cleanEmail, maxAttempts: 2, windowSeconds: 15 * 60 },
      ];

      // Simulate 2 failed attempts
      assert.equal(await isRateLimited(db as never, loginLimits), false);
      assert.equal(await isRateLimited(db as never, loginLimits), false);

      // 3rd attempt exceeds maxAttempts: 2
      assert.equal(await isRateLimited(db as never, loginLimits), true, "Bucket should be rate limited");

      // Successful login/verification triggers resetRateLimit
      await resetRateLimit(db as never, loginLimits);

      // Next attempt after reset should start fresh and not be rate limited
      assert.equal(
        await isRateLimited(db as never, loginLimits),
        false,
        "After resetRateLimit, the counter restarts and access is granted",
      );
    });
  });

  describe("Client IP Extraction Hardening", () => {
    it("prioritizes cf-connecting-ip over x-real-ip and x-forwarded-for", () => {
      const req = new Request("http://localhost:3000/api/auth/login", {
        headers: {
          "cf-connecting-ip": "203.0.113.1",
          "x-real-ip": "198.51.100.2",
          "x-forwarded-for": "192.0.2.3, 10.0.0.1",
        },
      });
      assert.equal(clientIp(req), "203.0.113.1");
    });

    it("prioritizes x-real-ip over x-forwarded-for when cf-connecting-ip is absent", () => {
      const req = new Request("http://localhost:3000/api/auth/login", {
        headers: {
          "x-real-ip": "198.51.100.2",
          "x-forwarded-for": "192.0.2.3, 10.0.0.1",
        },
      });
      assert.equal(clientIp(req), "198.51.100.2");
    });

    it("falls back to first x-forwarded-for entry when direct headers are absent", () => {
      const req = new Request("http://localhost:3000/api/auth/login", {
        headers: {
          "x-forwarded-for": "192.0.2.3, 10.0.0.1",
        },
      });
      assert.equal(clientIp(req), "192.0.2.3");
    });

    it("returns null when no IP headers are present", () => {
      const req = new Request("http://localhost:3000/api/auth/login");
      assert.equal(clientIp(req), null);
    });
  });

  describe("Access Token JWT", () => {
    it("creates and verifies access token with sub, authVersion, and type access", async () => {
      const token = await createAccessToken(demoUser.id, demoUser.authVersion);
      assert.ok(typeof token === "string" && token.length > 0);

      const claims = await verifyAccessToken(token);
      assert.ok(claims !== null, "Token must be successfully verified");
      assert.equal(claims?.sub, demoUser.id, "Subject must match demoUser.id");
      assert.equal(claims?.authVersion, demoUser.authVersion, "authVersion must match demoUser.authVersion");
      assert.equal(claims?.type, "access", "Token type must be 'access'");
      assert.ok(typeof claims?.jti === "string" && claims.jti.length > 0, "jti must be a non-empty string");
    });

    it("rejects tampered tokens, expired tokens, and invalid signatures", async () => {
      const validToken = await createAccessToken(demoUser.id, demoUser.authVersion);

      // Tampered token
      assert.equal(
        await verifyAccessToken(`${validToken}malicious`),
        null,
        "Tampered token must return null",
      );

      // Expired token signed in the past
      const encoder = new TextEncoder();
      const secret = encoder.encode(process.env.JWT_ACCESS_SECRET);
      const expiredToken = await new SignJWT({ type: "access", authVersion: demoUser.authVersion })
        .setProtectedHeader({ alg: "HS256" })
        .setSubject(demoUser.id)
        .setJti(crypto.randomUUID())
        .setIssuedAt(Math.floor(Date.now() / 1000) - 3600)
        .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
        .sign(secret);

      assert.equal(
        await verifyAccessToken(expiredToken),
        null,
        "Expired token must be rejected and return null",
      );

      // Token signed with wrong secret
      const wrongSecret = encoder.encode("a-completely-different-wrong-secret-32-chars");
      const forgedToken = await new SignJWT({ type: "access", authVersion: demoUser.authVersion })
        .setProtectedHeader({ alg: "HS256" })
        .setSubject(demoUser.id)
        .setJti(crypto.randomUUID())
        .setIssuedAt()
        .setExpirationTime("10m")
        .sign(wrongSecret);

      assert.equal(
        await verifyAccessToken(forgedToken),
        null,
        "Token signed with unauthorized secret must return null",
      );
    });
  });

  describe("Refresh Session & RTR Grace Period", () => {
    it("simulates session table with createRefreshToken, hashRefreshToken and verifies token rotation with replacedById", async () => {
      // Verify raw refresh token generator
      const standaloneToken = createRefreshToken();
      assert.match(standaloneToken, /^[a-f0-9]{64}$/, "createRefreshToken produces 64-char hex string");

      const db = createMockAuthDb() as unknown as MockDb;

      // 1. Initial login: create refresh session
      const session1 = await createRefreshSession(db as never, demoUser.id);
      assert.ok(session1.token, "Refresh session token must be generated");
      assert.ok(session1.expiresAt.getTime() > Date.now(), "Token must expire in the future");

      const sessionHash1 = await hashRefreshToken(session1.token);
      assert.equal(sessionHash1.length, 64, "SHA-256 token hash length must be 64");
      assert.equal(db._state.tokensTable.length, 1);
      assert.equal(db._state.tokensTable[0].userId, demoUser.id);
      assert.equal(db._state.tokensTable[0].revokedAt, null);
      assert.equal(db._state.tokensTable[0].replacedById, null);

      // 2. First rotation: session1 -> session2
      const rotationResult = await rotateRefreshSession(db as never, session1.token);
      assert.ok(rotationResult !== null);
      assert.equal(rotationResult?.status, "rotated");
      assert.equal(rotationResult?.userId, demoUser.id);
      assert.ok(rotationResult?.token);
      assert.notEqual(rotationResult?.token, session1.token, "Rotated token must be distinct");

      // Verify session table state after rotation
      assert.equal(db._state.tokensTable.length, 2, "A new token row must be inserted");
      const oldRow = db._state.tokensTable[0];
      const newRow = db._state.tokensTable[1];

      assert.ok(oldRow.revokedAt instanceof Date, "Old token must be marked revoked");
      assert.ok(oldRow.lastUsedAt instanceof Date, "Old token lastUsedAt must be set");
      assert.equal(oldRow.replacedById, newRow.id, "Old token replacedById must point to the new token ID");
      assert.equal(newRow.revokedAt, null, "New token must remain active and unrevoked");
    });

    it("identifies 'conflict' status when old rotated token is re-sent within 120s grace period without invalidating session", async () => {
      const db = createMockAuthDb() as unknown as MockDb;

      // Create session and rotate once
      const session = await createRefreshSession(db as never, demoUser.id);
      const rotation1 = await rotateRefreshSession(db as never, session.token);
      assert.equal(rotation1?.status, "rotated");

      // Concurrent request or transient network retry sending old token within grace period (120s)
      const conflictResult = await rotateRefreshSession(db as never, session.token);
      assert.deepEqual(
        conflictResult,
        { status: "conflict" },
        "Re-sending old token within 120s grace period must return status: 'conflict'",
      );

      // Ensure user session was NOT invalidated (user's authVersion is intact, active token is not revoked)
      assert.equal(db._state.usersTable[0].authVersion, demoUser.authVersion);
      const activeTokenRow = db._state.tokensTable[1];
      assert.equal(activeTokenRow.revokedAt, null, "Active session token must remain valid during grace period conflict");

      // Normal rotation with the active token succeeds
      if (rotation1 && "token" in rotation1) {
        const nextRotation = await rotateRefreshSession(db as never, rotation1.token);
        assert.equal(nextRotation?.status, "rotated");
      }
    });

    it("invalidates all sessions and increments authVersion when old token is used after 120s grace period expires", async () => {
      const db = createMockAuthDb() as unknown as MockDb;

      const session = await createRefreshSession(db as never, demoUser.id);
      const rotation1 = await rotateRefreshSession(db as never, session.token);
      assert.equal(rotation1?.status, "rotated");

      // Simulate token was revoked 125 seconds ago (> 120s / REFRESH_GRACE_PERIOD_MS)
      const expiredRevocationDate = new Date(Date.now() - (REFRESH_GRACE_PERIOD_MS + 5_000));
      db._state.tokensTable[0].revokedAt = expiredRevocationDate;

      // Replay attack attempt with token past grace period
      const replayResult = await rotateRefreshSession(db as never, session.token);
      assert.equal(replayResult, null, "Replay attack after grace period must return null");

      // Verify all tokens for this user are now revoked
      assert.ok(
        db._state.tokensTable.every((t) => t.revokedAt !== null),
        "All user refresh tokens must be revoked following potential replay breach",
      );

      // Verify user's authVersion was bumped to revoke all active access tokens
      assert.equal(
        db._state.usersTable[0].authVersion,
        demoUser.authVersion + 1,
        "User authVersion must be incremented to immediately invalidate existing JWT access tokens",
      );
    });
  });

  describe("Middleware Routing & Public Paths", () => {
    it("publicAuthPaths includes reading lookup endpoints and core auth endpoints", () => {
      assert.ok(publicAuthPaths instanceof Set, "publicAuthPaths must be a Set");
      assert.ok(
        publicAuthPaths.has("/api/reading/lookup"),
        "publicAuthPaths must include /api/reading/lookup",
      );
      assert.ok(
        publicAuthPaths.has("/api/reading/batch-lookup"),
        "publicAuthPaths must include /api/reading/batch-lookup",
      );
      assert.ok(
        publicAuthPaths.has("/api/auth/login"),
        "publicAuthPaths must include /api/auth/login",
      );
      assert.ok(
        publicAuthPaths.has("/api/auth/register"),
        "publicAuthPaths must include /api/auth/register",
      );
      assert.ok(
        publicAuthPaths.has("/api/auth/refresh"),
        "publicAuthPaths must include /api/auth/refresh",
      );
      assert.ok(
        publicAuthPaths.has("/api/auth/verify-email"),
        "publicAuthPaths must include /api/auth/verify-email",
      );
    });

    it("redirects authenticated users away from /login and /register when vocabloom_refresh cookie exists", async () => {
      const cookieHeader = "vocabloom_refresh=mock_valid_refresh_token_123";

      // 1. Visit /login while logged in -> redirects to /
      const loginReq = new NextRequest("http://localhost:3000/login", {
        headers: { cookie: cookieHeader },
      });
      const loginRes = await middleware(loginReq);
      assert.equal(loginRes.status, 307, "Authenticated visit to /login should redirect");
      assert.equal(loginRes.headers.get("location"), "http://localhost:3000/");

      // 2. Visit /login?next=/study while logged in -> redirects to /study
      const nextStudyReq = new NextRequest("http://localhost:3000/login?next=/study", {
        headers: { cookie: cookieHeader },
      });
      const nextStudyRes = await middleware(nextStudyReq);
      assert.equal(nextStudyRes.status, 307);
      assert.equal(nextStudyRes.headers.get("location"), "http://localhost:3000/study");

      // 3. Visit /login?next=//malicious.site -> open redirect prevented, redirects to /
      const openRedirectReq = new NextRequest("http://localhost:3000/login?next=//malicious.site", {
        headers: { cookie: cookieHeader },
      });
      const openRedirectRes = await middleware(openRedirectReq);
      assert.equal(openRedirectRes.status, 307);
      assert.equal(openRedirectRes.headers.get("location"), "http://localhost:3000/");

      // 4. Visit /register while logged in -> redirects to /
      const registerReq = new NextRequest("http://localhost:3000/register", {
        headers: { cookie: cookieHeader },
      });
      const registerRes = await middleware(registerReq);
      assert.equal(registerRes.status, 307, "Authenticated visit to /register should redirect");
      assert.equal(registerRes.headers.get("location"), "http://localhost:3000/");
    });

    it("allows unauthenticated users to access /login, /register, and public API endpoints", async () => {
      // Unauthenticated visit to /login
      const anonLoginReq = new NextRequest("http://localhost:3000/login");
      const anonLoginRes = await middleware(anonLoginReq);
      assert.equal(anonLoginRes.status, 200, "Unauthenticated access to /login must be allowed");

      // Unauthenticated visit to /register
      const anonRegisterReq = new NextRequest("http://localhost:3000/register");
      const anonRegisterRes = await middleware(anonRegisterReq);
      assert.equal(anonRegisterRes.status, 200, "Unauthenticated access to /register must be allowed");

      // Public API endpoint /api/reading/lookup without auth headers
      const lookupReq = new NextRequest("http://localhost:3000/api/reading/lookup");
      const lookupRes = await middleware(lookupReq);
      assert.equal(lookupRes.status, 200, "Public reading lookup must not be blocked by 401");

      // Public API endpoint /api/reading/batch-lookup without auth headers
      const batchLookupReq = new NextRequest("http://localhost:3000/api/reading/batch-lookup");
      const batchLookupRes = await middleware(batchLookupReq);
      assert.equal(batchLookupRes.status, 200, "Public reading batch-lookup must not be blocked by 401");

      // Protected API endpoint /api/decks without auth headers -> 401
      const protectedApiReq = new NextRequest("http://localhost:3000/api/decks");
      const protectedApiRes = await middleware(protectedApiReq);
      assert.equal(protectedApiRes.status, 401, "Protected API route without token must return 401");

      // Protected page /study without session cookie -> redirects to /login?next=/study
      const protectedPageReq = new NextRequest("http://localhost:3000/study");
      const protectedPageRes = await middleware(protectedPageReq);
      assert.equal(protectedPageRes.status, 307);
      assert.equal(protectedPageRes.headers.get("location"), "http://localhost:3000/login?next=%2Fstudy");
    });
  });
});
