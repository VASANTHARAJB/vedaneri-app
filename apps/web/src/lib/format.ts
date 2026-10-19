import type { Locale } from './i18n';

const MONTHS: Record<Locale, string[]> = {
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  ta: ['ஜன', 'பிப்', 'மார்', 'ஏப்', 'மே', 'ஜூன்', 'ஜூலை', 'ஆக', 'செப்', 'அக்', 'நவ', 'டிச'],
};

export const WEEKDAYS: Record<Locale, string[]> = {
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  ta: ['ஞாயிற்றுக்கிழமை', 'திங்கட்கிழமை', 'செவ்வாய்க்கிழமை', 'புதன்கிழமை', 'வியாழக்கிழமை', 'வெள்ளிக்கிழமை', 'சனிக்கிழமை'],
};

// 12345 -> "₹12,345"
export const rupees = (n: number) => `₹${new Intl.NumberFormat('en-IN').format(n)}`;

// "2026-10-25" -> "25 Oct 2026". Done by hand so the server and the browser always print the same text.
export function formatDate(iso: string, locale: Locale) {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS[locale][m - 1]} ${y}`;
}

// Today as "YYYY-MM-DD" in the visitor's own time zone
export function todayISO() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

// "2026-10-25" -> 0..6 (Sunday = 0)
export const weekdayOf = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).getDay();
};

// Seva photo: /images/sevas/<slug>.jpg, with a gradient until the photo exists
const FALLBACK = 'linear-gradient(135deg, #7A1C1C 0%, #D97706 140%)';
export const sevaPhoto = (slug: string) => `url('/images/sevas/${slug}.jpg'), ${FALLBACK}`;
