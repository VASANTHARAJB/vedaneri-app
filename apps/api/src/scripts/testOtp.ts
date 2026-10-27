import { sendOtpEmail } from '../lib/mailer';

const to = process.argv[2];
if (!to) {
  console.error('Usage: npx tsx src/scripts/testOtp.ts you@example.com');
  process.exit(1);
}

sendOtpEmail(to, '123456', 'Test')
  .then(() => console.log('OK: OTP email sent to', to, '- check the inbox AND spam folder.'))
  .catch((e) => {
    console.error('FAILED:', e?.code || '', e?.message || e);
    process.exit(1);
  });