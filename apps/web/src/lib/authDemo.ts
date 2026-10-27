// DEMO ONLY. Accounts live in this browser's localStorage so the screens can be tested without a backend.
// When the API exists, replace every function here with a call to the server. The server must hash passwords (Argon2/bcrypt),
// encrypt Aadhaar/PAN at rest, rate-limit login, and verify the captcha token itself. Nothing in the browser can do that safely.
// Aadhaar, PAN and the password itself are NEVER saved here: only the last 4 digits / a masked PAN and a salted hash.

import type { FamilyMember } from '@/data/sankalpam';

export type Account = {
  id: string; first: string; last: string; email: string; phone: string;
  rasi: string; nakshatram: string; gotram: string;
  aadhaarLast4: string; panMasked: string; hasPhoto: boolean;
  salt: string; hash: string; createdAt: string;
  family?: FamilyMember[];   // family members for sankalpams (profile page)
  photo?: string;            // small profile picture (256 px data URL), demo only
  updatedAt?: string;
};

const KEY_ACCOUNTS = 'vedaneri.accounts.v1';
const KEY_SESSION = 'vedaneri.session.v1';

function read<T>(key: string, fallback: T): T {
  try { const r = window.localStorage.getItem(key); return r ? (JSON.parse(r) as T) : fallback; } catch { return fallback; }
}
function write(key: string, value: unknown) {
  try { window.localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage can be blocked */ }
}

export const normPhone = (v: string) => v.replace(/[\s-]/g, '').replace(/^(\+91|0)/, '');
export const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
export const isPhone = (v: string) => /^[6-9]\d{9}$/.test(normPhone(v));

export async function hashPassword(password: string, salt: string) {
  const data = new TextEncoder().encode(salt + password);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
export const newSalt = () => Array.from(crypto.getRandomValues(new Uint8Array(12))).map((b) => b.toString(16).padStart(2, '0')).join('');

export const accounts = () => read<Account[]>(KEY_ACCOUNTS, []);
export function findAccount(idOrEmailOrPhone: string) {
  const v = idOrEmailOrPhone.trim().toLowerCase();
  const ph = normPhone(v);
  return accounts().find((a) => a.email.toLowerCase() === v || (isPhone(ph) && a.phone === ph));
}
export const saveAccount = (a: Account) => write(KEY_ACCOUNTS, [...accounts(), a]);
export const SESSION_EVENT = 'vedaneri-session';
export type Session = { id: string; name: string; at: string };

export const startSession = (a: Account, remember: boolean) => {
  const s: Session = { id: a.id, name: `${a.first} ${a.last}`.trim(), at: new Date().toISOString() };
  try { (remember ? window.localStorage : window.sessionStorage).setItem(KEY_SESSION, JSON.stringify(s)); } catch { /* ignore */ }
  try { window.dispatchEvent(new Event(SESSION_EVENT)); } catch { /* ignore */ }
  return s;
};

// The signed-in visitor, if any (checked in both browser stores)
export function getSession(): Session | null {
  try {
    const raw = window.localStorage.getItem(KEY_SESSION) ?? window.sessionStorage.getItem(KEY_SESSION);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch { return null; }
}
export function endSession() {
  try { window.localStorage.removeItem(KEY_SESSION); window.sessionStorage.removeItem(KEY_SESSION); } catch { /* ignore */ }
  try { window.dispatchEvent(new Event(SESSION_EVENT)); } catch { /* ignore */ }
}
export const getAccount = (id: string) => accounts().find((a) => a.id === id) ?? null;
export const updateAccount = (a: Account) => write(KEY_ACCOUNTS, accounts().map((x) => (x.id === a.id ? { ...a, updatedAt: new Date().toISOString() } : x)));
export const deleteAccount = (id: string) => write(KEY_ACCOUNTS, accounts().filter((x) => x.id !== id));

// Shrinks a picked photo to a small square-ish JPEG so it fits in browser storage (demo only; the server will keep the real file)
export function resizeImage(file: File, max = 256): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d')?.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('image')); };
    img.src = url;
  });
}

// Password rules: 8+ characters with upper case, lower case, a digit and a special character
export const PASSWORD_RULES = {
  len: (p: string) => p.length >= 8,
  upper: (p: string) => /[A-Z]/.test(p),
  lower: (p: string) => /[a-z]/.test(p),
  digit: (p: string) => /\d/.test(p),
  special: (p: string) => /[^A-Za-z0-9\s]/.test(p),
} as const;
export type RuleKey = keyof typeof PASSWORD_RULES;
export const passwordScore = (p: string) => (Object.keys(PASSWORD_RULES) as RuleKey[]).filter((k) => PASSWORD_RULES[k](p)).length + (p.length >= 12 ? 1 : 0);

// PAN: 5 letters, 4 digits, 1 letter (the 4th letter is the holder type)
export const isPan = (v: string) => /^[A-Z]{3}[ABCFGHLJPT][A-Z]\d{4}[A-Z]$/.test(v.toUpperCase());

// Aadhaar: 12 digits, first digit 2-9, last digit is a Verhoeff check digit
const D = [[0,1,2,3,4,5,6,7,8,9],[1,2,3,4,0,6,7,8,9,5],[2,3,4,0,1,7,8,9,5,6],[3,4,0,1,2,8,9,5,6,7],[4,0,1,2,3,9,5,6,7,8],[5,9,8,7,6,0,4,3,2,1],[6,5,9,8,7,1,0,4,3,2],[7,6,5,9,8,2,1,0,4,3],[8,7,6,5,9,3,2,1,0,4],[9,8,7,6,5,4,3,2,1,0]];
const P = [[0,1,2,3,4,5,6,7,8,9],[1,5,7,6,2,8,3,0,9,4],[5,8,0,3,7,9,6,1,4,2],[8,9,1,6,0,4,3,5,2,7],[9,4,5,3,1,2,6,8,7,0],[4,2,8,6,5,7,3,9,0,1],[2,7,9,3,8,0,6,4,1,5],[7,0,4,6,9,1,3,2,5,8]];
export function isAadhaar(v: string) {
  const d = v.replace(/\s/g, '');
  if (!/^[2-9]\d{11}$/.test(d)) return false;
  let c = 0;
  d.split('').reverse().forEach((ch, i) => { c = D[c][P[i % 8][Number(ch)]]; });
  return c === 0;
}
