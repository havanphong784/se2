"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type AuthUser = { id: string; email: string; displayName: string };
type AuthResponse = { accessToken: string; user: AuthUser };
type RefreshOutcome =
  | { kind: "success"; session: AuthResponse }
  | { kind: "unauthorized"; status: 401 }
  | { kind: "transient"; status: number | null };
type AuthContextValue = {
  user: AuthUser | null;
  ready: boolean;
  setSession: (session: AuthResponse) => void;
  clearSession: () => void;
  authFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
};

type LockManagerLike = {
  request<T>(name: string, callback: () => Promise<T>): Promise<T>;
};
type NavigatorWithLocks = Navigator & { locks?: LockManagerLike };

const AuthContext = createContext<AuthContextValue | null>(null);
let refreshPromise: Promise<RefreshOutcome> | null = null;

const ACCESS_REFRESH_INTERVAL = 9 * 60 * 1000;
const REFRESH_RETRY_DELAY = 30 * 1000;
const FOREGROUND_REFRESH_AFTER = 8 * 60 * 1000;
const REFRESH_RETRY_DELAYS = [100, 250, 500, 1_000, 1_500];

function isAuthResponse(value: unknown): value is AuthResponse {
  if (!value || typeof value !== "object") return false;
  const response = value as Record<string, unknown>;
  const user = response.user;
  if (!response.accessToken || typeof response.accessToken !== "string" || !user || typeof user !== "object") return false;
  const candidate = user as Record<string, unknown>;
  return typeof candidate.id === "string"
    && typeof candidate.email === "string"
    && typeof candidate.displayName === "string";
}

async function requestRefresh(): Promise<RefreshOutcome> {
  try {
    let response = await fetch("/api/auth/refresh", { method: "POST", credentials: "same-origin" });
    for (const delay of REFRESH_RETRY_DELAYS) {
      if (response.status !== 409) break;
      await new Promise((resolve) => setTimeout(resolve, delay));
      response = await fetch("/api/auth/refresh", { method: "POST", credentials: "same-origin" });
    }

    if (response.status === 401) return { kind: "unauthorized", status: 401 };
    if (!response.ok) return { kind: "transient", status: response.status };

    const value: unknown = await response.json().catch(() => null);
    return isAuthResponse(value)
      ? { kind: "success", session: value }
      : { kind: "transient", status: response.status };
  } catch {
    return { kind: "transient", status: null };
  }
}

async function refreshSession(): Promise<RefreshOutcome> {
  if (!refreshPromise) {
    refreshPromise = (async (): Promise<RefreshOutcome> => {
      try {
        const locks = typeof navigator !== "undefined" ? (navigator as NavigatorWithLocks).locks : undefined;
        return locks
          ? await locks.request("vocabloom-auth-refresh", requestRefresh)
          : await requestRefresh();
      } catch {
        return { kind: "transient" as const, status: null };
      }
    })().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise!;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const isPublicPage = pathname === "/login" || pathname === "/register" || pathname === "/verify-email";
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(isPublicPage);
  const [hasTransientError, setHasTransientError] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const accessTokenRef = useRef<string | null>(null);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const generationRef = useRef(0);
  const lastRefreshAtRef = useRef(0);

  const clearSession = useCallback(() => {
    generationRef.current += 1;
    accessTokenRef.current = null;
    lastRefreshAtRef.current = 0;
    setUser(null);
    setHasTransientError(false);
    if (refreshTimer.current) {
      clearTimeout(refreshTimer.current);
      refreshTimer.current = null;
    }
    queryClient.clear();
  }, [queryClient]);

  const redirectToLogin = useCallback(() => {
    if (!isPublicPage && typeof window !== "undefined") {
      const currentTarget = `${window.location.pathname}${window.location.search}`;
      router.replace(`/login?next=${encodeURIComponent(currentTarget)}`);
    }
  }, [isPublicPage, router]);

  const expireSession = useCallback(
    (generation: number) => {
      if (generation !== generationRef.current) return;
      clearSession();
      redirectToLogin();
    },
    [clearSession, redirectToLogin],
  );

  const applySessionRef = useRef<(session: AuthResponse, generation: number) => boolean>(() => false);
  const scheduleRefreshRef = useRef<(generation: number, delay?: number) => void>(() => {});

  const scheduleRefresh = useCallback((generation: number, delay = ACCESS_REFRESH_INTERVAL) => {
    scheduleRefreshRef.current(generation, delay);
  }, []);

  const applySession = useCallback((session: AuthResponse, generation: number) => {
    return applySessionRef.current(session, generation);
  }, []);

  useEffect(() => {
    scheduleRefreshRef.current = (generation: number, delay = ACCESS_REFRESH_INTERVAL) => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      refreshTimer.current = setTimeout(async () => {
        if (generation !== generationRef.current) return;
        const outcome = await refreshSession();
        if (generation !== generationRef.current) return;
        if (outcome.kind === "success") {
          applySession(outcome.session, generation);
          setHasTransientError(false);
        } else if (outcome.kind === "unauthorized") {
          expireSession(generation);
        } else {
          setHasTransientError(true);
          scheduleRefresh(generation, REFRESH_RETRY_DELAY);
        }
      }, delay);
    };

    applySessionRef.current = (session: AuthResponse, generation: number) => {
      if (generation !== generationRef.current) return false;
      accessTokenRef.current = session.accessToken;
      lastRefreshAtRef.current = Date.now();
      setUser(session.user);
      setHasTransientError(false);
      scheduleRefresh(generation);
      return true;
    };
  });

  const setSession = useCallback(
    (session: AuthResponse) => {
      const generation = generationRef.current + 1;
      generationRef.current = generation;
      applySession(session, generation);
    },
    [applySession],
  );

  const retryRefresh = useCallback(async () => {
    setIsRetrying(true);
    const generation = generationRef.current;
    const outcome = await refreshSession();
    if (generation !== generationRef.current) {
      setIsRetrying(false);
      return;
    }
    if (outcome.kind === "success") {
      applySession(outcome.session, generation);
      setHasTransientError(false);
    } else if (outcome.kind === "unauthorized") {
      redirectToLogin();
    } else {
      setHasTransientError(true);
      scheduleRefresh(generation, REFRESH_RETRY_DELAY);
    }
    setIsRetrying(false);
    setReady(true);
  }, [applySession, redirectToLogin, scheduleRefresh]);

  useEffect(() => {
    if (isPublicPage) return;
    const generation = generationRef.current;
    if (accessTokenRef.current) return;
    void refreshSession().then((outcome) => {
      if (generation !== generationRef.current) return;
      if (outcome.kind === "success") {
        applySession(outcome.session, generation);
        setHasTransientError(false);
      } else if (outcome.kind === "unauthorized") {
        redirectToLogin();
      } else {
        setHasTransientError(true);
        scheduleRefresh(generation, REFRESH_RETRY_DELAY);
      }
      setReady(true);
    });
  }, [applySession, isPublicPage, pathname, redirectToLogin, scheduleRefresh]);

  useEffect(() => {
    function refreshOnForeground() {
      if (document.visibilityState !== "visible" || !user) return;
      if (Date.now() - lastRefreshAtRef.current < FOREGROUND_REFRESH_AFTER) return;
      const generation = generationRef.current;
      void refreshSession().then((outcome) => {
        if (generation !== generationRef.current) return;
        if (outcome.kind === "success") {
          applySession(outcome.session, generation);
          setHasTransientError(false);
        } else if (outcome.kind === "unauthorized") {
          expireSession(generation);
        } else {
          setHasTransientError(true);
          scheduleRefresh(generation, REFRESH_RETRY_DELAY);
        }
      });
    }

    document.addEventListener("visibilitychange", refreshOnForeground);
    return () => document.removeEventListener("visibilitychange", refreshOnForeground);
  }, [applySession, expireSession, scheduleRefresh, user]);

  useEffect(() => () => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
  }, []);

  const authFetch = useCallback(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const requestGeneration = generationRef.current;
    const request = input instanceof Request ? input : null;
    const send = () => {
      const headers = new Headers(request?.headers);
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
      if (accessTokenRef.current) headers.set("Authorization", `Bearer ${accessTokenRef.current}`);
      return fetch(request ? request.clone() : input, { ...init, headers, credentials: "same-origin" });
    };

    let response = await send();
    if (response.status !== 401) return response;

    const outcome = await refreshSession();
    if (outcome.kind !== "success") {
      if (outcome.kind === "unauthorized" && requestGeneration === generationRef.current) {
        expireSession(requestGeneration);
      }
      return response;
    }
    if (requestGeneration !== generationRef.current) return response;

    applySession(outcome.session, requestGeneration);
    try {
      response = await send();
    } catch {
      return response;
    }
    return response;
  }, [applySession, expireSession]);

  const value = useMemo(
    () => ({ user, ready, setSession, clearSession, authFetch }),
    [authFetch, clearSession, ready, setSession, user],
  );

  let content: React.ReactNode = null;

  if (isPublicPage || (ready && user)) {
    content = children;
  } else if (hasTransientError) {
    content = (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f7f7] p-6 text-charcoal">
        <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-xl border-2 border-[#ededed] bg-white p-6 text-center">
          <div className="grid size-12 place-items-center rounded-xl bg-amber-50 text-amber-600">
            <RefreshCw className={cn("size-6", isRetrying && "animate-spin")} />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-extrabold text-charcoal">Đang kết nối lại phiên học...</h3>
            <p className="text-xs font-bold text-ash">
              Không thể kết nối với máy chủ. Hệ thống sẽ tự động thử lại sau ít phút hoặc bạn có thể thử lại ngay.
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 pt-2">
            <Button
              onClick={() => void retryRefresh()}
              disabled={isRetrying}
              className="w-full justify-center"
            >
              {isRetrying ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Đang kết nối...
                </>
              ) : (
                "Thử lại ngay"
              )}
            </Button>
            <Button
              variant="secondary"
              onClick={redirectToLogin}
              className="w-full justify-center"
            >
              Về trang đăng nhập
            </Button>
          </div>
        </div>
      </div>
    );
  } else {
    content = (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f7f7] p-6 text-charcoal">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="size-8 animate-spin text-ecto-green" />
          <p className="text-sm font-extrabold text-ash">Đang kiểm tra phiên đăng nhập...</p>
        </div>
      </div>
    );
  }

  return <AuthContext.Provider value={value}>{content}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider.");
  return context;
}
