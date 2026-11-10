import React from 'react';
import RegisterPage from './RegisterKit';

// Magazine register: every subscription with the postal address and the dates it runs. The page itself lives in RegisterKit.tsx.
export default function MagazineRegister() {
  return <RegisterPage kind="magazine" />;
}