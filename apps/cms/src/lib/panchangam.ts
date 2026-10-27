// 1. Types
export interface PanchangamEntry {
  id?: number;
  calendar_date: string; // YYYY-MM-DD
  tamil_year: string;
  tamil_month: string;
  tamil_date: number | string;
  thithi: string;
  nakshatram: string;
  special_event?: string;
}

// 2. Constants for Dropdowns & Autocomplete
export const TAMIL_MONTHS = [
  'Chithirai (சித்திரை)',
  'Vaikasi (வைகாசி)',
  'Aani (ஆனி)',
  'Aadi (ஆடி)',
  'Aavani (ஆவணி)',
  'Purattasi (புரட்டாசி)',
  'Iyppasi (ஐப்பசி)',
  'Karthigai (கார்த்திகை)',
  'Margazhi (மார்கழி)',
  'Thai (தை)',
  'Maasi (மாசி)',
  'Panguni (பங்குனி)',
];

export const COMMON_THITHIS = [
  'Sukla Paksha Prathamai',
  'Sukla Paksha Dvitiya',
  'Sukla Paksha Tritiya',
  'Sukla Paksha Chaturthi',
  'Sukla Paksha Panchami',
  'Sukla Paksha Shashti',
  'Sukla Paksha Saptami',
  'Sukla Paksha Ashtami',
  'Sukla Paksha Navami',
  'Sukla Paksha Dasami',
  'Sukla Paksha Ekadasi',
  'Sukla Paksha Dvadasi',
  'Sukla Paksha Trayodasi',
  'Sukla Paksha Sathuradasi',
  'Pournami (பௌர்ணமி)',
  'Krishna Paksha Prathamai',
  'Krishna Paksha Dvitiya',
  'Krishna Paksha Tritiya',
  'Krishna Paksha Chaturthi',
  'Krishna Paksha Panchami',
  'Krishna Paksha Shashti',
  'Krishna Paksha Saptami',
  'Krishna Paksha Ashtami',
  'Krishna Paksha Navami',
  'Krishna Paksha Dasami',
  'Krishna Paksha Ekadasi',
  'Krishna Paksha Dvadasi',
  'Krishna Paksha Trayodasi',
  'Krishna Paksha Sathuradasi',
  'Amavasya (அமாவாசை)',
];

export const NAKSHATRAMS_LIST = [
  'Ashwini (அசுவினி)',
  'Bharani (பரணி)',
  'Krittika (கிருத்திகை)',
  'Rohini (ரோகிணி)',
  'Mrigashirsha (மிருகசீரிஷம்)',
  'Ardra (திருவாதிரை)',
  'Punarvasu (புனர்பூசம்)',
  'Pushya (பூசம்)',
  'Ashlesha (ஆயில்யம்)',
  'Magha (மகம்)',
  'Purva Phalguni (பூரம்)',
  'Uttara Phalguni (உத்திரம்)',
  'Hasta (அஸ்தம்)',
  'Chitra (சித்திரை)',
  'Swati (சுவாதி)',
  'Vishakha (விசாகம்)',
  'Anuradha (அனுஷம்)',
  'Jyeshtha (கேட்டை)',
  'Mula (மூலம்)',
  'Purva Ashadha (பூராடம்)',
  'Uttara Ashadha (உத்திராடம்)',
  'Shravana (திருவோணம்)',
  'Dhanishta (அவிட்டம்)',
  'Shatabhisha (சதயம்)',
  'Purva Bhadrapada (பூரட்டாதி)',
  'Uttara Bhadrapada (உத்திரட்டாதி)',
  'Revati (ரேவதி)',
];

// 3. API Helpers (CMS to Backend)
const API_BASE = (import.meta as any).env?.VITE_API_URL || 'http://localhost:4000/api/v1';

export async function fetchMonthPanchangam(year: number, month: number, token?: string): Promise<PanchangamEntry[]> {
  const res = await fetch(`${API_BASE}/cms/panchangam?year=${year}&month=${month}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!res.ok) {
    throw new Error(`Failed to load Panchangam for ${month}/${year}`);
  }

  const data = await res.json();
  return data.entries || [];
}

export async function upsertPanchangamDate(entry: PanchangamEntry, token?: string): Promise<boolean> {
  const res = await fetch(`${API_BASE}/cms/panchangam/upsert`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(entry),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to save date');
  }

  return true;
}

export async function bulkUploadPanchangam(entries: PanchangamEntry[], token?: string): Promise<{ success: boolean; count: number }> {
  const res = await fetch(`${API_BASE}/cms/panchangam/bulk`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ entries }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Bulk upload failed');
  }

  return res.json();
}