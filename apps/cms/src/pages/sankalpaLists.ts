// The choices offered in the on-site entry form. A value is stored in English and shown with its Tamil name.
// Each list of a person's details also has "N/A" for a devotee who prefers not to give it.

export const NA = 'N/A';
export type Choice = { value: string; ta?: string };

export const RELATIONS: Choice[] = ['Self', 'Husband', 'Wife', 'Father', 'Mother', 'Son', 'Daughter', 'Brother', 'Sister', 'Grandfather', 'Grandmother', 'Grandson', 'Granddaughter', 'Father-in-law', 'Mother-in-law', 'Son-in-law', 'Daughter-in-law', 'Uncle', 'Aunt', 'Nephew', 'Niece', 'Friend', 'Guru', 'Ancestors (Pitru)'].map((value) => ({ value }));

const RASI: [string, string][] = [
  ['Mesham', 'மேஷம்'], ['Rishabam', 'ரிஷபம்'], ['Mithunam', 'மிதுனம்'], ['Kadagam', 'கடகம்'], ['Simmam', 'சிம்மம்'], ['Kanni', 'கன்னி'],
  ['Thulam', 'துலாம்'], ['Viruchigam', 'விருச்சிகம்'], ['Dhanusu', 'தனுசு'], ['Makaram', 'மகரம்'], ['Kumbam', 'கும்பம்'], ['Meenam', 'மீனம்'],
];
export const RASIS: Choice[] = RASI.map(([value, ta]) => ({ value, ta }));
const NAKSHATRA: [string, string][] = [
  ['Ashwini', 'அஸ்வினி'], ['Bharani', 'பரணி'], ['Krittika', 'கார்த்திகை'], ['Rohini', 'ரோகிணி'], ['Mrigashira', 'மிருகசீரிஷம்'], ['Ardra', 'திருவாதிரை'],
  ['Punarvasu', 'புனர்பூசம்'], ['Pushya', 'பூசம்'], ['Ashlesha', 'ஆயில்யம்'], ['Magha', 'மகம்'], ['Purva Phalguni', 'பூரம்'], ['Uttara Phalguni', 'உத்திரம்'],
  ['Hasta', 'அஸ்தம்'], ['Chitra', 'சித்திரை'], ['Swati', 'சுவாதி'], ['Vishakha', 'விசாகம்'], ['Anuradha', 'அனுஷம்'], ['Jyeshtha', 'கேட்டை'],
  ['Mula', 'மூலம்'], ['Purva Ashadha', 'பூராடம்'], ['Uttara Ashadha', 'உத்திராடம்'], ['Shravana', 'திருவோணம்'], ['Dhanishta', 'அவிட்டம்'],
  ['Shatabhisha', 'சதயம்'], ['Purva Bhadrapada', 'பூரட்டாதி'], ['Uttara Bhadrapada', 'உத்திரட்டாதி'], ['Revati', 'ரேவதி'],
];
export const NAKSHATRAS: Choice[] = NAKSHATRA.map(([value, ta]) => ({ value, ta }));

// The common gothrams. The list cannot cover every gothram, so the form also lets the person type another one.
const GOTHRA: [string, string][] = [
  ['Agastya', 'அகஸ்திய'], ['Angirasa', 'ஆங்கீரஸ'], ['Athreya', 'ஆத்ரேய'], ['Atri', 'அத்ரி'], ['Bharadwaja', 'பரத்வாஜ'], ['Garga', 'கர்க'],
  ['Gautama', 'கௌதம'], ['Harita', 'ஹாரித'], ['Jamadagni', 'ஜமதக்னி'], ['Kanva', 'கண்வ'], ['Kapi', 'கபி'], ['Kashyapa', 'காஸ்யப'],
  ['Kaundinya', 'கௌண்டின்ய'], ['Kaushika', 'கௌசிக'], ['Kutsa', 'குத்ஸ'], ['Maudgalya', 'மௌத்கல்ய'], ['Mudgala', 'முத்கல'], ['Naidhruva', 'நைத்ருவ'],
  ['Parasara', 'பராசர'], ['Sandilya', 'சாண்டில்ய'], ['Shaunaka', 'சௌனக'], ['Srivatsa', 'ஸ்ரீவத்ஸ'], ['Upamanyu', 'உபமன்யு'], ['Vadhula', 'வாதூல'],
  ['Vasishta', 'வசிஷ்ட'], ['Vatsa', 'வத்ஸ'], ['Vishwamitra', 'விஸ்வாமித்ர'],
];
export const GOTHRAMS: Choice[] = GOTHRA.map(([value, ta]) => ({ value, ta }));

// English name to Tamil name, for the printed form
const TAMIL = new Map<string, string>();
for (const c of [...RASIS, ...NAKSHATRAS, ...GOTHRAMS]) if (c.ta) TAMIL.set(c.value.toLowerCase(), c.ta);
export const tamilOf = (value: string | undefined): string => {
  const v = String(value ?? '').trim();
  return TAMIL.get(v.toLowerCase()) || v;
};

// Country codes for the mobile number. India comes first. A code shared by two countries is listed once.
export const COUNTRIES: [string, string][] = [
  ['91', 'India'], ['93', 'Afghanistan'], ['355', 'Albania'], ['213', 'Algeria'], ['376', 'Andorra'], ['244', 'Angola'], ['54', 'Argentina'], ['374', 'Armenia'],
  ['61', 'Australia'], ['43', 'Austria'], ['994', 'Azerbaijan'], ['973', 'Bahrain'], ['880', 'Bangladesh'], ['375', 'Belarus'], ['32', 'Belgium'], ['501', 'Belize'],
  ['229', 'Benin'], ['975', 'Bhutan'], ['591', 'Bolivia'], ['387', 'Bosnia and Herzegovina'], ['267', 'Botswana'], ['55', 'Brazil'], ['673', 'Brunei'], ['359', 'Bulgaria'],
  ['226', 'Burkina Faso'], ['257', 'Burundi'], ['855', 'Cambodia'], ['237', 'Cameroon'], ['1', 'United States / Canada'], ['238', 'Cape Verde'], ['236', 'Central African Republic'],
  ['235', 'Chad'], ['56', 'Chile'], ['86', 'China'], ['57', 'Colombia'], ['269', 'Comoros'], ['242', 'Congo'], ['243', 'Congo (DR)'], ['506', 'Costa Rica'], ['385', 'Croatia'],
  ['53', 'Cuba'], ['357', 'Cyprus'], ['420', 'Czech Republic'], ['45', 'Denmark'], ['253', 'Djibouti'], ['593', 'Ecuador'], ['20', 'Egypt'], ['503', 'El Salvador'],
  ['240', 'Equatorial Guinea'], ['291', 'Eritrea'], ['372', 'Estonia'], ['268', 'Eswatini'], ['251', 'Ethiopia'], ['679', 'Fiji'], ['358', 'Finland'], ['33', 'France'],
  ['241', 'Gabon'], ['220', 'Gambia'], ['995', 'Georgia'], ['49', 'Germany'], ['233', 'Ghana'], ['30', 'Greece'], ['502', 'Guatemala'], ['224', 'Guinea'], ['245', 'Guinea-Bissau'],
  ['592', 'Guyana'], ['509', 'Haiti'], ['504', 'Honduras'], ['852', 'Hong Kong'], ['36', 'Hungary'], ['354', 'Iceland'], ['62', 'Indonesia'], ['98', 'Iran'], ['964', 'Iraq'],
  ['353', 'Ireland'], ['972', 'Israel'], ['39', 'Italy'], ['225', 'Ivory Coast'], ['81', 'Japan'], ['962', 'Jordan'], ['254', 'Kenya'], ['686', 'Kiribati'], ['965', 'Kuwait'],
  ['996', 'Kyrgyzstan'], ['856', 'Laos'], ['371', 'Latvia'], ['961', 'Lebanon'], ['266', 'Lesotho'], ['231', 'Liberia'], ['218', 'Libya'], ['423', 'Liechtenstein'], ['370', 'Lithuania'],
  ['352', 'Luxembourg'], ['853', 'Macau'], ['261', 'Madagascar'], ['265', 'Malawi'], ['60', 'Malaysia'], ['960', 'Maldives'], ['223', 'Mali'], ['356', 'Malta'], ['692', 'Marshall Islands'],
  ['222', 'Mauritania'], ['230', 'Mauritius'], ['52', 'Mexico'], ['691', 'Micronesia'], ['373', 'Moldova'], ['377', 'Monaco'], ['976', 'Mongolia'], ['382', 'Montenegro'], ['212', 'Morocco'],
  ['258', 'Mozambique'], ['95', 'Myanmar'], ['264', 'Namibia'], ['674', 'Nauru'], ['977', 'Nepal'], ['31', 'Netherlands'], ['64', 'New Zealand'], ['505', 'Nicaragua'], ['227', 'Niger'],
  ['234', 'Nigeria'], ['850', 'North Korea'], ['389', 'North Macedonia'], ['47', 'Norway'], ['968', 'Oman'], ['92', 'Pakistan'], ['680', 'Palau'], ['970', 'Palestine'], ['507', 'Panama'],
  ['675', 'Papua New Guinea'], ['595', 'Paraguay'], ['51', 'Peru'], ['63', 'Philippines'], ['48', 'Poland'], ['351', 'Portugal'], ['974', 'Qatar'], ['40', 'Romania'],
  ['7', 'Russia / Kazakhstan'], ['250', 'Rwanda'], ['685', 'Samoa'], ['378', 'San Marino'], ['239', 'Sao Tome and Principe'], ['966', 'Saudi Arabia'], ['221', 'Senegal'], ['381', 'Serbia'],
  ['248', 'Seychelles'], ['232', 'Sierra Leone'], ['65', 'Singapore'], ['421', 'Slovakia'], ['386', 'Slovenia'], ['677', 'Solomon Islands'], ['252', 'Somalia'], ['27', 'South Africa'],
  ['82', 'South Korea'], ['211', 'South Sudan'], ['34', 'Spain'], ['94', 'Sri Lanka'], ['249', 'Sudan'], ['597', 'Suriname'], ['46', 'Sweden'], ['41', 'Switzerland'], ['963', 'Syria'],
  ['886', 'Taiwan'], ['992', 'Tajikistan'], ['255', 'Tanzania'], ['66', 'Thailand'], ['670', 'Timor-Leste'], ['228', 'Togo'], ['676', 'Tonga'], ['216', 'Tunisia'], ['90', 'Turkey'],
  ['993', 'Turkmenistan'], ['688', 'Tuvalu'], ['256', 'Uganda'], ['380', 'Ukraine'], ['971', 'United Arab Emirates'], ['44', 'United Kingdom'], ['598', 'Uruguay'], ['998', 'Uzbekistan'],
  ['678', 'Vanuatu'], ['379', 'Vatican City'], ['58', 'Venezuela'], ['84', 'Vietnam'], ['967', 'Yemen'], ['260', 'Zambia'], ['263', 'Zimbabwe'],
];

// "+91 9789501234" becomes its country code and number. A number saved without a space is matched on its longest known code.
export function splitPhone(raw: string): { cc: string; num: string } {
  const v = String(raw || '').trim();
  if (!v) return { cc: '91', num: '' };
  const spaced = v.match(/^\+?(\d{1,3})[\s-]+(.+)$/);
  if (spaced && COUNTRIES.some(([c]) => c === spaced[1])) return { cc: spaced[1], num: spaced[2].replace(/\D/g, '') };
  const digits = v.replace(/\D/g, '');
  if (v.startsWith('+')) {
    for (const n of [3, 2, 1]) { const c = digits.slice(0, n); if (COUNTRIES.some(([k]) => k === c)) return { cc: c, num: digits.slice(n) }; }
  }
  return { cc: '91', num: digits.length > 10 ? digits.slice(-10) : digits };
}

// null when the number is fine, otherwise what is wrong with it
export function phoneProblem(cc: string, numRaw: string): string | null {
  const num = numRaw.replace(/\D/g, '').replace(/^0+/, '');
  if (!num) return null;
  if (cc === '91') return /^[6-9]\d{9}$/.test(num) ? null : 'An Indian mobile number has 10 digits and starts with 6, 7, 8 or 9.';
  if (num.length < 5 || num.length + cc.length > 15) return 'Please check the mobile number. With the country code it can have 15 digits at most.';
  return null;
}
export const joinPhone = (cc: string, numRaw: string): string => {
  const num = numRaw.replace(/\D/g, '').replace(/^0+/, '');
  return num ? `+${cc} ${num}` : '';
};