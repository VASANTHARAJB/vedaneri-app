import nodemailer from 'nodemailer';

const MAIL_USER = process.env.SMTP_USER || process.env.GMAIL_USER || '';
const MAIL_PASS = (process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD || '').replace(/\s/g, '');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: MAIL_USER,
    pass: MAIL_PASS,
  },
});

export interface BookingReceiptData {
  receiptNo: string;
  category?: 'seva' | 'corpus';
  bookingDate: string;
  sevaName: string;
  totalAmount: number;
  paymentId: string;
  primaryDevotee: {
    name: string;
    email: string;
    phone: string;
    gothram?: string;
    nakshathiram?: string;
    rasi?: string;
  };
  sankalpamMembers: Array<{
    title?: string;
    name: string;
    gothram?: string;
    nakshathiram?: string;
    rasi?: string;
    relation?: string;
  }>;
  deliveryType: 'pickup' | 'courier';
  deliveryAddress?: {
    comm_address?: string;
    city?: string;
    state?: string;
  };
}

// ---------- helpers ----------
function esc(v: any): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDate(v?: string): string {
  if (!v) return '';
  const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : String(v);
}

function formatPhone(raw?: string): string {
  const s = String(raw || '').trim();
  if (!s) return '';
  if (s.startsWith('+')) return s;
  const digits = s.replace(/\D/g, '');
  return digits.length === 10 ? `+91 ${digits}` : s;
}

function formatAmount(n: number): string {
  return `INR ${Number(n || 0).toLocaleString('en-IN')}`;
}

const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || 'support@divasprik.com';

export async function sendBookingReceiptEmail(data: BookingReceiptData) {
  if (!data.primaryDevotee.email) return;

  if (!MAIL_USER || !MAIL_PASS) {
    console.warn('[Email] Mail credentials missing (SMTP_USER/SMTP_PASS or GMAIL_USER/GMAIL_APP_PASSWORD). Receipt email skipped.');
    return;
  }

  const isCorpus = data.category === 'corpus';
  const members = data.sankalpamMembers || [];
  const phone = formatPhone(data.primaryDevotee.phone);
  const dateLabel = isCorpus ? 'Contribution Date' : 'Scheduled Ritual Date';
  const dateText = formatDate(data.bookingDate);

  const addressText = [
    data.deliveryAddress?.comm_address,
    data.deliveryAddress?.city,
    data.deliveryAddress?.state,
  ]
    .filter(Boolean)
    .join(', ');

  const deliveryText =
    data.deliveryType === 'courier'
      ? `Postal Courier${addressText ? ` (${addressText})` : ''}`
      : 'In-Person Ashram Pickup';

  const memberRows = members
    .map(
      (m, idx) => `
      <tr>
        <td style="padding:8px 10px;font-size:13px;border-bottom:1px solid #f0e2c8;">${idx + 1}</td>
        <td style="padding:8px 10px;font-size:13px;font-weight:bold;border-bottom:1px solid #f0e2c8;">${esc(m.title ? `${m.title}. ` : '')}${esc(m.name)}</td>
        <td style="padding:8px 10px;font-size:13px;border-bottom:1px solid #f0e2c8;">${esc(m.relation || 'Family')}</td>
        <td style="padding:8px 10px;font-size:13px;border-bottom:1px solid #f0e2c8;">${esc(m.gothram || '-')}</td>
        <td style="padding:8px 10px;font-size:13px;border-bottom:1px solid #f0e2c8;">${esc(m.nakshathiram || '-')}</td>
        <td style="padding:8px 10px;font-size:13px;border-bottom:1px solid #f0e2c8;">${esc(m.rasi || '-')}</td>
      </tr>`
    )
    .join('');

  const membersBlock =
    !isCorpus && members.length > 0
      ? `
      <p style="margin:24px 0 8px;font-size:13px;font-weight:bold;color:#3b0d0d;text-transform:uppercase;">Sankalpam Family Names</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;text-align:left;background:#fffdfa;border:1px solid #ebd8b8;">
        <thead>
          <tr style="background:#fff8ec;font-size:12px;color:#5b2a1a;">
            <th style="padding:8px 10px;">#</th>
            <th style="padding:8px 10px;">Name</th>
            <th style="padding:8px 10px;">Relation</th>
            <th style="padding:8px 10px;">Gothram</th>
            <th style="padding:8px 10px;">Nakshatram</th>
            <th style="padding:8px 10px;">Rasi</th>
          </tr>
        </thead>
        <tbody>${memberRows}</tbody>
      </table>`
      : '';

  const deliveryRow = isCorpus
    ? ''
    : `
            <tr>
              <td style="padding:6px 0;color:#666;">Prasadam Delivery:</td>
              <td style="padding:6px 0;">${esc(deliveryText)}</td>
            </tr>`;

  const noticeText = isCorpus
    ? 'Thank you for your contribution to the corpus fund. Please keep this receipt for your records.'
    : 'Ashram Pandits will perform the sankalpam on the selected date. Consecrated puja prasadam will be arranged according to your selected preference.';

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${isCorpus ? 'Contribution Receipt' : 'Seva Booking Confirmation'}</title>
</head>
<body style="font-family:Arial,sans-serif;background:#fffdfa;color:#333;margin:0;padding:16px;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:650px;margin:0 auto;background:#ffffff;border:1px solid #ebd8b8;">
    <tr>
      <td style="background:#3b0d0d;color:#ffffff;padding:22px 26px;">
        <div style="font-size:20px;font-weight:bold;">Sri Swami Chidbhavananda Ashramam</div>
        <div style="margin-top:4px;font-size:13px;color:#fbbf24;">${isCorpus ? 'Official Contribution Receipt' : 'Official Seva Sankalpam Receipt'}</div>
      </td>
    </tr>
    <tr>
      <td style="padding:22px 26px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="border-bottom:1px solid #ebd8b8;margin-bottom:18px;">
          <tr>
            <td valign="top" style="padding-bottom:14px;">
              <div style="font-size:12px;color:#8a5a44;text-transform:uppercase;">Receipt Number</div>
              <div style="margin-top:2px;font-size:16px;font-weight:bold;color:#3b0d0d;">${esc(data.receiptNo)}</div>
            </td>
            <td valign="top" align="right" style="padding-bottom:14px;">
              <div style="font-size:12px;color:#8a5a44;text-transform:uppercase;">Transaction ID</div>
              <div style="margin-top:2px;font-size:13px;font-family:monospace;">${esc(data.paymentId)}</div>
            </td>
          </tr>
        </table>

        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:14px;">
          <tr>
            <td style="padding:6px 0;color:#666;width:40%;">${isCorpus ? 'Corpus Fund' : 'Seva Offering'}:</td>
            <td style="padding:6px 0;font-weight:bold;color:#3b0d0d;">${esc(data.sevaName)}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#666;">${dateLabel}:</td>
            <td style="padding:6px 0;font-weight:bold;">${esc(dateText)}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#666;">Primary Devotee:</td>
            <td style="padding:6px 0;font-weight:bold;">${esc(data.primaryDevotee.name)}${phone ? ` (${esc(phone)})` : ''}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#666;">${isCorpus ? 'Contribution Amount' : 'Total Offering Amount'}:</td>
            <td style="padding:6px 0;font-weight:bold;font-size:16px;color:#ea580c;">${esc(formatAmount(data.totalAmount))}</td>
          </tr>${deliveryRow}
        </table>

        ${membersBlock}

        <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:28px;">
          <tr>
            <td style="padding:14px 16px;background:#fff8ec;border-left:4px solid #ea580c;font-size:12px;color:#5b2a1a;line-height:1.6;">
              ${esc(noticeText)}
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td align="center" style="background:#faf6f0;padding:14px;font-size:11px;color:#8a5a44;border-top:1px solid #ebd8b8;">
        Vedaneri Ashram | Contact: ${esc(SUPPORT_EMAIL)}
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = [
    isCorpus ? 'Contribution Receipt' : 'Seva Booking Confirmation',
    `Receipt No: ${data.receiptNo}`,
    `${isCorpus ? 'Corpus Fund' : 'Seva'}: ${data.sevaName}`,
    `${dateLabel}: ${dateText}`,
    `Devotee: ${data.primaryDevotee.name}`,
    `Amount: ${formatAmount(data.totalAmount)}`,
    `Transaction ID: ${data.paymentId}`,
    '',
    noticeText,
    `Contact: ${SUPPORT_EMAIL}`,
  ].join('\n');

  return transporter.sendMail({
    from: `"${process.env.APP_NAME || 'Vedaneri Ashram'}" <${process.env.SMTP_FROM || MAIL_USER}>`,
    to: data.primaryDevotee.email,
    subject: `${isCorpus ? 'Contribution Receipt' : 'Seva Booking Confirmation & Sankalpam Receipt'} - ${data.receiptNo}`,
    text,
    html,
  });
}