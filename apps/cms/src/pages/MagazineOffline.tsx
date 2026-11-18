import React from 'react';
import RegisterPage from './RegisterKit';

// Magazine offline registration: a magazine subscription written in at the ashram. The page itself lives in RegisterKit.tsx.
export default function MagazineOffline() {
  return <RegisterPage kind="magazine" mode="offline" />;
}