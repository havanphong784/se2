"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Mail, ShieldCheck, XCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Status = "loading" | "success" | "error";

export default function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const [status, setStatus] = useState<Status>("loading");
  const [message, setMessage] = useState("Đang xác thực tài khoản...");
  const [email, setEmail] = useState("");
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  useEffect(() => {
    void searchParams.then(async ({ token }) => {
      if (!token) {
        setStatus("error");
        setMessage("Liên kết xác thực không hợp lệ hoặc đã hết hạn.");
        return;
      }
      const response = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await response.json();
      setStatus(response.ok ? "success" : "error");
      setMessage(data.message ?? data.error ?? "Không thể xác thực email.");
    });
  }, [searchParams]);

  async function resend(event: React.FormEvent) {
    event.preventDefault();
    const response = await fetch("/api/auth/verify-email/resend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await response.json();
    setResendMessage(data.message ?? "Đã xử lý yêu cầu.");
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-8rem)] w-full max-w-md flex-col justify-center px-5 py-8">
      <div className="rounded-xl border-2 border-[#e5e5e5] bg-white p-6 text-center md:p-8">
        <Badge className="inline-flex gap-1.5"><ShieldCheck className="size-4" /> VocaBloom Auth</Badge>
        {status === "loading" && <><div className="mx-auto mt-6 size-10 animate-spin rounded-full border-4 border-eel-light border-t-ecto-green" /><h1 className="mt-5 font-display text-3xl font-extrabold text-eel-dark-blue">{message}</h1></>}
        {status === "success" && <><CheckCircle2 className="mx-auto mt-6 size-14 text-ecto-green" /><h1 className="mt-4 font-display text-3xl font-extrabold text-eel-dark-blue">Email đã xác thực</h1><p className="mt-3 font-bold text-ash">{message}</p><Link href="/login" className="mt-6 inline-flex"><Button size="lg">Đăng nhập</Button></Link></>}
        {status === "error" && <><XCircle className="mx-auto mt-6 size-14 text-[#d94e4e]" /><h1 className="mt-4 font-display text-3xl font-extrabold text-eel-dark-blue">Xác thực chưa thành công</h1><p className="mt-3 font-bold text-ash">{message}</p><form onSubmit={resend} className="mt-6 space-y-3 text-left"><label className="block text-xs font-extrabold uppercase tracking-[0.08em] text-ash">Email<div className="relative mt-1.5"><Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ash" /><Input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="pl-9" /></div></label><Button type="submit" variant="outline" className="w-full">Gửi lại email xác thực</Button></form>{resendMessage && <p className="mt-3 text-xs font-bold text-ash">{resendMessage}</p>}</>}
      </div>
    </div>
  );
}
