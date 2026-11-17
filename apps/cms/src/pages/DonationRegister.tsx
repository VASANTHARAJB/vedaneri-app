import React from 'react';
import RegisterPage from './RegisterKit';
import Donation80gCard from './Donation80gCard';

// Donation register: every donation and corpus gift with the sankalpam details. The page itself lives in RegisterKit.tsx.
// Admins also get the 80G donations card (list and file for 80G receipts) above the register.
export default function DonationRegister() {
  return (
    <>
      <Donation80gCard />
      <RegisterPage kind="donation" />
    </>
  );
}