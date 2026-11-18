import React from 'react';
import RegisterPage from './RegisterKit';

// Donation offline registration: a donation written in at the ashram. The page itself lives in RegisterKit.tsx.
export default function DonationOffline() {
  return <RegisterPage kind="donation" mode="offline" />;
}