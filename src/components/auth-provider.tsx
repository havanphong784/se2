"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

export type AuthUser = { id: string; email: string; displayName: string };
type AuthResponse = { accessToken: string; user: AuthUser };
type AuthContextValue = {
  user: AuthUser | null;
  ready: boolean;
  setSession: (session: AuthResponse) => void;
  clearSession: () => void;
  authFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
};

const AuthContext = createContext<AuthContextValue | null>(null);
let accessToken: string | null = null;
let refreshPromise: Promise<AuthResponse | null> | null = null;

async function refreshSession() {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      let response = await fetch("/api/auth/refresh", { method: "POST", credentials: "same-origin" });
      if (response.status === 409) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        response = await fetch("/api/auth/refresh", { method: "POST", credentials: "same-origin" });
      }
      return response.ok ? (response.json() as Promise<AuthResponse>) : null;
    })().catch(() => null).finally(() => { refreshPromise = null; });
  }
  return refreshPromise;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const isPublicPage = pathname === "/login" || pathname === "/register" || pathname === "/verify-email";
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(isPublicPage);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearSession = useCallback(() => {
    accessToken = null;
    setUser(null);
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
  }, []);

  const setSession = useCallback((session: AuthResponse) => {
    accessToken = session.accessToken;
    setUser(session.user);
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(async function refresh() {
      const next = await refreshSession();
      if (!next) return clearSession();
      accessToken = next.accessToken;
      setUser(next.user);
      refreshTimer.current = setTimeout(refresh, 9 * 60 * 1000);
    }, 9 * 60 * 1000);
  }, [clearSession]);

  useEffect(() => {
    if (isPublicPage) return;
    if (accessToken) return;
    void refreshSession().then((session) => {
      if (session) setSession(session);
      else router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      setReady(true);
    });
  }, [isPublicPage, pathname, router, setSession]);

  useEffect(() => () => { if (refreshTimer.current) clearTimeout(refreshTimer.current); }, []);

  const authFetch = useCallback(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const send = () => {
      const headers = new Headers(init.headers);
      if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
      return fetch(input, { ...init, headers, credentials: "same-origin" });
    };
    let response = await send();
    if (response.status !== 401) return response;
    const session = await refreshSession();
    if (!session) {
      clearSession();
      if (!isPublicPage) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      return response;
    }
    setSession(session);
    response = await send();
    return response;
  }, [clearSession, isPublicPage, pathname, router, setSession]);

  const value = useMemo(() => ({ user, ready, setSession, clearSession, authFetch }), [authFetch, clearSession, ready, setSession, user]);
  const showChildren = isPublicPage || (ready && user);
  return <AuthContext.Provider value={value}>{showChildren ? children : null}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider.");
  return context;
}
