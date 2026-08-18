import Link from "next/link";
import { LogIn, Settings, UserCheck } from "lucide-react";

export const dynamic = "force-dynamic";

import { getDb } from "@/db";
import { getCurrentAuthUser } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { LogoutButton } from "@/components/logout-button";

export default async function SettingsPage() {
  const db = getDb();
  const user = db ? await getCurrentAuthUser(db) : null;

  return (
    <div className="mx-auto w-full max-w-[800px] px-5 py-8 md:px-8 lg:py-10 space-y-8">
      <div>
        <Badge className="mb-3 inline-flex items-center gap-1.5 text-xs font-extrabold">
          <Settings className="size-4" /> Cài đặt tài khoản
        </Badge>
        <h1 className="font-display text-[36px] font-extrabold text-eel-dark-blue md:text-[44px]">
          Tài khoản &amp; Cấu hình
        </h1>
        <p className="mt-2 text-base font-bold text-ash">
          Quản lý trạng thái đăng nhập và tùy chỉnh cá nhân.
        </p>
      </div>

      <div className="rounded-xl border-2 border-[#e5e5e5] bg-white p-6 md:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <span className="grid size-14 place-items-center rounded-xl border-2 border-[#ffe48a] bg-[#fffaf0] text-2xl">
              🌱
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-extrabold text-eel-dark-blue">
                  {user?.displayName ?? "Minh Anh"}
                </h2>
                <Badge variant={user?.isDemo ? "neutral" : "default"}>
                  {user?.isDemo ? "Demo User" : "Tài khoản cá nhân"}
                </Badge>
              </div>
              <p className="mt-1 text-sm font-bold text-ash">
                {user?.email ?? "demo@vocabloom.vn"}
              </p>
            </div>
          </div>

          {user?.isDemo ? (
            <div className="flex flex-col gap-2 sm:flex-row">
              <Link
                href="/login"
                className={buttonVariants({ size: "sm", className: "justify-center gap-1.5" })}
              >
                <LogIn className="size-4" /> Đăng nhập
              </Link>
              <Link
                href="/register"
                className={buttonVariants({ variant: "outline", size: "sm", className: "justify-center" })}
              >
                Đăng ký
              </Link>
            </div>
          ) : (
            <LogoutButton />
          )}
        </div>
      </div>

      <div className="rounded-xl border-2 border-dashed border-[#e5e5e5] bg-[#fbfff8] p-6 text-center">
        <UserCheck className="mx-auto size-8 text-ecto-green" />
        <h3 className="mt-3 text-lg font-extrabold text-eel-dark-blue">Tùy chỉnh khác đang vun trồng</h3>
        <p className="mt-1 text-sm font-bold text-ash">
          Tùy chỉnh mục tiêu ngày, giọng đọc và nhắc lịch học sẽ có trong các bản cập nhật sắp tới.
        </p>
      </div>
    </div>
  );
}
