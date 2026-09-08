function normalizeOrigin(value: string | null | undefined) {
  if (!value || value === "null") return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

/**
 * APP_URL is the public origin and is required in deployments behind a proxy.
 * Falling back to forwarded headers or request URL keeps local development working without
 * trusting arbitrary client-controlled forwarding headers blindly.
 */
export function expectedRequestOrigin(request: Request) {
  const configured = normalizeOrigin(process.env.APP_URL);
  if (configured) return configured;

  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  if (forwardedProto && forwardedHost) {
    const forwardedOrigin = normalizeOrigin(`${forwardedProto}://${forwardedHost}`);
    if (forwardedOrigin) return forwardedOrigin;
  }

  return normalizeOrigin(request.url);
}

export function isSameOrigin(request: Request) {
  const rawOrigin = request.headers.get("origin");
  if (!rawOrigin) return true;
  if (rawOrigin === "null") return false;

  const origin = normalizeOrigin(rawOrigin);
  if (!origin) return false;
  return origin === expectedRequestOrigin(request);
}
