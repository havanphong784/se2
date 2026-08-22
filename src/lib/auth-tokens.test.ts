import assert from "node:assert/strict";
import test from "node:test";

import {
  ACCESS_TOKEN_TTL_SECONDS,
  createAccessToken,
  createRefreshToken,
  hashRefreshToken,
  verifyAccessToken,
} from "./auth-tokens";

process.env.JWT_ACCESS_SECRET = "test-access-secret-at-least-32-characters-long";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret-at-least-32-characters-long";

test("access token contains verified user subject and access type", async () => {
  const token = await createAccessToken("be72a7eb-18d7-4eb8-a644-76eacbcdd6fd", 3);
  assert.deepEqual(await verifyAccessToken(token), {
    sub: "be72a7eb-18d7-4eb8-a644-76eacbcdd6fd",
    jti: (await verifyAccessToken(token))?.jti,
    type: "access",
    authVersion: 3,
  });
});

test("access token rejects tampering", async () => {
  const token = await createAccessToken("be72a7eb-18d7-4eb8-a644-76eacbcdd6fd", 1);
  assert.equal(await verifyAccessToken(`${token}x`), null);
  assert.equal(ACCESS_TOKEN_TTL_SECONDS, 600);
});

test("access token rejects weak secrets", async () => {
  const original = process.env.JWT_ACCESS_SECRET;
  process.env.JWT_ACCESS_SECRET = "short";
  await assert.rejects(() => createAccessToken("be72a7eb-18d7-4eb8-a644-76eacbcdd6fd", 1), /at least 32/);
  process.env.JWT_ACCESS_SECRET = "replace-with-at-least-32-random-bytes";
  await assert.rejects(() => createAccessToken("be72a7eb-18d7-4eb8-a644-76eacbcdd6fd", 1), /non-placeholder/);
  process.env.JWT_ACCESS_SECRET = original;
});

test("refresh tokens are unique and stored only as stable hashes", async () => {
  const first = createRefreshToken();
  const second = createRefreshToken();
  assert.notEqual(first, second);
  assert.equal((await hashRefreshToken(first)).length, 64);
  assert.equal(await hashRefreshToken(first), await hashRefreshToken(first));
});
