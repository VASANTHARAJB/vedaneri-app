import nodemailer, { Transporter } from 'nodemailer';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const clean = (v?: string) => (v || '').replace(/["'\s]/g, '');

function settings() {
  const user = (process.env.SMTP_USER || process.env.GMAIL_USER || '').trim().replace(/["']/g, '');
  const pass = clean(process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD);
  const host = (process.env.SMTP_HOST || 'smtp.gmail.com').trim();
  const port = Number(process.env.SMTP_PORT) || 587;
  const secure = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true' || port === 465;
  const appName = (process.env.APP_NAME || 'Vedaneri Ashram').replace(/["']/g, '').trim();
  const from = (process.env.SMTP_FROM || user).replace(/["']/g, '').trim();
  return { user, pass, host, port, secure, appName, from };
}

let cached: { key: string; transporter: Transporter } | null = null;

function getTransporter(): Transporter {
  const s = settings();
  if (!s.user || !s.pass) {
    throw new Error('Email is not configured: set SMTP_USER and SMTP_PASS in apps/api/.env');
  }
  const key = `${s.host}|${s.port}|${s.user}|${s.pass}`;
  if (!cached || cached.key !== key) {
    cached = {
      key,
      transporter: nodemailer.createTransport({
        host: s.host,
        port: s.port,
        secure: s.secure,
        auth: { user: s.user, pass: s.pass },
        connectionTimeout: 15000,
        greetingTimeout: 15000,
        socketTimeout: 20000,
      }),
    };
  }
  return cached.transporter;
}

const esc = (v: string) =>
  String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

async function sendCodeEmail(to: string, otp: string, name: string, heading: string, line: string, subjectWord: string) {
  const s = settings();
  const transporter = getTransporter();
  const safeName = esc(name || 'Devotee');
  const safeApp = esc(s.appName);
  const safeOtp = esc(otp);

  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;background:#faf7f2;padding:24px">
    <div style="max-width:480px;margin:0 auto;background:#ffffff;border-top:4px solid #d97706;border-radius:6px;padding:28px">
      <h2 style="margin:0 0 4px;color:#7a1c1c;font-size:20px">${safeApp}</h2>
      <p style="margin:0 0 20px;color:#555;font-size:14px">${esc(heading)}</p>
      <p style="color:#222;font-size:15px">Namaste ${safeName},</p>
      <p style="color:#222;font-size:15px">${esc(line)}</p>
      <p style="text-align:center;margin:24px 0">
        <span style="display:inline-block;background:#fdf3e3;border:1px solid #ebd8b8;border-radius:6px;padding:12px 24px;font-size:30px;letter-spacing:8px;font-weight:bold;color:#7a1c1c">${safeOtp}</span>
      </p>
      <p style="color:#555;font-size:13px">This code is valid for 10 minutes. Please do not share it with anyone.</p>
      <p style="color:#888;font-size:12px;margin-top:20px">If you did not request this, you can ignore this email.</p>
    </div>
  </div>`;

  await transporter.sendMail({
    from: `"${s.appName}" <${s.from}>`,
    to,
    subject: `${otp} is your ${s.appName} ${subjectWord} code`,
    text: `Namaste ${name},\n\nYour ${subjectWord} code is ${otp}. It is valid for 10 minutes. Do not share it with anyone.\n\nIf you did not request this, ignore this email.`,
    html,
  });
}

// Email verification code (sign up)
export async function sendOtpEmail(to: string, otp: string, name = 'Devotee'): Promise<void> {
  await sendCodeEmail(to, otp, name, 'Email verification', 'Use this code to verify your email address:', 'verification');
}

// Password reset code
export async function sendResetEmail(to: string, otp: string, name = 'Devotee'): Promise<void> {
  await sendCodeEmail(to, otp, name, 'Password reset', 'Use this code to reset your password:', 'password reset');
}