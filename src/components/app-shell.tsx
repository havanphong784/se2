"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  BookOpenText,
  ClipboardCheck,
  Flame,
  Headphones,
  Home,
  Mic2,
  Puzzle,
  Settings,
} from "lucide-react";

import { BrandName } from "@/components/brand-mark";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth-provider";

const navigation = [
  { href: "/", label: "Tổng quan", icon: Home },
  { href: "/vocabulary", label: "Học từ vựng", icon: BookOpenText },
  { href: "/grammar", label: "Ngữ pháp", icon: Puzzle },
  { href: "/listening", label: "Luyện nghe", icon: Headphones },
  { href: "/speaking", label: "Luyện nói", icon: Mic2 },
  { href: "/exams", label: "Luyện đề", icon: ClipboardCheck },
] as const;

const mobileNavigation = navigation.filter((item) => item.href !== "/grammar");

function isCurrent(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function AppShell({
  children,
  streakDays: initialStreakDays,
}: {
  children: React.ReactNode;
  streakDays?: number;
}) {
  const pathname = usePathname();
  const inPractice = pathname.startsWith("/vocabulary/practice");
  const { user, authFetch } = useAuth();
  const [streakDays, setStreakDays] = useState<number>(initialStreakDays ?? 0);

  useEffect(() => {
    if (!user) return;
    authFetch("/api/streak")
      .then((res) => res.json())
      .then((data) => {
        if (data.streak && typeof data.streak.current === "number") {
          setStreakDays(data.streak.current);
        }
      })
      .catch(() => {});
  }, [authFetch, pathname, user]);

  return (
    <div className="min-h-svh bg-white">
      <a
        href="#main-content"
        className="fixed left-4 top-3 z-[100] -translate-y-20 rounded-xl bg-midnight px-4 py-3 font-extrabold text-white focus:translate-y-0"
      >
        Bỏ qua đến nội dung chính
      </a>

      {!inPractice && (
        <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r-2 border-[#ededed] bg-white lg:flex lg:flex-col">
          <div className="flex h-20 items-center px-7">
            <Link href="/" aria-label="VocaBloom - Trang tổng quan">
              <BrandName />
            </Link>
          </div>

          <nav aria-label="Điều hướng chính" className="flex-1 space-y-1.5 px-4 py-4">
            {navigation.map((item) => {
              const active = isCurrent(pathname, item.href);
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-12 items-center gap-3 rounded-xl border-2 px-4 text-[14px] font-extrabold tracking-[0.04em] transition-[background-color,border-color,color,transform] duration-150 focus-visible:ring-4 focus-visible:ring-lingot-lime/40 active:translate-y-0.5",
                    active
                      ? "border-eel-light bg-[#f7fff1] text-[#438f0e]"
                      : "border-transparent text-ash hover:bg-[#f7f7f7] hover:text-charcoal",
                  )}
                >
                  <Icon className={cn("size-5", active && "text-ecto-green")} />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="m-4 space-y-3 border-t-2 border-[#ededed] pt-4">
            <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl border-2 border-[#ffe48a] bg-[#fffaf0] text-lg">
                  🌱
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-extrabold text-charcoal">
                    {user?.displayName ?? "Tài khoản"}
                  </p>
                  <p className="text-xs font-bold text-ash">
                    Tài khoản cá nhân
                  </p>
                </div>
              </div>
              <Link
                href="/settings"
                aria-label="Cài đặt"
                className="grid size-10 shrink-0 place-items-center rounded-xl text-ash hover:bg-[#f7f7f7] focus-visible:ring-4 focus-visible:ring-lingot-lime/40"
              >
                <Settings className="size-5" />
              </Link>
            </div>
            <Badge variant="warning" className="w-full justify-center py-2">
              <Flame className="size-4 fill-current" /> {streakDays} ngày liên tiếp
            </Badge>
          </div>
        </aside>
      )}

      {!inPractice && (
        <header className="fixed inset-x-0 top-0 z-40 flex h-16 items-center justify-between border-b-2 border-[#ededed] bg-white px-3 sm:px-4 lg:hidden">
          <Link href="/" aria-label="VocaBloom - Trang tổng quan">
            <BrandName compact />
          </Link>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <Badge variant="warning" className="h-9 px-2.5 text-xs font-extrabold">
              <Flame className="size-4 fill-current" /> {streakDays}
            </Badge>
            <Link
              href="/settings"
              aria-label="Cài đặt tài khoản"
              className="flex h-9 items-center gap-1.5 rounded-xl border-2 border-b-4 border-eel-light border-b-[#c4f0a0] bg-[#f7fff1] px-2.5 text-xs font-extrabold text-charcoal transition-transform active:translate-y-0.5"
            >
              <span>🌱</span>
              <span className="max-w-[90px] truncate text-eel-dark-blue sm:max-w-[140px]">
                {user?.displayName ?? "Tài khoản"}
              </span>
              <Settings className="size-3.5 text-ash" />
            </Link>
          </div>
        </header>
      )}

      <motion.main
        id="main-content"
        key={pathname}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
        className={cn(
          "min-h-svh",
          !inPractice && "pb-24 pt-16 lg:pb-0 lg:pl-64 lg:pt-0",
        )}
      >
        {children}
      </motion.main>

      {!inPractice && (
        <nav
          aria-label="Điều hướng di động"
          className="fixed inset-x-0 bottom-0 z-40 grid h-[76px] grid-cols-5 border-t-2 border-[#ededed] bg-white px-1 pb-[env(safe-area-inset-bottom)] lg:hidden"
        >
          {mobileNavigation.map((item) => {
            const active = isCurrent(pathname, item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-extrabold tracking-normal focus-visible:ring-4 focus-visible:ring-lingot-lime/40",
                  active ? "text-[#438f0e]" : "text-ash",
                )}
              >
                <Icon className={cn("size-5", active && "text-ecto-green")} />
                <span className="max-w-full truncate">{item.label.replace("Luyện ", "")}</span>
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}
