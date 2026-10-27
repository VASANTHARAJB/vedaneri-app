import nodemailer from 'nodemailer';

const MAIL_USER = process.env.SMTP_USER || process.env.GMAIL_USER || '';
const MAIL_PASS = (process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD || '').replace(/\s/g, '');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === 'true',
  auth: { user: MAIL_USER, pass: MAIL_PASS },
});

export interface DonationReceiptData {
  receiptNo: string;
  fundName: string;
  amount: number;
  paymentId: string;
  donorName: string;
  email: string;
  phone: string;
  panNumber?: string;
  paidOn: string;
}

function esc(v: any): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatPhone(raw?: string): string {
  const s = String(raw || '').trim();
  if (!s) return '';
  if (s.startsWith('+')) return s;
  const digits = s.replace(/\D/g, '');
  return digits.length === 10 ? `+91 ${digits}` : s;
}

// Show only the last 4 characters of the PAN in the email
function maskPan(pan?: string): string {
  const p = String(pan || '').trim();
  if (p.length < 5) return p;
  return `XXXXXX${p.slice(-4)}`;
}

const ORG_NAME = process.env.ORG_NAME || 'VEDANTA SASTHRA PRACHARA TRUST';
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || 'support@divasprik.com';

export async function sendDonationReceiptEmail(d: DonationReceiptData) {
  if (!d.email) return;
  if (!MAIL_USER || !MAIL_PASS) {
    console.warn('[Email] Mail credentials missing. Donation receipt email skipped.');
    return;
  }

  const amountText = `INR ${Number(d.amount || 0).toLocaleString('en-IN')}`;
  const phone = formatPhone(d.phone);
  const pan = d.panNumber ? maskPan(d.panNumber) : '';

  const panRow = pan
    ? `<tr><td style="padding:6px 0;color:#666;">PAN:</td><td style="padding:6px 0;font-weight:bold;">${esc(pan)}</td></tr>`
    : '';

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Donation Receipt</title>
</head>
<body style="font-family:Arial,sans-serif;background:#fffdfa;color:#333;margin:0;padding:16px;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:650px;margin:0 auto;background:#ffffff;border:1px solid #ebd8b8;">
  <tr>
    <td style="background:#3b0d0d;color:#ffffff;padding:22px 26px;">
      <div style="font-size:20px;font-weight:bold;">${esc(ORG_NAME)}</div>
      <div style="margin-top:4px;font-size:13px;color:#fbbf24;">Official Donation Receipt</div>
    </td>
  </tr>
  <tr>
    <td style="padding:22px 26px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="border-bottom:1px solid #ebd8b8;margin-bottom:18px;">
        <tr>
          <td valign="top" style="padding-bottom:14px;">
            <div style="font-size:12px;color:#8a5a44;text-transform:uppercase;">Receipt Number</div>
            <div style="margin-top:2px;font-size:16px;font-weight:bold;color:#3b0d0d;">${esc(d.receiptNo)}</div>
          </td>
          <td valign="top" align="right" style="padding-bottom:14px;">
            <div style="font-size:12px;color:#8a5a44;text-transform:uppercase;">Transaction ID</div>
            <div style="margin-top:2px;font-size:13px;font-family:monospace;">${esc(d.paymentId)}</div>
          </td>
        </tr>
      </table>

      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:14px;">
        <tr>
          <td style="padding:6px 0;color:#666;width:40%;">Donation Fund:</td>
          <td style="padding:6px 0;font-weight:bold;color:#3b0d0d;">${esc(d.fundName)}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#666;">Date:</td>
          <td style="padding:6px 0;font-weight:bold;">${esc(d.paidOn)}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#666;">Donor:</td>
          <td style="padding:6px 0;font-weight:bold;">${esc(d.donorName)}${phone ? ` (${esc(phone)})` : ''}</td>
        </tr>
        ${panRow}
        <tr>
          <td style="padding:6px 0;color:#666;">Donation Amount:</td>
          <td style="padding:6px 0;font-weight:bold;font-size:16px;color:#ea580c;">${esc(amountText)}</td>
        </tr>
      </table>

      <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:28px;">
        <tr>
          <td style="padding:14px 16px;background:#fff8ec;border-left:4px solid #ea580c;font-size:12px;color:#5b2a1a;line-height:1.6;">
            Thank you for your generous donation. Please keep this receipt for your records.
          </td>
        </tr>
      </table>
    </td>
  </tr>
  <tr>
    <td align="center" style="background:#faf6f0;padding:14px;font-size:11px;color:#8a5a44;border-top:1px solid #ebd8b8;">
      ${esc(ORG_NAME)} | Contact: ${esc(SUPPORT_EMAIL)}
    </td>
  </tr>
</table>
</body>
</html>`;

  const text = [
    'Donation Receipt',
    `Receipt No: ${d.receiptNo}`,
    `Fund: ${d.fundName}`,
    `Date: ${d.paidOn}`,
    `Donor: ${d.donorName}`,
    pan ? `PAN: ${pan}` : '',
    `Amount: ${amountText}`,
    `Transaction ID: ${d.paymentId}`,
    '',
    'Thank you for your generous donation.',
    `Contact: ${SUPPORT_EMAIL}`,
  ]
    .filter((line, i, arr) => line !== '' || (i > 0 && arr[i - 1] !== ''))
    .join('\n');

  return transporter.sendMail({
    from: `"${process.env.APP_NAME || 'Vedaneri Ashram'}" <${process.env.SMTP_FROM || MAIL_USER}>`,
    to: d.email,
    subject: `Donation Receipt - ${d.receiptNo}`,
    text,
    html,
  });
}