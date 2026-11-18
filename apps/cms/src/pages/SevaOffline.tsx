import React from 'react';
import RegisterPage from './RegisterKit';

// Seva offline registration: a seva booking written in at the ashram. The page itself lives in RegisterKit.tsx.
export default function SevaOffline() {
  return <RegisterPage kind="seva" mode="offline" />;
}