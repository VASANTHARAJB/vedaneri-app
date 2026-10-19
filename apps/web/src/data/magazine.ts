// DUMMY DATA. The CMS portal will replace this file: keep the shape, swap the source.
// Plans and prices are from the old website's Magazine page (Annual Rs. 600, Two Year Rs. 1200, Five Year Rs. 3000).
// The old page does not say how many issues a plan has; "monthly" and 12 issues a year are assumed until the ashram confirms.
// The issues in the digital archive are placeholders from the design reference, not the real back issues.

import type { L } from './sevas';

export type Plan = {
  slug: string;
  years: number;
  price: number;           // rupees for the whole plan
  name: L;
  featured?: boolean;
};

export const ISSUES_PER_YEAR = 12;

export const PLANS: Plan[] = [
  { slug: 'magazine-1-year', years: 1, price: 600, name: { en: '1-Year Membership', ta: '1 ஆண்டு உறுப்பினர்' } },
  { slug: 'magazine-2-year', years: 2, price: 1200, name: { en: '2-Year Membership', ta: '2 ஆண்டு உறுப்பினர்' } },
  { slug: 'magazine-5-year', years: 5, price: 3000, name: { en: '5-Year Membership', ta: '5 ஆண்டு உறுப்பினர்' }, featured: true },
];

export const getPlan = (slug: string) => PLANS.find((p) => p.slug === slug);

export type Issue = {
  id: string;
  year: number;
  month: number;           // 1-12
  title: L;
  desc: L;
  cover: string;           // picture in /public/images
  pdf: string;             // '' until the file is uploaded (put it in /public/magazine/)
  readUrl: string;         // '' until an online reader link exists
};

export const ISSUES: Issue[] = [
  { id: '2026-01', year: 2026, month: 1, cover: '/images/ashram-vidyapitham.jpg', pdf: '', readUrl: '',
    title: { en: 'Mandukya Upanishad Rahasyam', ta: 'மாண்டூக்ய உபநிஷத ரகசியம்' },
    desc: { en: 'Understanding the state of Turiya and the deep significance of Pranava Pranayama.', ta: 'துரீய நிலையும் பிரணவ பிராணாயாமத்தின் ஆழ்ந்த பொருளும்.' } },
  { id: '2025-12', year: 2025, month: 12, cover: '/images/ashram-patashala.jpg', pdf: '', readUrl: '',
    title: { en: 'Thayumanavar Siddhantha Deepam', ta: 'தாயுமானவர் சித்தாந்த தீபம்' },
    desc: { en: 'Exploring non-dualistic devotional hymns and paths of mental tranquility.', ta: 'அத்வைத பக்திப் பாடல்களும் மன அமைதிக்கான வழிகளும்.' } },
  { id: '2025-11', year: 2025, month: 11, cover: '/images/festival.jpg', pdf: '', readUrl: '',
    title: { en: 'The Essence of Gita Chapter 12', ta: 'கீதை 12-ஆம் அத்தியாயத்தின் சாரம்' },
    desc: { en: 'Sadhana practices of a true devotee as expounded by Swamiji.', ta: 'ஸ்வாமிஜி விளக்கியபடி உண்மையான பக்தனின் சாதனைப் பயிற்சிகள்.' } },
  { id: '2025-10', year: 2025, month: 10, cover: '/images/ashram-classroom.jpg', pdf: '', readUrl: '',
    title: { en: 'Thirukkural and Vedanta', ta: 'திருக்குறளும் வேதாந்தமும்' },
    desc: { en: 'How the Kural points to the same truths as the Upanishads.', ta: 'உபநிஷதங்கள் கூறும் உண்மைகளையே குறள் எவ்வாறு சுட்டுகிறது.' } },
  { id: '2024-12', year: 2024, month: 12, cover: '/images/ashram-river.jpg', pdf: '', readUrl: '',
    title: { en: 'Guru Puja and the Guru Tradition', ta: 'குரு பூஜையும் குரு பரம்பரையும்' },
    desc: { en: 'The meaning of Guru Puja and the lineage of the ashram.', ta: 'குரு பூஜையின் பொருளும் ஆசிரமத்தின் குரு பரம்பரையும்.' } },
  { id: '2024-06', year: 2024, month: 6, cover: '/images/ashram-vilasa.jpg', pdf: '', readUrl: '',
    title: { en: 'Daily Sadhana for Householders', ta: 'இல்லறத்தாருக்கான தினசரி சாதனை' },
    desc: { en: 'A simple daily routine of prayer, study and service.', ta: 'பிரார்த்தனை, படிப்பு, சேவை அடங்கிய எளிய தினசரி வழக்கம்.' } },
  { id: '2023-03', year: 2023, month: 3, cover: '/images/ashram-dining.jpg', pdf: '', readUrl: '',
    title: { en: 'Annadhanam: Feeding as Worship', ta: 'அன்னதானம்: உணவளித்தலே வழிபாடு' },
    desc: { en: 'Why feeding others is held as a form of worship.', ta: 'பிறருக்கு உணவளிப்பது ஏன் வழிபாடாகக் கருதப்படுகிறது.' } },
  { id: '2022-08', year: 2022, month: 8, cover: '/images/ashram-ghosala.jpg', pdf: '', readUrl: '',
    title: { en: 'Care of the Cow', ta: 'பசு பராமரிப்பு' },
    desc: { en: 'The place of the cow in the ashram and in tradition.', ta: 'ஆசிரமத்திலும் மரபிலும் பசுவின் இடம்.' } },
];

export const MONTHS_LONG: Record<'en' | 'ta', string[]> = {
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  ta: ['ஜனவரி', 'பிப்ரவரி', 'மார்ச்', 'ஏப்ரல்', 'மே', 'ஜூன்', 'ஜூலை', 'ஆகஸ்ட்', 'செப்டம்பர்', 'அக்டோபர்', 'நவம்பர்', 'டிசம்பர்'],
};
