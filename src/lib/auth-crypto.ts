import { pbkdf2, randomBytes, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const deriveKey = promisify(pbkdf2);
const LEGACY_ITERATIONS = 1_000;
const ITERATIONS = 600_000;
const KEY_LENGTH = 64;
const DIGEST = "sha512";
const PREFIX = "pbkdf2-sha512";
const DUMMY_HASH = `${PREFIX}:${ITERATIONS}:${"0".repeat(32)}:${"0".repeat(KEY_LENGTH * 2)}`;

async function hash(password: string, salt: string, iterations: number) {
  return deriveKey(password, salt, iterations, KEY_LENGTH, DIGEST);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = await hash(password, salt, ITERATIONS);
  return `${PREFIX}:${ITERATIONS}:${salt}:${derived.toString("hex")}`;
}

export function needsPasswordRehash(storedHash: string | null | undefined) {
  return Boolean(storedHash && !storedHash.startsWith(`${PREFIX}:${ITERATIONS}:`));
}

export async function verifyPassword(password: string, storedHash: string | null | undefined): Promise<boolean> {
  const candidate = storedHash ?? DUMMY_HASH;
  const parts = candidate.split(":");
  const versioned = parts.length === 4 && parts[0] === PREFIX;
  const iterations = versioned ? Number(parts[1]) : LEGACY_ITERATIONS;
  const salt = versioned ? parts[2] : parts[0];
  const originalHex = versioned ? parts[3] : parts[1];
  if (!salt || !originalHex || !Number.isSafeInteger(iterations) || iterations <= 0 || !/^[a-f0-9]+$/i.test(originalHex)) {
    return false;
  }

  const original = Buffer.from(originalHex, "hex");
  if (original.length !== KEY_LENGTH) return false;
  const derived = await hash(password, salt, iterations);
  return Boolean(storedHash) && timingSafeEqual(derived, original);
}
