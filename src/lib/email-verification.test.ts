import assert from "node:assert/strict";
import test from "node:test";

import { createEmailVerificationToken, hashEmailVerificationToken } from "./email-verification";

test("email verification token is cryptographically-shaped and hashes consistently", () => {
  const { token, tokenHash } = createEmailVerificationToken();
  assert.match(token, /^[a-f0-9]{64}$/);
  assert.equal(tokenHash, hashEmailVerificationToken(token));
  assert.equal(tokenHash.length, 64);
});

test("email verification token differs on each generation", () => {
  const first = createEmailVerificationToken();
  const second = createEmailVerificationToken();
  assert.notEqual(first.token, second.token);
  assert.notEqual(first.tokenHash, second.tokenHash);
});
