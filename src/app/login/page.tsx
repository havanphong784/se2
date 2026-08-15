"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Lock, Mail, Sparkles, Sprout } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
  const router = Router();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Đăng nhập không thành công.");
      }

      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đã có lỗi xảy ra.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-8rem)] w-full max-w-md flex-col justify-center px-5 py-8">
      <div className="rounded-xl border-2 border-[#e5e5e5] bg-white p-6 md:p-8">
        <div className="text-center">
          <Badge className="mb-3 inline-flex items-center gap-1.5 text-xs font-extrabold">
            <Sprout className="size-4" /> VocaBloom Auth
          </Badge>
          <h1 className="font-display text-[32px] font-extrabold text-eel-dark-blue">
            Đăng nhập
          </h1>
          <p className="mt-2 text-sm font-bold text-ash">
            Chào mừng bạn quay lại với khu vườn từ vựng!
          </p>
        </div>

        {error && (
          <div className="mt-5 rounded-xl border-2 border-[#ffcdd2] bg-[#ffebee] p-3.5 text-center text-sm font-bold text-[#c62828]">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="login-email" className="block text-xs font-extrabold uppercase tracking-[0.08em] text-ash">
              Email
            </label>
            <div className="relative mt-1.5">
              <Mail className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-ash" />
              <Input
                id="login-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="havanphong784@gmail.com"
                className="pl-11"
              />
            </div>
          </div>

          <div>
            <label htmlFor="login-password" className="block text-xs font-extrabold uppercase tracking-[0.08em] text-ash">
              Mật khẩu
            </label>
            <div className="relative mt-1.5">
              <Lock className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-ash" />
              <Input
                id="login-password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="pl-11"
              />
            </div>
          </div>

          <Button type="submit" size="lg" className="w-full justify-center" disabled={loading}>
            {loading ? "Đang xác thực…" : "Đăng nhập"} <ArrowRight className="size-5" />
          </Button>
        </form>

        <div className="mt-6 border-t-2 border-[#eeeeee] pt-5 text-center text-sm font-bold">
          <p className="text-ash">
            Chưa có tài khoản?{" "}
            <Link href="/register" className="font-extrabold text-macaw-blue underline underline-offset-4">
              Đăng ký ngay
            </Link>
          </p>
          <div className="mt-4 rounded-xl border-2 border-eel-light bg-[#fbfff8] p-3 text-xs text-charcoal">
            <span className="flex items-center justify-center gap-1 font-extrabold text-ecto-green">
              <Sparkles className="size-4" /> Hoặc dùng tài khoản Demo
            </span>
            <p className="mt-1 text-ash">
              Bạn vẫn có thể trải nghiệm toàn bộ ứng dụng mà không cần đăng nhập.
            </p>
            <Link
              href="/"
              className={buttonVariants({ variant: "outline", size: "sm", className: "mt-2.5 w-full justify-center" })}
            >
              Vào học với Demo User
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function Router() {
  return useRouter();
}
