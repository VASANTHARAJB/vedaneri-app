// DUMMY DATA. The CMS portal will replace this file: keep the shape, swap the source.
// The camp names, fees, dates, schedule and dress code below come from the design reference. They are placeholders,
// NOT confirmed by the ashram. The old website lists no camp at all, only a Google Form for upcoming camps.
// `fee: 0` would mean "no fee shown".

import type { L } from './sevas';

export type CampKind = 'dharma' | 'yogam' | 'vedanta';

export type Camp = {
  slug: string;
  kind: CampKind;
  name: L;
  when: L;                 // shown on the card
  from: string;            // first day (YYYY-MM-DD)
  to: string;              // last day
  fee: number;             // per person, in rupees
  includes: L;             // line under the date
  desc: L;
  photo: string;           // picture in /public/images
  status: 'open' | 'closed';
  schedule: { time: string; text: L }[];   // indicative daily schedule; may be empty
};

export const CAMPS: Camp[] = [
  {
    slug: 'dharma-deepika-family-camp', kind: 'dharma', fee: 1200, status: 'open', from: '2027-01-09', to: '2027-01-10',
    name: { en: 'Dharma Deepika Family Camp', ta: 'தர்ம தீபிகா குடும்ப முகாம்' },
    when: { en: '09 – 10 Jan 2027', ta: '09 – 10 ஜன 2027' },
    includes: { en: 'All meals & lodging included', ta: 'உணவும் தங்குமிடமும் உட்பட' },
    desc: { en: 'Moral and Vedic foundation guidelines for family life.', ta: 'குடும்ப வாழ்விற்கான அறமும் வேத அடிப்படையும் குறித்த வழிகாட்டல்.' },
    photo: '/images/ashram-river.jpg',
    schedule: [
      { time: '05:00 AM - 06:00 AM', text: { en: 'Pratah Smaranam & Guided Meditation', ta: 'ப்ராத ஸ்மரணம் மற்றும் வழிகாட்டப்பட்ட தியானம்' } },
      { time: '07:30 AM - 08:30 AM', text: { en: 'Yogasana & Pranayama Session', ta: 'யோகாசனம் மற்றும் பிராணாயாமப் பயிற்சி' } },
      { time: '10:00 AM - 11:30 AM', text: { en: 'Upanishad Bhashya lecture by Acharya', ta: 'ஆசார்யரின் உபநிஷத பாஷ்ய சொற்பொழிவு' } },
      { time: '06:00 PM - 08:00 PM', text: { en: 'Ashram Satsang & Traditional Vedic Aarati', ta: 'ஆசிரம சத்சங்கம் மற்றும் பாரம்பரிய வேத ஆரத்தி' } },
    ],
  },
  {
    slug: 'youth-womens-gnanadeepika', kind: 'dharma', fee: 1200, status: 'open', from: '2027-02-27', to: '2027-02-28',
    name: { en: 'Youth & Women’s Gnanadeepika', ta: 'இளைஞர் மற்றும் மகளிர் ஞானதீபிகா' },
    when: { en: '27 – 28 Feb 2027', ta: '27 – 28 பிப் 2027' },
    includes: { en: 'All meals & lodging included', ta: 'உணவும் தங்குமிடமும் உட்பட' },
    desc: { en: 'Focused introspection, mind culture classes, and classical yogas.', ta: 'உள்நோக்கிய சிந்தனை, மன வளப் பயிற்சி மற்றும் பாரம்பரிய யோகங்கள்.' },
    photo: '/images/ashram-vidyapitham.jpg', schedule: [],
  },
  {
    slug: 'thayumanavar-padalgal-anthar-yogam', kind: 'yogam', fee: 1800, status: 'open', from: '2027-03-12', to: '2027-03-15',
    name: { en: 'Thayumanavar Padalgal Anthar Yogam', ta: 'தாயுமானவர் பாடல்கள் அந்தர் யோகம்' },
    when: { en: '12 – 15 Mar 2027', ta: '12 – 15 மார் 2027' },
    includes: { en: 'All meals & lodging included', ta: 'உணவும் தங்குமிடமும் உட்பட' },
    desc: { en: 'Silent retreat centred on traditional non-dual hymns, meditation guidance.', ta: 'பாரம்பரிய அத்வைதப் பாடல்களை மையமாகக் கொண்ட மௌன முகாம்; தியான வழிகாட்டல்.' },
    photo: '/images/ashram-patashala.jpg', schedule: [],
  },
  {
    slug: 'one-month-intensive-vedanta-camp', kind: 'vedanta', fee: 15000, status: 'open', from: '2027-04-01', to: '2027-04-30',
    name: { en: 'One-Month Intensive Vedanta Camp', ta: 'ஒரு மாத தீவிர வேதாந்த முகாம்' },
    when: { en: '01 – 30 Apr 2027', ta: '01 – 30 ஏப் 2027' },
    includes: { en: 'All meals & lodging included', ta: 'உணவும் தங்குமிடமும் உட்பட' },
    desc: { en: 'In-depth Prasthana Thraya residential study with resident Acharyas.', ta: 'ஆசிரம ஆசார்யர்களுடன் பிரஸ்தான த்ரய ஆழ்ந்த உறைவிடப் படிப்பு.' },
    photo: '/images/ashram-classroom.jpg', schedule: [],
  },
];

export const getCamp = (slug: string) => CAMPS.find((c) => c.slug === slug);

// The ashram's own sign-up form for upcoming camps (from the old website)
export const CAMP_GOOGLE_FORM = 'https://forms.gle/BUEq7R5Jvou7DybB7';

// Dress code shown beside the form. Placeholder text from the design reference: the ashram must confirm it.
export const DRESS_CODE: L = {
  en: 'Devotees must wear traditional Indian attire (dhoti/kurta for men, saree/salwar for women). Maintain complete silence during specified hours. Smoking and alcohol are strictly forbidden.',
  ta: 'பக்தர்கள் பாரம்பரிய இந்திய உடை அணிய வேண்டும் (ஆண்களுக்கு வேட்டி/குர்தா, பெண்களுக்கு புடவை/சல்வார்). குறிப்பிட்ட நேரங்களில் முழு மௌனம் காக்க வேண்டும். புகைபிடித்தல் மற்றும் மது கண்டிப்பாகத் தடை.',
};
