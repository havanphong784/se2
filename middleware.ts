import { NextResponse, type NextRequest } from "next/server";

import { verifyAccessToken } from "@/lib/auth-tokens";

const publicAuthPaths = new Set([
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/refresh",
  "/api/auth/logout",
  "/api/auth/verify-email",
  "/api/auth/verify-email/resend",
]);
const publicPages = new Set(["/login", "/register", "/verify-email"]);

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api/")) {
    if (publicAuthPaths.has(pathname)) return NextResponse.next();

    const authorization = request.headers.get("authorization");
    const claims = authorization?.startsWith("Bearer ")
      ? await verifyAccessToken(authorization.slice("Bearer ".length))
      : null;
    if (!claims) return NextResponse.json({ error: "Chưa xác thực." }, { status: 401 });

    const headers = new Headers(request.headers);
    headers.set("x-vocabloom-auth-user-id", claims.sub);
    return NextResponse.next({ request: { headers } });
  }

  if (publicPages.has(pathname)) return NextResponse.next();
  if (request.cookies.has("vocabloom_refresh")) return NextResponse.next();

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
