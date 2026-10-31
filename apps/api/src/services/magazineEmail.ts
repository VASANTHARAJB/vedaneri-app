import nodemailer, { Transporter } from 'nodemailer';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const clean = (v?: string) => (v || '').replace(/["'\s]/g, '');
const esc = (v: any) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function cfg() {
  const user = (process.env.SMTP_USER || process.env.GMAIL_USER || '').trim().replace(/["']/g, '');
  const pass = clean(process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD);
  const host = (process.env.SMTP_HOST || 'smtp.gmail.com').trim();
  const port = Number(process.env.SMTP_PORT) || 587;
  const secure = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true' || port === 465;
  const from = (process.env.SMTP_FROM || user).replace(/["']/g, '').trim();
  return { user, pass, host, port, secure, from };
}

let cached: { key: string; t: Transporter } | null = null;
function tx(): Transporter {
  const c = cfg();
  if (!c.user || !c.pass) throw new Error('Email is not configured: set SMTP_USER and SMTP_PASS in apps/api/.env');
  const key = `${c.host}|${c.port}|${c.user}|${c.pass}`;
  if (!cached || cached.key !== key) {
    cached = {
      key,
      t: nodemailer.createTransport({ host: c.host, port: c.port, secure: c.secure, auth: { user: c.user, pass: c.pass }, connectionTimeout: 15000, socketTimeout: 20000 }),
    };
  }
  return cached.t;
}

const WEB = () => (process.env.WEB_URL || 'http://localhost:3000').replace(/\/$/, '');
const dmy = (s: string) => (s ? s.slice(0, 10).split('-').reverse().join('.') : '');
const DELIVERY: Record<string, string> = { print: 'Printed copy by post', digital: 'Digital issues', both: 'Printed copy and digital issues' };

function shell(org: string, heading: string, inner: string) {
  return `<div style="font-family:Arial,Helvetica,sans-serif;background:#faf7f2;padding:24px">
    <div style="max-width:520px;margin:0 auto;background:#fff;border-top:4px solid #d97706;border-radius:6px;padding:28px">
      <h2 style="margin:0 0 4px;color:#7a1c1c;font-size:20px">${esc(org)}</h2>
      <p style="margin:0 0 18px;color:#555;font-size:14px">${esc(heading)}</p>${inner}
    </div></div>`;
}

export async function sendMagazineReceipt(o: {
  to: string; name: string; org: string; receiptNo: string; planName: string; delivery: string; amount: number; paymentId: string; start: string; end: string;
}) {
  const rows: [string, string][] = [
    ['Receipt no', o.receiptNo], ['Plan', o.planName], ['Delivery', DELIVERY[o.delivery] || o.delivery],
    ['Valid', `${dmy(o.start)} to ${dmy(o.end)}`], ['Amount paid', `INR ${Number(o.amount).toLocaleString('en-IN')}`], ['Payment reference', o.paymentId],
  ];
  const table = rows.map(([k, v]) => `<tr><td style="padding:6px 0;color:#666;font-size:13px">${esc(k)}</td><td style="padding:6px 0;text-align:right;font-weight:bold;font-size:14px;color:#222">${esc(v)}</td></tr>`).join('');
  const html = shell(o.org, 'Magazine subscription receipt',
    `<p style="color:#222;font-size:15px">Namaste ${esc(o.name)}, thank you for subscribing.</p>
     <table style="width:100%;border-collapse:collapse;border-top:1px solid #eee;border-bottom:1px solid #eee;margin:14px 0">${table}</table>
     <p style="color:#888;font-size:12px">Please keep this receipt for your records.</p>`);
  await tx().sendMail({ from: `"${o.org}" <${cfg().from}>`, to: o.to, subject: `Receipt ${o.receiptNo} - ${o.planName}`, html,
    text: `Receipt ${o.receiptNo}\n${o.planName}\nValid ${dmy(o.start)} to ${dmy(o.end)}\nAmount INR ${o.amount}\nPayment ${o.paymentId}` });
}

export async function sendMagazineReminder(o: { to: string; name: string; org: string; planName: string; end: string; daysLeft: number; locale?: string }) {
  const link = `${WEB()}/${o.locale || 'en'}/magazine#subscribe-form`;
  const html = shell(o.org, 'Subscription renewal reminder',
    `<p style="color:#222;font-size:15px">Namaste ${esc(o.name)},</p>
     <p style="color:#222;font-size:15px">Your subscription <strong>${esc(o.planName)}</strong> ends on <strong>${esc(dmy(o.end))}</strong> (${o.daysLeft} day${o.daysLeft === 1 ? '' : 's'} left).</p>
     <p style="color:#222;font-size:15px">Renew now and the new period starts right after your current one, so you will not miss an issue.</p>
     <p style="text-align:center;margin:22px 0"><a href="${esc(link)}" style="background:#7a1c1c;color:#fff;text-decoration:none;padding:12px 26px;border-radius:6px;font-weight:bold;font-size:15px">Renew subscription</a></p>`);
  await tx().sendMail({ from: `"${o.org}" <${cfg().from}>`, to: o.to, subject: `Your magazine subscription ends on ${dmy(o.end)}`, html,
    text: `Your subscription ${o.planName} ends on ${dmy(o.end)}. Renew here: ${link}` });
}