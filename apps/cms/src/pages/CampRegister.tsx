import React from 'react';
import RegisterPage from './RegisterKit';

// Camp register: every camp registration with adults, children and the people named. The page itself lives in RegisterKit.tsx.
export default function CampRegister() {
  return <RegisterPage kind="camp" />;
}