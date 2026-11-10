import nodemailer, { Transporter } from 'nodemailer';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Same mail settings as the magazine emails (SMTP_USER / SMTP_PASS in apps/api/.env)
const clean = (v?: string) => (v || '').replace(/["'\s]/g, '');
const esc = (v: any) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// Nothing a visitor types can start a new mail header
const oneLine = (v: any, max = 120) => String(v ?? '').replace(/[\r\n\t]+/g, ' ').trim().slice(0, max);

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

const ORG = 'SRI SWAMI CHIDBHAVANANDA ASHRAMAM';

function shell(heading: string, inner: string) {
  return `<div style="font-family:Arial,Helvetica,sans-serif;background:#faf7f2;padding:24px">
    <div style="max-width:560px;margin:0 auto;background:#fff;border-top:4px solid #d97706;border-radius:6px;padding:28px">
      <h2 style="margin:0 0 4px;color:#7a1c1c;font-size:20px">${esc(ORG)}</h2>
      <p style="margin:0 0 18px;color:#555;font-size:14px">${esc(heading)}</p>${inner}
    </div></div>`;
}

const row = (k: string, v: string) =>
  `<tr><td style="padding:6px 12px 6px 0;color:#666;font-size:13px;vertical-align:top;white-space:nowrap">${esc(k)}</td><td style="padding:6px 0;font-size:14px;color:#222">${esc(v)}</td></tr>`;

export type ContactMail = { id: number; name: string; email: string | null; phone: string | null; topic: string | null; message: string; locale: string };

// A copy of the message, sent to the person who wrote it
export async function sendContactAck(o: ContactMail & { to: string }) {
  const ta = o.locale === 'ta';
  const L = ta
    ? { head: 'உங்கள் செய்தி எங்களுக்குக் கிடைத்தது', hi: `வணக்கம் ${o.name},`, body: 'உங்கள் செய்திக்கு நன்றி. ஆசிரமம் விரைவில் உங்களைத் தொடர்பு கொள்ளும். உங்கள் செய்தியின் நகல் கீழே உள்ளது.', ref: 'குறிப்பு எண்', topic: 'தலைப்பு', phone: 'கைபேசி', msg: 'உங்கள் செய்தி', ignore: 'நீங்கள் இந்தச் செய்தியை அனுப்பவில்லை என்றால், இந்த மின்னஞ்சலைப் புறக்கணிக்கலாம்.', subject: 'உங்கள் செய்தி கிடைத்தது' }
    : { head: 'We have received your message', hi: `Namaste ${o.name},`, body: 'Thank you for writing to us. The ashram will get in touch with you soon. A copy of your message is below.', ref: 'Reference', topic: 'Topic', phone: 'Mobile', msg: 'Your message', ignore: 'If you did not send this message, you can ignore this email.', subject: 'We received your message' };
  const rows = [row(L.ref, `#${o.id}`), o.topic ? row(L.topic, o.topic) : '', o.phone ? row(L.phone, o.phone) : ''].join('');
  const html = shell(L.head,
    `<p style="color:#222;font-size:15px">${esc(L.hi)}</p>
     <p style="color:#222;font-size:15px">${esc(L.body)}</p>
     <table style="border-collapse:collapse;margin:10px 0">${rows}</table>
     <p style="margin:14px 0 4px;color:#666;font-size:13px">${esc(L.msg)}</p>
     <div style="white-space:pre-wrap;border-left:3px solid #d97706;background:#faf7f2;padding:10px 14px;font-size:14px;color:#222">${esc(o.message)}</div>
     <p style="color:#888;font-size:12px;margin-top:18px">${esc(L.ignore)}</p>`);
  await tx().sendMail({
    from: `"${ORG}" <${cfg().from}>`, to: o.to, subject: `${L.subject} - ${ORG} (#${o.id})`, html,
    text: `${L.hi}\n\n${L.body}\n\n${L.ref}: #${o.id}\n${o.topic ? `${L.topic}: ${oneLine(o.topic)}\n` : ''}\n${o.message}\n\n${L.ignore}`,
  });
}

// A short alert to the ashram, so a new message is not missed. Reply goes to the sender.
export async function sendContactNotice(o: ContactMail) {
  const to = (process.env.CONTACT_NOTIFY_TO || cfg().user || '').trim();
  if (!to) return;
  const html = shell('New message from the website contact form',
    `<table style="border-collapse:collapse;margin:6px 0">${row('Reference', `#${o.id}`)}${row('Name', o.name)}${row('Mobile', o.phone || '-')}${row('Email', o.email || '-')}${row('Topic', o.topic || '-')}${row('Language', o.locale === 'ta' ? 'Tamil' : 'English')}</table>
     <div style="white-space:pre-wrap;border-left:3px solid #d97706;background:#faf7f2;padding:10px 14px;font-size:14px;color:#222;margin-top:10px">${esc(o.message)}</div>
     <p style="color:#888;font-size:12px;margin-top:18px">You can also read and mark this message in the CMS under Contact.</p>`);
  await tx().sendMail({
    from: `"${ORG}" <${cfg().from}>`, to, subject: `New contact message #${o.id}: ${oneLine(o.topic || o.name, 60)}`,
    ...(o.email ? { replyTo: `"${oneLine(o.name, 60).replace(/"/g, '')}" <${oneLine(o.email, 150)}>` } : {}), html,
    text: `#${o.id}\n${o.name}\n${o.phone || '-'}\n${o.email || '-'}\n${o.topic || '-'}\n\n${o.message}`,
  });
}