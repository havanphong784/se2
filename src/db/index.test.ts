import assert from "node:assert/strict";
import test from "node:test";

const availabilityModule = "./availability.ts";
const {
  isDatabaseCoolingDown,
  markDatabaseAvailable,
  markDatabaseFailure,
  resetDatabaseAvailability,
} = (await import(availabilityModule)) as typeof import("./availability");

test.afterEach(() => resetDatabaseAvailability());

test("database connectivity failures open and reset the cooldown", () => {
  const error = Object.assign(new Error("getaddrinfo ENOTFOUND database.invalid"), {
    code: "ENOTFOUND",
  });

  assert.equal(markDatabaseFailure(error, 1_000), true);
  assert.equal(isDatabaseCoolingDown(1_001), true);
  assert.equal(isDatabaseCoolingDown(16_001), false);

  markDatabaseAvailable();
  assert.equal(isDatabaseCoolingDown(1_001), false);
});

test("query errors do not open the connectivity cooldown", () => {
  const error = Object.assign(new Error("column does not exist"), { code: "42703" });

  assert.equal(markDatabaseFailure(error, 1_000), false);
  assert.equal(isDatabaseCoolingDown(1_001), false);
});
