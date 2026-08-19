"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Lock, Mail, Sprout, User } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function RegisterPage() {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [registered, setRegistered] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName, email, password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Đăng ký không thành công.");
      setRegistered(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Đã có lỗi xảy ra.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-8rem)] w-full max-w-md flex-col justify-center px-5 py-8">
      <div className="rounded-xl border-2 border-[#e5e5e5] bg-white p-6 md:p-8">
        <div className="text-center">
          <Badge className="mb-3 inline-flex items-center gap-1.5 text-xs font-extrabold"><Sprout className="size-4" /> VocaBloom Auth</Badge>
          <h1 className="font-display text-[32px] font-extrabold text-eel-dark-blue">Tạo tài khoản</h1>
        </div>
        {registered ? (
          <div className="mt-6 text-center">
            <CheckCircle2 className="mx-auto size-12 text-ecto-green" />
            <h2 className="mt-4 text-xl font-extrabold text-eel-dark-blue">Kiểm tra email của bạn</h2>
            <p className="mt-2 text-sm font-bold leading-6 text-ash">Đã gửi liên kết kích hoạt đến <strong className="text-charcoal">{email}</strong>. Mở email để xác thực tài khoản, rồi đăng nhập.</p>
            <Link href="/login" className="mt-6 inline-flex"><Button size="lg">Đến trang đăng nhập <ArrowRight className="size-5" /></Button></Link>
          </div>
        ) : (
          <>
            {error && <div className="mt-5 rounded-xl border-2 border-[#ffcdd2] bg-[#ffebee] p-3.5 text-center text-sm font-bold text-[#c62828]">{error}</div>}
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <label className="block text-xs font-extrabold uppercase tracking-[0.08em] text-ash">Tên hiển thị<div className="relative mt-1.5"><User className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-ash" /><Input required value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Nguyễn Văn A" className="pl-11" /></div></label>
              <label className="block text-xs font-extrabold uppercase tracking-[0.08em] text-ash">Email<div className="relative mt-1.5"><Mail className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-ash" /><Input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" className="pl-11" /></div></label>
              <label className="block text-xs font-extrabold uppercase tracking-[0.08em] text-ash">Mật khẩu (ít nhất 6 ký tự)<div className="relative mt-1.5"><Lock className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-ash" /><Input type="password" required minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="••••••••" className="pl-11" /></div></label>
              <Button type="submit" size="lg" className="w-full justify-center" disabled={loading}>{loading ? "Đang tạo tài khoản…" : "Tạo tài khoản mới"} <ArrowRight className="size-5" /></Button>
            </form>
            <p className="mt-6 border-t-2 border-[#eeeeee] pt-5 text-center text-sm font-bold text-ash">Đã có tài khoản? <Link href="/login" className="font-extrabold text-macaw-blue underline underline-offset-4">Đăng nhập ngay</Link></p>
          </>
        )}
      </div>
    </div>
  );
}
