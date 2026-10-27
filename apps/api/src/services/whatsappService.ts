export interface WhatsAppNotificationPayload {
  receiptNo: string;
  phone: string;
  devoteeName: string;
  sevaName: string;
  bookingDate: string;
  amount: number;
  category?: 'seva' | 'corpus';
}

const WORKER_URL = process.env.WORKER_URL || 'http://localhost:8000';
// Set WHATSAPP_ENABLED=false in .env to skip WhatsApp until the setup is finished
const ENABLED = process.env.WHATSAPP_ENABLED !== 'false';

// Keeps the country code. A bare 10-digit number is treated as Indian (91).
function normalizePhone(raw: string): string {
  const digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 11 && digits.startsWith('0')) return `91${digits.slice(1)}`;
  return digits;
}

function formatDate(v?: string): string {
  const m = String(v || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : String(v || '');
}

function buildMessage(p: WhatsAppNotificationPayload): string {
  const isCorpus = p.category === 'corpus';
  const amount = `INR ${Number(p.amount || 0).toLocaleString('en-IN')}`;
  const lines = [
    `Namaste ${p.devoteeName},`,
    isCorpus
      ? 'Your contribution has been received. Thank you.'
      : 'Your seva booking is confirmed.',
    '',
    `${isCorpus ? 'Fund' : 'Seva'}: ${p.sevaName}`,
    `${isCorpus ? 'Contribution Date' : 'Ritual Date'}: ${formatDate(p.bookingDate)}`,
    `Amount: ${amount}`,
    `Receipt No: ${p.receiptNo}`,
    '',
    'A detailed receipt has been sent to your email.',
    '- Vedaneri Ashram',
  ];
  return lines.join('\n');
}

export async function sendBookingWhatsAppNotification(payload: WhatsAppNotificationPayload) {
  if (!ENABLED) {
    return { success: false, skipped: true };
  }

  const phone = normalizePhone(payload.phone);
  if (!phone) {
    console.warn('[WhatsApp Worker]: No phone number, notification skipped');
    return { success: false, error: 'missing_phone' };
  }

  const requestBody = {
    phone, // full number with country code, e.g. 919876543210
    devotee_name: payload.devoteeName,
    seva_name: payload.sevaName,
    booking_date: payload.bookingDate,
    receipt_no: payload.receiptNo,
    amount: payload.amount,
    category: payload.category || 'seva',
    message_text: buildMessage(payload), // plain text only, no attachment
    notification_type: 'seva_booking_receipt',
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4000);

  try {
    const response = await fetch(`${WORKER_URL}/whatsapp/send-booking-receipt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    if (!response.ok) {
      console.warn(`[WhatsApp Worker Warning]: Worker returned HTTP ${response.status}`);
      return { success: false, status: response.status };
    }

    const data = await response.json().catch(() => ({}));
    console.log(`[WhatsApp Worker]: Queued for +${phone}`);
    return { success: true, data };
  } catch (err: any) {
    // Worker offline: the payment flow is not affected
    console.warn(`[WhatsApp Worker Unavailable]: Could not reach ${WORKER_URL} (${err.message})`);
    return { success: false, error: err.message };
  }
}