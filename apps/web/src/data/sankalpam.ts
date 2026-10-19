// DEFAULT LISTS for the sankalpam form. The CMS can replace these later.
// The value that is saved is the English name; the label shown follows the visitor's language.
// A devotee can also type a value that is not in a list (see ChoiceField).

import type { Locale } from '@/lib/i18n';
import type { L } from '@/data/sevas';

export type FamilyMember = { name: string; relation: string; rasi: string; nakshatram: string };

export const MAX_FAMILY = 10;

// 12 rasis (Moon signs)
export const RASIS: L[] = [
  { en: 'Mesham (Aries)', ta: 'மேஷம்' },
  { en: 'Rishabam (Taurus)', ta: 'ரிஷபம்' },
  { en: 'Mithunam (Gemini)', ta: 'மிதுனம்' },
  { en: 'Kadagam (Cancer)', ta: 'கடகம்' },
  { en: 'Simmam (Leo)', ta: 'சிம்மம்' },
  { en: 'Kanni (Virgo)', ta: 'கன்னி' },
  { en: 'Thulam (Libra)', ta: 'துலாம்' },
  { en: 'Viruchigam (Scorpio)', ta: 'விருச்சிகம்' },
  { en: 'Dhanusu (Sagittarius)', ta: 'தனுசு' },
  { en: 'Makaram (Capricorn)', ta: 'மகரம்' },
  { en: 'Kumbam (Aquarius)', ta: 'கும்பம்' },
  { en: 'Meenam (Pisces)', ta: 'மீனம்' },
];

// 27 nakshatrams (birth stars), in the Tamil spelling order
export const NAKSHATRAMS: L[] = [
  { en: 'Ashwini', ta: 'அசுவினி' },
  { en: 'Bharani', ta: 'பரணி' },
  { en: 'Krithigai', ta: 'கார்த்திகை' },
  { en: 'Rohini', ta: 'ரோகிணி' },
  { en: 'Mrigashirsham', ta: 'மிருகசீரிடம்' },
  { en: 'Thiruvathirai', ta: 'திருவாதிரை' },
  { en: 'Punarpoosam', ta: 'புனர்பூசம்' },
  { en: 'Poosam', ta: 'பூசம்' },
  { en: 'Ayilyam', ta: 'ஆயில்யம்' },
  { en: 'Magam', ta: 'மகம்' },
  { en: 'Pooram', ta: 'பூரம்' },
  { en: 'Uthiram', ta: 'உத்திரம்' },
  { en: 'Hastham', ta: 'அஸ்தம்' },
  { en: 'Chithirai', ta: 'சித்திரை' },
  { en: 'Swathi', ta: 'சுவாதி' },
  { en: 'Visakam', ta: 'விசாகம்' },
  { en: 'Anusham', ta: 'அனுஷம்' },
  { en: 'Kettai', ta: 'கேட்டை' },
  { en: 'Moolam', ta: 'மூலம்' },
  { en: 'Pooradam', ta: 'பூராடம்' },
  { en: 'Uthiradam', ta: 'உத்திராடம்' },
  { en: 'Thiruvonam', ta: 'திருவோணம்' },
  { en: 'Avittam', ta: 'அவிட்டம்' },
  { en: 'Sathayam', ta: 'சதயம்' },
  { en: 'Poorattathi', ta: 'பூரட்டாதி' },
  { en: 'Uthirattathi', ta: 'உத்திரட்டாதி' },
  { en: 'Revathi', ta: 'ரேவதி' },
];

// Commonly used gotrams. A starting set only: the ashram should review it,
// and anything missing can be typed by the devotee.
export const GOTRAMS: L[] = [
  { en: 'Agastya', ta: 'அகஸ்திய' },
  { en: 'Angirasa', ta: 'ஆங்கிரஸ' },
  { en: 'Atri', ta: 'அத்ரி' },
  { en: 'Athreya', ta: 'ஆத்ரேய' },
  { en: 'Bharadwaja', ta: 'பரத்வாஜ' },
  { en: 'Garga', ta: 'கர்க' },
  { en: 'Gautama', ta: 'கௌதம' },
  { en: 'Harita', ta: 'ஹாரீத' },
  { en: 'Jamadagni', ta: 'ஜமதக்னி' },
  { en: 'Kanva', ta: 'கண்வ' },
  { en: 'Kashyapa', ta: 'காஷ்யப' },
  { en: 'Kaundinya', ta: 'கௌண்டின்ய' },
  { en: 'Kaushika', ta: 'கௌசிக' },
  { en: 'Maudgalya', ta: 'மௌத்கல்ய' },
  { en: 'Parashara', ta: 'பராசர' },
  { en: 'Sandilya', ta: 'சாண்டில்ய' },
  { en: 'Srivatsa', ta: 'ஸ்ரீவத்ஸ' },
  { en: 'Upamanyu', ta: 'உபமன்யு' },
  { en: 'Vadhula', ta: 'வாதூல' },
  { en: 'Vasishta', ta: 'வசிஷ்ட' },
  { en: 'Vatsa', ta: 'வத்ஸ' },
  { en: 'Vishwamitra', ta: 'விஸ்வாமித்ர' },
];

export const RELATIONS: L[] = [
  { en: 'Spouse', ta: 'வாழ்க்கைத் துணை' },
  { en: 'Son', ta: 'மகன்' },
  { en: 'Daughter', ta: 'மகள்' },
  { en: 'Father', ta: 'தந்தை' },
  { en: 'Mother', ta: 'தாய்' },
  { en: 'Brother', ta: 'சகோதரர்' },
  { en: 'Sister', ta: 'சகோதரி' },
];

// Label to show for a saved value: the list's name in the visitor's language, or the typed text as it is
export const labelFor = (list: L[], value: string, locale: Locale) => list.find((i) => i.en === value)?.[locale] ?? value;
