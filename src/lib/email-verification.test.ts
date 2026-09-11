import assert from "node:assert/strict";
import test from "node:test";

import { emailVerificationTokens, users } from "@/db/schema";
import {
  consumeVerificationToken,
  createEmailVerificationToken,
  createVerificationToken,
  hashEmailVerificationToken,
  hashOtp,
  hashOtpCode,
} from "./email-verification";

type Db = Parameters<typeof createVerificationToken>[0];

function createMockDb() {
  const usersTable = [
    { id: "user-uuid-1", email: "alice@example.com", emailVerifiedAt: null as Date | null, updatedAt: null as Date | null },
    { id: "user-uuid-2", email: "bob@example.com", emailVerifiedAt: null as Date | null, updatedAt: null as Date | null },
  ];

  type TokenRow = {
    id: string;
    userId: string;
    tokenHash: string;
    otpHash: string | null;
    expiresAt: Date;
    consumedAt: Date | null;
    createdAt: Date;
  };

  const tokensTable: TokenRow[] = [];

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

  const mock = {
    insert: (table: unknown) => ({
      values: async (data: {
        userId: string;
        tokenHash: string;
        otpHash?: string | null;
        expiresAt: Date;
        consumedAt?: Date | null;
      }) => {
        if (table === emailVerificationTokens) {
          const row: TokenRow = {
            id: `token-${tokensTable.length + 1}`,
            userId: data.userId,
            tokenHash: data.tokenHash,
            otpHash: data.otpHash ?? null,
            expiresAt: data.expiresAt,
            consumedAt: data.consumedAt ?? null,
            createdAt: new Date(),
          };
          tokensTable.push(row);
          return [row];
        }
        return [];
      },
    }),
    select: () => ({
      from: (table: unknown) => ({
        where: (condition: unknown) => {
          const params = extractParams(condition);
          let rows: unknown[] = [];
          if (table === emailVerificationTokens) {
            rows = tokensTable.filter((t) => {
              if (params.token_hash && t.tokenHash !== params.token_hash) return false;
              if (params.user_id && t.userId !== params.user_id) return false;
              if (params.otp_hash && t.otpHash !== params.otp_hash) return false;
              return true;
            });
          } else if (table === users) {
            rows = usersTable.filter((u) => {
              if (params.email && u.email !== params.email) return false;
              if (params.id && u.id !== params.id) return false;
              return true;
            });
          }
          const builder = {
            orderBy: () => builder,
            limit: async (n: number) => rows.slice(0, n),
            then: (resolve: (data: unknown[]) => unknown) => Promise.resolve(rows).then(resolve),
          };
          return builder;
        },
      }),
    }),
    update: (table: unknown) => ({
      set: (values: { consumedAt?: Date; emailVerifiedAt?: Date; updatedAt?: Date }) => ({
        where: (condition: unknown) => {
          const params = extractParams(condition);
          if (table === emailVerificationTokens) {
            const row = tokensTable.find((t) => t.id === params.id);
            if (row && row.consumedAt === null) {
              if (values.consumedAt) row.consumedAt = values.consumedAt;
              return {
                returning: async () => [{ id: row.id }],
                then: (resolve: (data: unknown[]) => unknown) => Promise.resolve([{ id: row.id }]).then(resolve),
              };
            }
            return {
              returning: async () => [],
              then: (resolve: (data: unknown[]) => unknown) => Promise.resolve([]).then(resolve),
            };
          }
          if (table === users) {
            const row = usersTable.find((u) => u.id === params.id);
            if (row) {
              if (values.emailVerifiedAt) row.emailVerifiedAt = values.emailVerifiedAt;
              if (values.updatedAt) row.updatedAt = values.updatedAt;
            }
            return {
              returning: async () => [],
              then: (resolve: (data: unknown[]) => unknown) => Promise.resolve([]).then(resolve),
            };
          }
          return {
            returning: async () => [],
            then: (resolve: (data: unknown[]) => unknown) => Promise.resolve([]).then(resolve),
          };
        },
      }),
    }),
    delete: () => ({
      where: async () => [],
    }),
    transaction: async <T>(cb: (tx: Db) => Promise<T>): Promise<T> => cb(mock as unknown as Db),
    _state: { usersTable, tokensTable },
  };

  return mock as unknown as Db & {
    _state: {
      usersTable: typeof usersTable;
      tokensTable: TokenRow[];
    };
  };
}

test("createEmailVerificationToken generates 64-char hex token, 6-digit numeric OTP, and valid hashes", () => {
  const userId = "user-test-123";
  const { token, tokenHash, otpCode, otpHash } = createEmailVerificationToken(userId);

  assert.match(token, /^[a-f0-9]{64}$/);
  assert.equal(tokenHash, hashEmailVerificationToken(token));
  assert.equal(tokenHash.length, 64);

  assert.match(otpCode, /^\d{6}$/);
  const otpNumber = Number.parseInt(otpCode, 10);
  assert.ok(otpNumber >= 100000 && otpNumber <= 999999);

  assert.ok(otpHash);
  assert.equal(otpHash, hashOtp(userId, otpCode));
  assert.equal(otpHash, hashOtpCode(userId, otpCode));
});

test("createEmailVerificationToken produces unique tokens and OTP codes on each generation", () => {
  const first = createEmailVerificationToken();
  const second = createEmailVerificationToken();

  assert.notEqual(first.token, second.token);
  assert.notEqual(first.tokenHash, second.tokenHash);
});

test("hashOtp produces unique hashes across users and codes and handles whitespace", () => {
  const userA = "user-a";
  const userB = "user-b";
  const code = "123456";
  const diffCode = "654321";

  const hashA = hashOtp(userA, code);
  const hashB = hashOtp(userB, code);
  const hashADiff = hashOtp(userA, diffCode);

  assert.notEqual(hashA, hashB, "Different users with the same code must produce distinct hashes");
  assert.notEqual(hashA, hashADiff, "Same user with different codes must produce distinct hashes");
  assert.equal(hashA, hashOtp(userA, "  123456  "), "Whitespace around OTP code must be trimmed");
});

test("createVerificationToken persists tokenHash, otpHash and 24h expiration in database", async () => {
  const db = createMockDb();
  const userId = "user-uuid-1";

  const { token, otpCode } = await createVerificationToken(db, userId);

  assert.match(token, /^[a-f0-9]{64}$/);
  assert.match(otpCode, /^\d{6}$/);

  assert.equal(db._state.tokensTable.length, 1);
  const stored = db._state.tokensTable[0];
  assert.equal(stored.userId, userId);
  assert.equal(stored.tokenHash, hashEmailVerificationToken(token));
  assert.equal(stored.otpHash, hashOtp(userId, otpCode));
  assert.equal(stored.consumedAt, null);

  const ttl = stored.expiresAt.getTime() - Date.now();
  assert.ok(ttl > 23 * 60 * 60 * 1000 && ttl <= 24 * 60 * 60 * 1000);
});

test("consumeVerificationToken validates successfully via magic link token string or object", async () => {
  const db = createMockDb();
  const { token } = await createVerificationToken(db, "user-uuid-1");

  assert.equal(db._state.usersTable[0].emailVerifiedAt, null);

  const success = await consumeVerificationToken(db, token);
  assert.equal(success, true);
  assert.ok(db._state.usersTable[0].emailVerifiedAt != null);

  // Grace period within 60s should return true
  const duplicateCall = await consumeVerificationToken(db, { token });
  assert.equal(duplicateCall, true);
});

test("consumeVerificationToken validates successfully via email and 6-digit OTP code", async () => {
  const db = createMockDb();
  const { otpCode } = await createVerificationToken(db, "user-uuid-2");

  assert.equal(db._state.usersTable[1].emailVerifiedAt, null);

  const success = await consumeVerificationToken(db, {
    email: "bob@example.com",
    code: otpCode,
  });
  assert.equal(success, true);
  assert.ok(db._state.usersTable[1].emailVerifiedAt != null);

  // Grace period within 60s should return true
  const duplicateCall = await consumeVerificationToken(db, {
    email: "bob@example.com",
    code: otpCode,
  });
  assert.equal(duplicateCall, true);
});

test("consumeVerificationToken rejects wrong OTP code, non-existent email, and malformed inputs", async () => {
  const db = createMockDb();
  await createVerificationToken(db, "user-uuid-1");

  // Wrong OTP code
  const wrongCode = await consumeVerificationToken(db, {
    email: "alice@example.com",
    code: "000000",
  });
  assert.equal(wrongCode, false);

  // Non-existent email
  const unknownEmail = await consumeVerificationToken(db, {
    email: "unknown@example.com",
    code: "123456",
  });
  assert.equal(unknownEmail, false);

  // Malformed OTP code
  const shortCode = await consumeVerificationToken(db, {
    email: "alice@example.com",
    code: "123",
  });
  assert.equal(shortCode, false);

  // Malformed token
  const invalidToken = await consumeVerificationToken(db, "not-a-valid-hex-token");
  assert.equal(invalidToken, false);
});

test("consumeVerificationToken rejects expired tokens and expired OTP codes", async () => {
  const db = createMockDb();
  const { token, otpCode } = await createVerificationToken(db, "user-uuid-1");

  // Expire the token
  db._state.tokensTable[0].expiresAt = new Date(Date.now() - 10_000);

  const tokenExpired = await consumeVerificationToken(db, token);
  assert.equal(tokenExpired, false);

  const otpExpired = await consumeVerificationToken(db, {
    email: "alice@example.com",
    code: otpCode,
  });
  assert.equal(otpExpired, false);
});

test("consumeVerificationToken grace period succeeds within 60s and rejects after 60s", async () => {
  const db = createMockDb();
  const { token, otpCode } = await createVerificationToken(db, "user-uuid-1");

  // First consumption
  const firstConsume = await consumeVerificationToken(db, token);
  assert.equal(firstConsume, true);

  // Within 60 seconds
  const withinGrace = await consumeVerificationToken(db, {
    email: "alice@example.com",
    code: otpCode,
  });
  assert.equal(withinGrace, true);

  // Advance consumedAt past 60s grace period (e.g. 70 seconds ago)
  db._state.tokensTable[0].consumedAt = new Date(Date.now() - 70_000);

  const afterGraceToken = await consumeVerificationToken(db, token);
  assert.equal(afterGraceToken, false);

  const afterGraceOtp = await consumeVerificationToken(db, {
    email: "alice@example.com",
    code: otpCode,
  });
  assert.equal(afterGraceOtp, false);
});
