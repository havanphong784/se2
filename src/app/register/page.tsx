"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, CheckCircle2, KeyRound, Lock, Mail, RefreshCw, Sprout, User } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Step = "register" | "verify_otp" | "success";

export default function RegisterPage() {
  const [step, setStep] = useState<Step>("register");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // OTP State
  const [otp, setOtp] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [resendStatus, setResendStatus] = useState<string | null>(null);
  const [resendLoading, setResendLoading] = useState(false);

  const otpInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step === "verify_otp") {
      otpInputRef.current?.focus();
    }
  }, [step]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  async function handleRegister(event: React.FormEvent) {
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
      setStep("verify_otp");
      setCooldown(60);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Đã có lỗi xảy ra.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(event?: React.FormEvent) {
    if (event) event.preventDefault();
    if (otp.length !== 6 || otpLoading) return;
    setOtpError(null);
    setOtpLoading(true);
    try {
      const response = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), code: otp.trim() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Xác thực không thành công.");
      setStep("success");
    } catch (cause) {
      setOtpError(cause instanceof Error ? cause.message : "Mã xác thực không hợp lệ hoặc đã hết hạn.");
    } finally {
      setOtpLoading(false);
    }
  }

  async function handleResendCode() {
    if (cooldown > 0 || resendLoading) return;
    setResendLoading(true);
    setResendStatus(null);
    setOtpError(null);
    try {
      const response = await fetch("/api/auth/verify-email/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = await response.json();
      setResendStatus(data.message || "Mã OTP mới đã được gửi về email của bạn.");
      setCooldown(60);
    } catch {
      setResendStatus("Không thể gửi lại mã xác thực lúc này. Vui lòng thử lại sau.");
    } finally {
      setResendLoading(false);
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
            {step === "register" && "Tạo tài khoản"}
            {step === "verify_otp" && "Xác thực email"}
            {step === "success" && "Kích hoạt thành công!"}
          </h1>
        </div>

        {step === "register" && (
          <>
            {error && (
              <div className="mt-5 rounded-xl border-2 border-[#ffcdd2] bg-[#ffebee] p-3.5 text-center text-sm font-bold text-[#c62828]">
                {error}
              </div>
            )}
            <form onSubmit={handleRegister} className="mt-6 space-y-4">
              <label className="block text-xs font-extrabold uppercase tracking-[0.08em] text-ash">
                Tên hiển thị
                <div className="relative mt-1.5">
                  <User className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-ash" />
                  <Input
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Nguyễn Văn A"
                    className="pl-11"
                  />
                </div>
              </label>

              <label className="block text-xs font-extrabold uppercase tracking-[0.08em] text-ash">
                Email
                <div className="relative mt-1.5">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-ash" />
                  <Input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="pl-11"
                  />
                </div>
              </label>

              <label className="block text-xs font-extrabold uppercase tracking-[0.08em] text-ash">
                Mật khẩu (ít nhất 6 ký tự)
                <div className="relative mt-1.5">
                  <Lock className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-ash" />
                  <Input
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="pl-11"
                  />
                </div>
              </label>

              <Button
                type="submit"
                size="lg"
                className="w-full justify-center"
                disabled={loading}
              >
                {loading ? "Đang tạo tài khoản…" : "Tạo tài khoản mới"}{" "}
                <ArrowRight className="size-5" />
              </Button>
            </form>

            <p className="mt-6 border-t-2 border-[#eeeeee] pt-5 text-center text-sm font-bold text-ash">
              Đã có tài khoản?{" "}
              <Link
                href="/login"
                className="font-extrabold text-macaw-blue underline underline-offset-4"
              >
                Đăng nhập ngay
              </Link>
            </p>
          </>
        )}

        {step === "verify_otp" && (
          <div className="mt-6 text-center">
            <p className="text-sm font-bold leading-6 text-ash">
              Mã xác thực 6 số đã được gửi đến email:
              <br />
              <strong className="text-eel-dark-blue">{email}</strong>
            </p>

            {otpError && (
              <div className="mt-4 rounded-xl border-2 border-[#ffcdd2] bg-[#ffebee] p-3 text-center text-sm font-bold text-[#c62828]">
                {otpError}
              </div>
            )}

            {resendStatus && (
              <div className="mt-4 rounded-xl border-2 border-eel-light bg-[#f4fbf0] p-3 text-center text-sm font-bold text-[#2e7d32]">
                {resendStatus}
              </div>
            )}

            <form onSubmit={handleVerifyOtp} className="mt-6 space-y-4">
              <div>
                <label className="block text-xs font-extrabold uppercase tracking-[0.08em] text-ash mb-2 text-left">
                  Nhập mã xác thực 6 chữ số
                </label>
                <div className="relative">
                  <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-ash" />
                  <input
                    ref={otpInputRef}
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, "").slice(0, 6);
                      setOtp(val);
                    }}
                    placeholder="••••••"
                    className="flex h-14 w-full rounded-xl border-2 border-[#dedede] bg-[#fafafa] pl-11 pr-4 text-center font-mono text-2xl font-extrabold tracking-[0.35em] text-eel-dark-blue outline-none transition-[border-color,background-color] placeholder:text-[#c0c0c0] focus:border-ecto-green focus:bg-white focus:ring-4 focus:ring-ecto-green/20"
                  />
                </div>
              </div>

              <Button
                type="submit"
                size="lg"
                className="w-full justify-center"
                disabled={otp.length !== 6 || otpLoading}
              >
                {otpLoading ? "Đang xác thực…" : "Xác nhận kích hoạt"}{" "}
                <ArrowRight className="size-5" />
              </Button>
            </form>

            <div className="mt-6 flex flex-col items-center gap-3 border-t-2 border-[#eeeeee] pt-5">
              <div className="text-sm font-bold text-ash">
                {cooldown > 0 ? (
                  <span>
                    Gửi lại mã sau{" "}
                    <strong className="text-eel-dark-blue">{cooldown}s</strong>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={handleResendCode}
                    disabled={resendLoading}
                    className="inline-flex items-center gap-1.5 font-extrabold text-macaw-blue hover:underline"
                  >
                    <RefreshCw className={`size-4 ${resendLoading ? "animate-spin" : ""}`} />
                    Gửi lại mã OTP
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => {
                  setStep("register");
                  setOtp("");
                  setOtpError(null);
                  setResendStatus(null);
                }}
                className="inline-flex items-center gap-1 text-xs font-extrabold text-ash hover:text-charcoal transition-colors"
              >
                <ArrowLeft className="size-3.5" /> Thay đổi email hoặc thông tin
              </button>
            </div>
          </div>
        )}

        {step === "success" && (
          <div className="mt-6 text-center">
            <CheckCircle2 className="mx-auto size-14 text-ecto-green" />
            <h2 className="mt-4 text-xl font-extrabold text-eel-dark-blue">
              Tài khoản đã sẵn sàng!
            </h2>
            <p className="mt-2 text-sm font-bold leading-6 text-ash">
              Email <strong className="text-charcoal">{email}</strong> đã được kích hoạt thành công.
              Bây giờ bạn có thể đăng nhập và bắt đầu học ngay.
            </p>
            <Link href="/login" className="mt-6 inline-flex w-full">
              <Button size="lg" className="w-full justify-center">
                Đăng nhập ngay <ArrowRight className="size-5" />
              </Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
