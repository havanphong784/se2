import { NextResponse, type NextRequest } from "next/server";

import { verifyAccessToken } from "@/lib/auth-tokens";

export const publicAuthPaths = new Set([
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/refresh",
  "/api/auth/logout",
  "/api/auth/verify-email",
  "/api/auth/verify-email/resend",
  "/api/reading/lookup",
  "/api/reading/batch-lookup",
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

  if (publicPages.has(pathname)) {
    if (request.cookies.has("vocabloom_refresh") && (pathname === "/login" || pathname === "/register")) {
      const nextParam = request.nextUrl.searchParams.get("next");
      const target = nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/";
      return NextResponse.redirect(new URL(target, request.url));
    }
    return NextResponse.next();
  }
  if (request.cookies.has("vocabloom_refresh")) return NextResponse.next();

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|templates/|media/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|csv|json|txt)$).*)"],
};
