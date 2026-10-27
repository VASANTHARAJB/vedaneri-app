import 'dotenv/config';
import nodemailer from 'nodemailer';
import { sendBookingReceiptEmail } from '../services/emailService';

async function main() {
  const to = process.argv[2];
  if (!to) {
    console.error('Usage: npx tsx src/scripts/testEmail.ts your-email@example.com');
    process.exit(1);
  }

  console.log('SMTP_HOST   :', process.env.SMTP_HOST || '(default smtp.gmail.com)');
  console.log('SMTP_PORT   :', process.env.SMTP_PORT || '(default 587)');
  console.log('SMTP_SECURE :', process.env.SMTP_SECURE || '(not set)');
  console.log('SMTP_USER   :', process.env.SMTP_USER ? 'set' : 'MISSING');
  console.log('SMTP_PASS   :', process.env.SMTP_PASS ? 'set' : 'MISSING');
  console.log('SMTP_FROM   :', process.env.SMTP_FROM || '(will use SMTP_USER)');
  console.log('');

  // Step 1: check the SMTP login without sending anything
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: process.env.SMTP_USER || '', pass: process.env.SMTP_PASS || '' },
  });

  try {
    await transporter.verify();
    console.log('STEP 1 OK: SMTP login works.\n');
  } catch (err: any) {
    console.error('STEP 1 FAILED: SMTP login does not work.');
    console.error('Reason:', err?.message || err);
    process.exit(1);
  }

  // Step 2: send a sample Seva receipt
  try {
    const r1 = await sendBookingReceiptEmail({
      receiptNo: 'TEST-SEVA-001',
      category: 'seva',
      bookingDate: '2026-10-30',
      sevaName: 'Test Seva (sample)',
      totalAmount: 1008,
      paymentId: 'pay_TEST123456',
      primaryDevotee: { name: 'Test Devotee', email: to, phone: '+919876543210' },
      sankalpamMembers: [
        { title: 'Sri', name: 'Test Member', gothram: 'Parasara', nakshathiram: 'Vishakha', rasi: 'Kumbha', relation: 'Self' },
      ],
      deliveryType: 'courier',
      deliveryAddress: { comm_address: '12 Test Street', city: 'Coimbatore', state: 'Tamil Nadu' },
    });
    console.log('STEP 2 OK: Seva receipt sent. Message id:', (r1 as any)?.messageId);
  } catch (err: any) {
    console.error('STEP 2 FAILED (Seva receipt):', err?.message || err);
    process.exit(1);
  }

  // Step 3: send a sample Corpus receipt
  try {
    const r2 = await sendBookingReceiptEmail({
      receiptNo: 'TEST-CORPUS-001',
      category: 'corpus',
      bookingDate: '2026-10-30',
      sevaName: 'Test Corpus Fund (sample)',
      totalAmount: 500,
      paymentId: 'pay_TEST654321',
      primaryDevotee: { name: 'Test Devotee', email: to, phone: '+919876543210' },
      sankalpamMembers: [],
      deliveryType: 'pickup',
    });
    console.log('STEP 3 OK: Corpus receipt sent. Message id:', (r2 as any)?.messageId);
  } catch (err: any) {
    console.error('STEP 3 FAILED (Corpus receipt):', err?.message || err);
    process.exit(1);
  }

  console.log('\nDone. Check the inbox AND the spam folder of', to);
}

main();