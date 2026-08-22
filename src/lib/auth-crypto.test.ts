import assert from "node:assert/strict";
import { pbkdf2Sync } from "node:crypto";
import test from "node:test";

import { hashPassword, needsPasswordRehash, verifyPassword } from "./auth-crypto";

test("password hashes verify and reject wrong passwords", async () => {
  const stored = await hashPassword("correct horse battery staple");
  assert.equal(await verifyPassword("correct horse battery staple", stored), true);
  assert.equal(await verifyPassword("wrong", stored), false);
  assert.equal(needsPasswordRehash(stored), false);
});

test("legacy password hashes remain valid and require rehash", async () => {
  const salt = "0123456789abcdef0123456789abcdef";
  const legacy = `${salt}:${pbkdf2Sync("legacy-password", salt, 1_000, 64, "sha512").toString("hex")}`;
  assert.equal(await verifyPassword("legacy-password", legacy), true);
  assert.equal(needsPasswordRehash(legacy), true);
});

test("malformed password hashes fail closed", async () => {
  assert.equal(await verifyPassword("password", "broken"), false);
  assert.equal(await verifyPassword("password", "pbkdf2-sha512:nope:salt:hash"), false);
  assert.equal(await verifyPassword("password", null), false);
});
