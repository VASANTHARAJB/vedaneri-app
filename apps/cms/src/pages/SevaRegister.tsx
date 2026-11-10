import React from 'react';
import RegisterPage from './RegisterKit';

// Seva register: every seva booking with the sankalpam details. The page itself lives in RegisterKit.tsx.
export default function SevaRegister() {
  return <RegisterPage kind="seva" />;
}