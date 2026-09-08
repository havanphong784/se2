import nodemailer from "nodemailer";

function appUrl() {
  const value = process.env.APP_URL;
  if (!value) throw new Error("APP_URL must be configured.");
  return new URL(value).origin;
}

function mailConfig() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) throw new Error("Gmail SMTP must be configured.");
  return { user, pass };
}

export async function sendVerificationEmail(to: string, token: string) {
  const { user, pass } = mailConfig();
  const verifyUrl = new URL("/verify-email", appUrl());
  verifyUrl.searchParams.set("token", token);
  const transporter = nodemailer.createTransport({ service: "gmail", auth: { user, pass } });

  await transporter.sendMail({
    from: `VocaBloom <${user}>`,
    to,
    subject: "Xác thực tài khoản VocaBloom",
    text: `Mở liên kết này để xác thực tài khoản: ${verifyUrl}\n\nLiên kết có hiệu lực trong 24 giờ.`,
    html: `<main style="font-family:Arial,sans-serif;max-width:540px;margin:auto;padding:24px;border:2px solid #e5e5e5;border-radius:12px"><h1 style="color:#042c60">Chào mừng đến VocaBloom!</h1><p>Nhấn nút bên dưới để xác thực tài khoản. Liên kết có hiệu lực trong 24 giờ.</p><p style="margin:28px 0"><a href="${verifyUrl}" style="display:inline-block;background:#58cc02;color:#fff;padding:14px 22px;border-radius:12px;font-weight:700;text-decoration:none">Xác thực tài khoản</a></p><p style="color:#777;font-size:13px">Nếu bạn không tạo tài khoản này, hãy bỏ qua email.</p></main>`,
  });
}
