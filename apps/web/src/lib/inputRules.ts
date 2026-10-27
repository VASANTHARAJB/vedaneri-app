// Letters in any language (Tamil included), spaces, and . ' - for names
const NAME_BAD = /[^\p{L}\p{M} .'-]/gu;
// Address: letters, digits, spaces and , . - / # ( )
const ADDRESS_BAD = /[^\p{L}\p{M}\p{N} ,.\-/#()]/gu;
// City and state: letters, spaces, . -
const PLACE_BAD = /[^\p{L}\p{M} .-]/gu;
// Email: letters, digits and . _ + - @
const EMAIL_BAD = /[^A-Za-z0-9._+\-@]/g;

export const cleanName = (v: string) => v.replace(NAME_BAD, '').replace(/\s{2,}/g, ' ').slice(0, 60);
export const cleanAddress = (v: string) => v.replace(ADDRESS_BAD, '').slice(0, 300);
export const cleanPlace = (v: string) => v.replace(PLACE_BAD, '').slice(0, 60);
export const cleanPhone = (v: string) => v.replace(/\D/g, '').slice(0, 15);
export const cleanEmail = (v: string) => v.replace(EMAIL_BAD, '').toLowerCase().slice(0, 100);

export const isValidName = (v: string) => /^[\p{L}\p{M}][\p{L}\p{M} .'-]{0,59}$/u.test(v.trim());
export const isValidPlace = (v: string) => /^[\p{L}\p{M}][\p{L}\p{M} .-]{0,59}$/u.test(v.trim());
export const isValidAddress = (v: string) => v.trim().length >= 5 && !/[^\p{L}\p{M}\p{N} ,.\-/#()]/u.test(v);
export const isValidPhone = (v: string) => /^\d{6,15}$/.test(v);
export const isValidEmail = (v: string) =>
  /^[A-Za-z0-9._+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$/.test(v) && v.length <= 100;