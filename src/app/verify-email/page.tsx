"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowRight, CheckCircle2, KeyRound, Mail, RefreshCw, ShieldCheck, XCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type TabMode = "otp" | "resend";
type Status = "idle" | "loading" | "success" | "error";
type VerificationResult = { ok: boolean; message: string };

const verificationRequests = new Map<string, Promise<VerificationResult>>();

function verifyToken(token: string) {
  let request = verificationRequests.get(token);
  if (!request) {
    request = fetch("/api/auth/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    }).then(async (response) => {
      const data = await response.json();
      return {
        ok: response.ok,
        message: data.message ?? data.error ?? "Không thể xác thực email.",
      };
    });
    verificationRequests.set(token, request);
    void request.catch(() => verificationRequests.delete(token));
  }
  return request;
}

function VerifyEmailInner() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const emailFromUrl = searchParams.get("email") || "";

  const [activeTab, setActiveTab] = useState<TabMode>("otp");
  const [tokenStatus, setTokenStatus] = useState<Status>(token ? "loading" : "idle");
  const [tokenMessage, setTokenMessage] = useState(
    token ? "Đang xác thực tài khoản qua liên kết..." : "",
  );

  // Manual OTP state
  const [email, setEmail] = useState(emailFromUrl);
  const [otp, setOtp] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);

  // Resend state
  const [resendEmail, setResendEmail] = useState(emailFromUrl);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendStatus, setResendStatus] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Overall success state
  const [isVerified, setIsVerified] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  useEffect(() => {
    if (!token) return;
    let active = true;

    void (async () => {
      try {
        const result = await verifyToken(token);
        if (!active) return;
        if (result.ok) {
          setTokenStatus("success");
          setIsVerified(true);
          setSuccessMessage(result.message);
        } else {
          setTokenStatus("error");
          setTokenMessage(result.message);
        }
      } catch {
        if (!active) return;
        setTokenStatus("error");
        setTokenMessage("Không thể kết nối để xác thực email. Vui lòng thử lại.");
      }
    })();

    return () => {
      active = false;
    };
  }, [token]);

  async function handleVerifyOtp(event: React.FormEvent) {
    event.preventDefault();
    if (!email.trim() || otp.length !== 6 || otpLoading) return;
    setOtpError(null);
    setOtpLoading(true);

    try {
      const response = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), code: otp.trim() }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Mã xác thực không hợp lệ hoặc đã hết hạn.");
      }
      setIsVerified(true);
      setSuccessMessage(data.message || "Xác thực email thành công!");
    } catch (cause) {
      setOtpError(cause instanceof Error ? cause.message : "Xác thực không thành công.");
    } finally {
      setOtpLoading(false);
    }
  }

  async function handleResend(event: React.FormEvent) {
    event.preventDefault();
    if (!resendEmail.trim() || resendLoading || resendCooldown > 0) return;
    setResendLoading(true);
    setResendStatus(null);

    try {
      const response = await fetch("/api/auth/verify-email/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: resendEmail.trim().toLowerCase() }),
      });
      const data = await response.json();
      setResendStatus(data.message ?? "Đã gửi lại email xác thực.");
      setResendCooldown(60);
      // Auto-sync email to OTP form
      setEmail(resendEmail.trim());
    } catch {
      setResendStatus("Không thể gửi lại email lúc này. Hãy thử lại.");
    } finally {
      setResendLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-8rem)] w-full max-w-md flex-col justify-center px-5 py-8">
      <div className="rounded-xl border-2 border-[#e5e5e5] bg-white p-6 md:p-8">
        <div className="text-center">
          <Badge className="mb-3 inline-flex items-center gap-1.5 text-xs font-extrabold">
            <ShieldCheck className="size-4" /> VocaBloom Auth
          </Badge>
        </div>

        {/* 1. AUTO TOKEN VERIFYING SPINNER */}
        {token && tokenStatus === "loading" && (
          <div className="text-center">
            <div className="mx-auto mt-4 size-10 animate-spin rounded-xl border-4 border-eel-light border-t-ecto-green" />
            <h1 className="mt-5 font-display text-2xl font-extrabold text-eel-dark-blue">
              {tokenMessage}
            </h1>
            <p className="mt-2 text-sm font-bold text-ash">
              Vui lòng chờ trong giây lát...
            </p>
          </div>
        )}

        {/* 2. SUCCESS STATE (from token or OTP) */}
        {isVerified && (
          <div className="text-center">
            <CheckCircle2 className="mx-auto mt-4 size-14 text-ecto-green" />
            <h1 className="mt-4 font-display text-3xl font-extrabold text-eel-dark-blue">
              Email đã xác thực
            </h1>
            <p className="mt-3 text-sm font-bold text-ash leading-6">
              {successMessage || "Tài khoản của bạn đã được kích hoạt thành công. Hãy đăng nhập để bắt đầu học."}
            </p>
            <Link href="/login" className="mt-6 inline-flex w-full">
              <Button size="lg" className="w-full justify-center">
                Đăng nhập ngay <ArrowRight className="size-5" />
              </Button>
            </Link>
          </div>
        )}

        {/* 3. TOKEN FAILED OR MANUAL ENTRY FORM */}
        {!isVerified && (!token || tokenStatus === "error") && (
          <div>
            {tokenStatus === "error" && (
              <div className="mb-6 rounded-xl border-2 border-[#ffcdd2] bg-[#ffebee] p-4 text-center">
                <XCircle className="mx-auto size-8 text-[#d94e4e]" />
                <h2 className="mt-2 text-base font-extrabold text-[#c62828]">
                  Liên kết xác thực không hợp lệ hoặc đã hết hạn
                </h2>
                <p className="mt-1 text-xs font-bold text-ash">
                  {tokenMessage}. Bạn có thể nhập mã OTP 6 số bên dưới hoặc yêu cầu gửi lại mã mới.
                </p>
              </div>
            )}

            <div className="text-center mb-6">
              <h1 className="font-display text-[28px] font-extrabold text-eel-dark-blue">
                Xác thực tài khoản
              </h1>
              <p className="mt-1 text-sm font-bold text-ash">
                Nhập mã OTP 6 số đã nhận qua email để kích hoạt.
              </p>
            </div>

            {/* TAB SELECTOR */}
            <div className="flex rounded-xl bg-[#f4f4f4] p-1 mb-6">
              <button
                type="button"
                onClick={() => setActiveTab("otp")}
                className={`flex-1 rounded-lg py-2 text-xs font-extrabold transition-colors ${
                  activeTab === "otp"
                    ? "bg-white text-eel-dark-blue shadow-sm"
                    : "text-ash hover:text-charcoal"
                }`}
              >
                Nhập mã OTP 6 số
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab("resend");
                  if (email && !resendEmail) setResendEmail(email);
                }}
                className={`flex-1 rounded-lg py-2 text-xs font-extrabold transition-colors ${
                  activeTab === "resend"
                    ? "bg-white text-eel-dark-blue shadow-sm"
                    : "text-ash hover:text-charcoal"
                }`}
              >
                Gửi lại mã xác thực
              </button>
            </div>

            {/* TAB 1: ENTER OTP */}
            {activeTab === "otp" && (
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                {otpError && (
                  <div className="rounded-xl border-2 border-[#ffcdd2] bg-[#ffebee] p-3 text-center text-sm font-bold text-[#c62828]">
                    {otpError}
                  </div>
                )}

                <label className="block text-xs font-extrabold uppercase tracking-[0.08em] text-ash">
                  Địa chỉ Email
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

                <div>
                  <label className="block text-xs font-extrabold uppercase tracking-[0.08em] text-ash mb-1.5">
                    Mã xác thực 6 chữ số (OTP)
                  </label>
                  <div className="relative">
                    <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-ash" />
                    <input
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      required
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
                  disabled={!email.trim() || otp.length !== 6 || otpLoading}
                >
                  {otpLoading ? "Đang xác thực…" : "Xác thực tài khoản"}{" "}
                  <ArrowRight className="size-5" />
                </Button>

                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab("resend");
                      if (email && !resendEmail) setResendEmail(email);
                    }}
                    className="text-xs font-extrabold text-macaw-blue hover:underline"
                  >
                    Chưa nhận được mã? Bấm vào đây để gửi lại
                  </button>
                </div>
              </form>
            )}

            {/* TAB 2: RESEND VERIFICATION EMAIL */}
            {activeTab === "resend" && (
              <form onSubmit={handleResend} className="space-y-4">
                {resendStatus && (
                  <div className="rounded-xl border-2 border-eel-light bg-[#f4fbf0] p-3.5 text-center text-sm font-bold text-[#2e7d32]">
                    {resendStatus}
                  </div>
                )}

                <p className="text-xs font-bold text-ash leading-5">
                  Nhập địa chỉ email của bạn. Chúng tôi sẽ gửi một mã OTP 6 số mới kèm theo liên kết kích hoạt.
                </p>

                <label className="block text-xs font-extrabold uppercase tracking-[0.08em] text-ash">
                  Email đã đăng ký
                  <div className="relative mt-1.5">
                    <Mail className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-ash" />
                    <Input
                      type="email"
                      required
                      value={resendEmail}
                      onChange={(e) => setResendEmail(e.target.value)}
                      placeholder="name@example.com"
                      className="pl-11"
                    />
                  </div>
                </label>

                <Button
                  type="submit"
                  variant="outline"
                  size="lg"
                  className="w-full justify-center"
                  disabled={!resendEmail.trim() || resendLoading || resendCooldown > 0}
                >
                  {resendLoading ? (
                    "Đang gửi…"
                  ) : resendCooldown > 0 ? (
                    `Gửi lại sau ${resendCooldown}s`
                  ) : (
                    <>
                      <RefreshCw className="size-4" /> Gửi lại mã xác thực
                    </>
                  )}
                </Button>

                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab("otp")}
                    className="text-xs font-extrabold text-macaw-blue hover:underline"
                  >
                    Đã có mã xác thực? Quay lại nhập mã
                  </button>
                </div>
              </form>
            )}

            <p className="mt-6 border-t-2 border-[#eeeeee] pt-5 text-center text-sm font-bold text-ash">
              Đã kích hoạt tài khoản?{" "}
              <Link
                href="/login"
                className="font-extrabold text-macaw-blue underline underline-offset-4"
              >
                Đăng nhập ngay
              </Link>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto flex min-h-[calc(100vh-8rem)] w-full max-w-md flex-col justify-center px-5 py-8">
          <div className="rounded-xl border-2 border-[#e5e5e5] bg-white p-6 text-center md:p-8">
            <Badge className="inline-flex gap-1.5">
              <ShieldCheck className="size-4" /> VocaBloom Auth
            </Badge>
            <div className="mx-auto mt-6 size-10 animate-spin rounded-xl border-4 border-eel-light border-t-ecto-green" />
            <h1 className="mt-5 font-display text-2xl font-extrabold text-eel-dark-blue">
              Đang tải...
            </h1>
          </div>
        </div>
      }
    >
      <VerifyEmailInner />
    </Suspense>
  );
}
