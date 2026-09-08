import assert from "node:assert/strict";
import test from "node:test";

import { expectedRequestOrigin, isSameOrigin } from "./auth-origin";

function fakeRequest(url: string, origin?: string): Request {
  const headers = new Headers();
  if (origin) headers.set("origin", origin);
  return new Request(url, { headers });
}

test("allows requests without Origin header", () => {
  assert.equal(isSameOrigin(fakeRequest("http://localhost:3000/api/auth/refresh")), true);
});

test("allows same-origin requests", () => {
  assert.equal(isSameOrigin(fakeRequest("http://localhost:3000/api/auth/refresh", "http://localhost:3000")), true);
});

test("rejects cross-origin requests", () => {
  assert.equal(isSameOrigin(fakeRequest("http://localhost:3000/api/auth/refresh", "https://evil.com")), false);
});

test("rejects opaque null origin requests", () => {
  assert.equal(isSameOrigin(fakeRequest("http://localhost:3000/api/auth/refresh", "null")), false);
});

test("uses APP_URL when set for origin comparison", () => {
  const original = process.env.APP_URL;
  process.env.APP_URL = "https://vocabloom.example.com";
  try {
    // Origin matches APP_URL even though request URL differs (proxy scenario)
    assert.equal(
      isSameOrigin(fakeRequest("http://internal:3000/api/auth/refresh", "https://vocabloom.example.com")),
      true,
    );
    // Origin does not match APP_URL
    assert.equal(
      isSameOrigin(fakeRequest("http://internal:3000/api/auth/refresh", "https://evil.com")),
      false,
    );
  } finally {
    process.env.APP_URL = original;
  }
});

test("expectedRequestOrigin falls back to request URL when APP_URL is unset", () => {
  const original = process.env.APP_URL;
  delete process.env.APP_URL;
  try {
    assert.equal(
      expectedRequestOrigin(fakeRequest("http://localhost:3000/api/auth/refresh")),
      "http://localhost:3000",
    );
  } finally {
    process.env.APP_URL = original;
  }
});

test("normalizes origin with trailing path or port", () => {
  const original = process.env.APP_URL;
  process.env.APP_URL = "https://vocabloom.example.com:443/some/path";
  try {
    assert.equal(
      isSameOrigin(fakeRequest("http://internal:3000/api/auth/refresh", "https://vocabloom.example.com")),
      true,
    );
  } finally {
    process.env.APP_URL = original;
  }
});
