"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Lock, Mail, Sprout } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth-provider";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
  const router = useRouter();
  const { setSession } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [unverified, setUnverified] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setUnverified(false);
    setResendMessage(null);
    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setUnverified(data.unverified === true);
        throw new Error(data.error || "Đăng nhập không thành công.");
      }

      setSession(data);
      const next = new URLSearchParams(window.location.search).get("next");
      router.push(next?.startsWith("/") && !next.startsWith("//") ? next : "/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đã có lỗi xảy ra.");
    } finally {
      setLoading(false);
    }
  }

  async function resendVerification() {
    const response = await fetch("/api/auth/verify-email/resend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await response.json();
    setResendMessage(data.message ?? "Đã xử lý yêu cầu gửi lại email.");
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

        {error && <div className="mt-5 rounded-xl border-2 border-[#ffcdd2] bg-[#ffebee] p-3.5 text-center text-sm font-bold text-[#c62828]">{error}</div>}
        {unverified && (
          <div className="mt-4 rounded-xl border-2 border-eel-light bg-[#fbfff8] p-4 text-center text-sm font-bold text-charcoal">
            <p>Chưa nhận được email kích hoạt?</p>
            <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => void resendVerification()}>Gửi lại email xác thực</Button>
            {resendMessage && <p className="mt-3 text-xs text-ash">{resendMessage}</p>}
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
                placeholder="name@example.com"
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
        </div>
      </div>
    </div>
  );
}
