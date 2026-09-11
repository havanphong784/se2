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

export type VerificationEmailPayload =
  | string
  | {
      token: string;
      otpCode: string;
    };

export async function sendVerificationEmail(
  to: string,
  payload: VerificationEmailPayload,
) {
  const { user, pass } = mailConfig();
  const token = typeof payload === "string" ? payload : payload.token;
  const otpCode = typeof payload === "string" ? "" : payload.otpCode;

  const verifyUrl = new URL("/verify-email", appUrl());
  if (token) {
    verifyUrl.searchParams.set("token", token);
  }
  const transporter = nodemailer.createTransport({ service: "gmail", auth: { user, pass } });

  const subject = "Xác thực tài khoản VocaBloom";
  const otpText = otpCode
    ? `Mã xác thực của bạn là: ${otpCode}\n\nBạn có thể nhập mã này trên website hoặc bấm vào liên kết bên dưới để xác thực ngay:\n${verifyUrl}`
    : `Mở liên kết này để xác thực tài khoản: ${verifyUrl}`;

  const otpHtmlBadge = otpCode
    ? `
      <div style="margin: 24px 0; text-align: center;">
        <p style="margin: 0 0 8px 0; font-size: 13px; font-weight: 700; color: #777777; text-transform: uppercase; letter-spacing: 0.08em;">Mã xác thực của bạn</p>
        <div style="display: inline-block; background: #f4fbf0; border: 2px solid #a5ed6e; border-radius: 12px; padding: 14px 28px;">
          <span style="font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #042c60;">${otpCode}</span>
        </div>
        <p style="margin: 10px 0 0 0; font-size: 14px; color: #3c3c3c; font-weight: 600;">Bạn có thể nhập mã này trên website hoặc bấm vào nút bên dưới để xác thực ngay.</p>
      </div>
    `
    : "";

  await transporter.sendMail({
    from: `VocaBloom <${user}>`,
    to,
    subject,
    text: `${otpText}\n\nMã xác thực và liên kết có hiệu lực trong 24 giờ.\nNếu bạn không tạo tài khoản này, hãy bỏ qua email.`,
    html: `
      <main style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 540px; margin: auto; padding: 32px 24px; border: 2px solid #e5e5e5; border-radius: 12px; background-color: #ffffff; color: #3c3c3c;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h1 style="color: #042c60; font-size: 26px; font-weight: 800; margin: 0 0 8px 0;">Chào mừng đến VocaBloom!</h1>
          <p style="color: #777777; font-size: 15px; margin: 0; line-height: 1.5;">Vui lòng xác thực tài khoản email của bạn để bắt đầu học từ vựng.</p>
        </div>

        ${otpHtmlBadge}

        <div style="text-align: center; margin: 28px 0;">
          <a href="${verifyUrl}" style="display: inline-block; background: #58cc02; color: #ffffff; padding: 14px 28px; border-radius: 12px; font-weight: 800; text-decoration: none; font-size: 16px; border-bottom: 4px solid #3fa300;">Xác thực tài khoản ngay</a>
        </div>

        <p style="text-align: center; color: #777777; font-size: 13px; line-height: 1.5; margin: 24px 0 0 0; border-top: 1px solid #eeeeee; padding-top: 16px;">
          Mã xác thực và liên kết có hiệu lực trong 24 giờ.<br/>
          Nếu bạn không tạo tài khoản VocaBloom, bạn có thể yên tâm bỏ qua email này.
        </p>
      </main>
    `,
  });
}
