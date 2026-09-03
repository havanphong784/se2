function normalizeOrigin(value: string | null | undefined) {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

/**
 * APP_URL is the public origin and is required in deployments behind a proxy.
 * Falling back to the request URL keeps local development working without
 * trusting client-controlled forwarding headers.
 */
export function expectedRequestOrigin(request: Request) {
  return normalizeOrigin(process.env.APP_URL) ?? normalizeOrigin(request.url);
}

export function isSameOrigin(request: Request) {
  const origin = normalizeOrigin(request.headers.get("origin"));
  if (!origin) return true;
  return origin === expectedRequestOrigin(request);
}
