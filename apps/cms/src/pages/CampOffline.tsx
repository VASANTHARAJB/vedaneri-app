import React from 'react';
import RegisterPage from './RegisterKit';

// Camp offline registration: a camp registration written in at the ashram. The page itself lives in RegisterKit.tsx.
export default function CampOffline() {
  return <RegisterPage kind="camp" mode="offline" />;
}