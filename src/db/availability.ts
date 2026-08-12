const DATABASE_COOLDOWN_MS = 15_000;
const connectivityCodes = new Set([
  "ECONNREFUSED",
  "ECONNRESET",
  "ENETUNREACH",
  "ENOTFOUND",
  "ETIMEDOUT",
  "CONNECT_TIMEOUT",
]);

let unavailableUntil = 0;
let outageLogged = false;

function errorDetails(error: unknown) {
  if (!(error instanceof Error)) return { code: "UNKNOWN", message: "Unknown database error" };
  const code = "code" in error && typeof error.code === "string" ? error.code : "UNKNOWN";
  return { code, message: error.message.slice(0, 180) };
}

export function isDatabaseCoolingDown(now = Date.now()) {
  return unavailableUntil > now;
}

export function markDatabaseAvailable() {
  if (outageLogged) console.info("Database connection recovered.");
  unavailableUntil = 0;
  outageLogged = false;
}

export function markDatabaseFailure(error: unknown, now = Date.now()) {
  const { code, message } = errorDetails(error);
  const connectivityFailure =
    connectivityCodes.has(code) ||
    /connect|connection|dns|hostname|network|socket|timeout|timed out/i.test(message);

  if (connectivityFailure) {
    unavailableUntil = now + DATABASE_COOLDOWN_MS;
    if (!outageLogged) {
      console.warn("Database is temporarily unavailable.", { code, message });
      outageLogged = true;
    }
  } else {
    console.error("Database query failed.", { code, message });
  }

  return connectivityFailure;
}

export function resetDatabaseAvailability() {
  unavailableUntil = 0;
  outageLogged = false;
}
