// DUMMY DATA. The CMS portal will replace this file: keep the shape, swap the source.
// The 5 donation items come from the old site's Donation page. The two Corpus Fund items are placeholders.
// `amount: 0` means "as per the donor's wish".

import type { L } from './sevas';

export type DonationKind = 'donation' | 'corpus';

export type Donation = {
  slug: string;
  kind: DonationKind;
  name: L;
  amount: number;          // fixed amount in rupees; 0 = donor chooses
  minAmount: number;       // lowest amount a donor may choose (only when amount is 0)
  maxQty: number;
  status: 'open' | 'closed';
  description: { en: string[]; ta: string[] }; // paragraphs; empty until the ashram writes them
};

const base = { minAmount: 1, maxQty: 10, status: 'open' as const, description: { en: [], ta: [] } };

export const DONATIONS: Donation[] = [
  { ...base, slug: 'gurukanikkai', kind: 'donation', amount: 0,
    name: { en: 'Gurukanikkai', ta: 'குருகாணிக்கை' } },
  { ...base, slug: 'general-donation', kind: 'donation', amount: 0,
    name: { en: 'General Donation', ta: 'பொது நன்கொடை' } },
  { ...base, slug: 'veda-samrakshanam', kind: 'donation', amount: 3000,
    name: { en: 'Veda Samrakshanam', ta: 'வேத ஸம்ரக்ஷணம்' } },
  { ...base, slug: 'go-samrakshanam', kind: 'donation', amount: 3000,
    name: { en: 'Go Samrakshanam (One month for a cow)', ta: 'கோ ஸம்ரக்ஷணம் (ஒரு பசுவிற்கு ஒரு மாதம்)' } },
  { ...base, slug: 'vriksha-samrakshanam', kind: 'donation', amount: 2000,
    name: { en: 'Vriksha Samrakshanam', ta: 'விருக்ஷ சம்ரக்ஷணம்' } },

  // PLACEHOLDERS: replace with the real Corpus Fund items
  { ...base, slug: 'donation-corpus-fund', kind: 'corpus', amount: 0,
    name: { en: 'Corpus Fund', ta: 'கார்பஸ் நிதி' } },
  { ...base, slug: 'annadhanam-corpus-fund', kind: 'corpus', amount: 0,
    name: { en: 'Annadhanam Corpus Fund', ta: 'அன்னதான கார்பஸ் நிதி' } },
];

export const getDonation = (slug: string) => DONATIONS.find((d) => d.slug === slug);
