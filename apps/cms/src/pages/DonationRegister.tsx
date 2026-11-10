import React from 'react';
import RegisterPage from './RegisterKit';

// Donation register: every donation and corpus gift with the sankalpam details. The page itself lives in RegisterKit.tsx.
export default function DonationRegister() {
  return <RegisterPage kind="donation" />;
}