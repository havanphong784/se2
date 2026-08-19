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
  const token = await createAccessToken("be72a7eb-18d7-4eb8-a644-76eacbcdd6fd");
  assert.deepEqual(await verifyAccessToken(token), {
    sub: "be72a7eb-18d7-4eb8-a644-76eacbcdd6fd",
    jti: (await verifyAccessToken(token))?.jti,
    type: "access",
  });
});

test("access token rejects tampering", async () => {
  const token = await createAccessToken("be72a7eb-18d7-4eb8-a644-76eacbcdd6fd");
  assert.equal(await verifyAccessToken(`${token}x`), null);
  assert.equal(ACCESS_TOKEN_TTL_SECONDS, 600);
});

test("refresh tokens are unique and stored only as stable hashes", async () => {
  const first = createRefreshToken();
  const second = createRefreshToken();
  assert.notEqual(first, second);
  assert.equal((await hashRefreshToken(first)).length, 64);
  assert.equal(await hashRefreshToken(first), await hashRefreshToken(first));
});
