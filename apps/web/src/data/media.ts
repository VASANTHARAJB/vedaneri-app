// DUMMY DATA. The CMS portal will replace this file: keep the shape, swap the source.
// Titles, series and photos below are placeholders taken from the design reference, not the ashram's real archive.
// Audio: put files in apps/web/public/audio/ and set `src` (for example '/audio/gita-2-1.mp3'). Empty `src` = preview mode.
// Video: set `youtubeId` (the part after v= in a YouTube address). Empty = "coming soon" in the pop-up.
// Photos: put files in apps/web/public/images/ and set `src`, `w` and `h` (the picture size in pixels).

import type { L } from './sevas';

export type SeriesKey = 'gita' | 'thirukkural' | 'thayumanavar' | 'upanishads' | 'kaivalya' | 'events';

export const SERIES: { key: SeriesKey; name: L }[] = [
  { key: 'gita', name: { en: 'Bhagavad Gita', ta: 'பகவத் கீதை' } },
  { key: 'thirukkural', name: { en: 'Thirukkural', ta: 'திருக்குறள்' } },
  { key: 'thayumanavar', name: { en: 'Thayumanavar', ta: 'தாயுமானவர்' } },
  { key: 'upanishads', name: { en: 'Upanishads', ta: 'உபநிஷதங்கள்' } },
  { key: 'kaivalya', name: { en: 'Kaivalya Navaneetham', ta: 'கைவல்ய நவநீதம்' } },
  { key: 'events', name: { en: 'Events', ta: 'நிகழ்வுகள்' } },
];
export const seriesName = (k: SeriesKey, locale: 'en' | 'ta') => SERIES.find((s) => s.key === k)?.name[locale] ?? '';

// Links from the old website
export const YOUTUBE_URL = 'https://www.youtube.com/channel/UCnpgt-vD7stQAllAL5PRjXg/playlists';
export const PHOTO_FOLDER_URL = 'https://drive.google.com/drive/folders/1cYFVkTrtUgqylFdkuoYtjmkVWdgTo7oB?usp=drive_link';

// ---------- Audio ----------
export type AudioTrack = {
  id: string;
  title: L;
  series: Exclude<SeriesKey, 'events'>;
  duration: number;   // seconds
  date: string;       // YYYY-MM-DD
  src: string;        // '' until the file is uploaded
};

export const AUDIO: AudioTrack[] = [
  { id: 'gita-2-1', series: 'gita', duration: 2710, date: '2026-02-12', src: '',
    title: { en: 'Bhagavad Gita - Chapter 2 (Sankhya Yoga) - Part 1', ta: 'பகவத் கீதை - அத்தியாயம் 2 (சாங்க்ய யோகம்) - பகுதி 1' } },
  { id: 'kural-porutpal', series: 'thirukkural', duration: 3160, date: '2026-01-28', src: '',
    title: { en: 'Thirukkural - Porutpal (Wealth) - Introduction', ta: 'திருக்குறள் - பொருட்பால் - முன்னுரை' } },
  { id: 'thayumanavar-1', series: 'thayumanavar', duration: 2295, date: '2026-01-15', src: '',
    title: { en: 'Thayumanavar Padalgal - Anandha Kalippu', ta: 'தாயுமானவர் பாடல்கள் - ஆனந்தக் களிப்பு' } },
  { id: 'kaivalya-3', series: 'kaivalya', duration: 3750, date: '2025-12-10', src: '',
    title: { en: 'Kaivalya Navaneetham - Lecture Series 3', ta: 'கைவல்ய நவநீதம் - சொற்பொழிவுத் தொடர் 3' } },
  { id: 'upanishad-mandukya-4', series: 'upanishads', duration: 2980, date: '2025-11-22', src: '',
    title: { en: 'Upanishad Sara Sangraham - Lecture 4', ta: 'உபநிஷத சார சங்கிரகம் - சொற்பொழிவு 4' } },
  { id: 'gita-2-2', series: 'gita', duration: 2840, date: '2025-11-05', src: '',
    title: { en: 'Bhagavad Gita - Chapter 2 (Sankhya Yoga) - Part 2', ta: 'பகவத் கீதை - அத்தியாயம் 2 (சாங்க்ய யோகம்) - பகுதி 2' } },
  { id: 'kural-aram', series: 'thirukkural', duration: 2660, date: '2025-10-18', src: '',
    title: { en: 'Thirukkural - Aram (Virtue) - Introduction', ta: 'திருக்குறள் - அறத்துப்பால் - முன்னுரை' } },
  { id: 'upanishad-kena-1', series: 'upanishads', duration: 3300, date: '2025-09-30', src: '',
    title: { en: 'Kena Upanishad - Lecture 1', ta: 'கேனோபநிஷத் - சொற்பொழிவு 1' } },
];

// ---------- Video ----------
export type VideoItem = {
  id: string;
  title: L;
  desc: L;
  series: SeriesKey;
  duration: number;   // seconds
  date: string;
  youtubeId: string;  // '' until the video is chosen
  thumb: string;      // picture in /public/images
  featured?: boolean;
};

export const VIDEOS: VideoItem[] = [
  { id: 'sadhana-panchakam', series: 'upanishads', duration: 3120, date: '2026-03-02', youtubeId: '', thumb: '/images/ashram-patashala.jpg', featured: true,
    title: { en: 'Sadhana Panchakam of Adi Sankara', ta: 'ஆதி சங்கரரின் சாதனா பஞ்சகம்' },
    desc: { en: 'Step-by-step guidance on spiritual practice from a classical text.', ta: 'பாரம்பரிய நூலிலிருந்து ஆன்மிகப் பயிற்சிக்கான படிப்படியான வழிகாட்டல்.' } },
  { id: 'kural-essence', series: 'thirukkural', duration: 2540, date: '2026-02-14', youtubeId: '', thumb: '/images/festival.jpg',
    title: { en: 'Thirukkural Vedanta Essence', ta: 'திருக்குறள் வேதாந்தச் சாரம்' },
    desc: { en: 'Exploring the deep spiritual dimensions of classical Tamil ethics.', ta: 'செம்மொழித் தமிழ் அறநூலின் ஆழ்ந்த ஆன்மிகப் பரிமாணங்கள்.' } },
  { id: 'mind-meditation', series: 'upanishads', duration: 2210, date: '2026-01-20', youtubeId: '', thumb: '/images/ashram-vidyapitham.jpg',
    title: { en: 'Mind Control & Meditation', ta: 'மனக்கட்டுப்பாடும் தியானமும்' },
    desc: { en: 'Practical teachings on mental discipline according to Yoga Sutras.', ta: 'யோக சூத்திரங்களின்படி மன ஒழுக்கம் குறித்த நடைமுறை உபதேசங்கள்.' } },
  { id: 'gita-chapter-2', series: 'gita', duration: 3380, date: '2025-12-28', youtubeId: '', thumb: '/images/ashram-classroom.jpg',
    title: { en: 'Bhagavad Gita - Chapter 2 Overview', ta: 'பகவத் கீதை - அத்தியாயம் 2 அறிமுகம்' },
    desc: { en: 'An overview of the second chapter and its central teaching.', ta: 'இரண்டாம் அத்தியாயத்தின் அறிமுகமும் அதன் மையக் கருத்தும்.' } },
  { id: 'thayumanavar-padal', series: 'thayumanavar', duration: 1980, date: '2025-12-02', youtubeId: '', thumb: '/images/ashram-river.jpg',
    title: { en: 'Thayumanavar Padalgal - Selected Verses', ta: 'தாயுமானவர் பாடல்கள் - தேர்ந்தெடுத்தவை' },
    desc: { en: 'Reflections on selected verses of Thayumanavar.', ta: 'தாயுமானவரின் தேர்ந்தெடுத்த பாடல்கள் பற்றிய சிந்தனைகள்.' } },
  { id: 'guru-puja-event', series: 'events', duration: 1760, date: '2025-10-12', youtubeId: '', thumb: '/images/ashram-vilasa.jpg',
    title: { en: 'Guru Puja Aradhana', ta: 'குரு பூஜை ஆராதனை' },
    desc: { en: 'Highlights of the Guru Puja at the ashram.', ta: 'ஆசிரமத்தில் நடைபெற்ற குரு பூஜையின் சிறப்புக் காட்சிகள்.' } },
  { id: 'kaivalya-intro', series: 'kaivalya', duration: 2890, date: '2025-09-14', youtubeId: '', thumb: '/images/ashram-dining.jpg',
    title: { en: 'Kaivalya Navaneetham - Introduction', ta: 'கைவல்ய நவநீதம் - அறிமுகம்' },
    desc: { en: 'An introduction to the text and how to study it.', ta: 'நூலின் அறிமுகமும் அதைப் படிக்கும் முறையும்.' } },
  { id: 'upanishad-sara', series: 'upanishads', duration: 3015, date: '2025-08-30', youtubeId: '', thumb: '/images/acharya-1.jpg',
    title: { en: 'Upanishad Sara Sangraham - Lecture 4', ta: 'உபநிஷத சார சங்கிரகம் - சொற்பொழிவு 4' },
    desc: { en: 'The fourth lecture of the Upanishad Sara Sangraham series.', ta: 'உபநிஷத சார சங்கிரகத் தொடரின் நான்காம் சொற்பொழிவு.' } },
];

// ---------- Albums ----------
export type AlbumKey = 'swamiji' | 'ashramam' | 'festivals' | 'river';
export const ALBUMS: { key: AlbumKey; name: L }[] = [
  { key: 'swamiji', name: { en: 'Swamiji', ta: 'ஸ்வாமிஜி' } },
  { key: 'ashramam', name: { en: 'Ashramam', ta: 'ஆசிரமம்' } },
  { key: 'festivals', name: { en: 'Festivals & Pujas', ta: 'விழாக்களும் பூஜைகளும்' } },
  { key: 'river', name: { en: 'Pennai River', ta: 'பெண்ணை ஆறு' } },
];

export type Photo = { id: string; title: L; album: AlbumKey; src: string; w: number; h: number };

export const PHOTOS: Photo[] = [
  { id: 'p-swamiji', album: 'swamiji', src: '/images/swamiji.jpg', w: 690, h: 972, title: { en: 'Pujyasri Swami Omkarananda', ta: 'பூஜ்யஸ்ரீ ஸ்வாமி ஓங்காரானந்தர்' } },
  { id: 'p-guru-puja', album: 'festivals', src: '/images/festival.jpg', w: 959, h: 716, title: { en: 'Guru Puja Aradhana', ta: 'குரு பூஜை ஆராதனை' } },
  { id: 'p-river', album: 'river', src: '/images/ashram-river.jpg', w: 959, h: 716, title: { en: 'Pennai Riverbanks', ta: 'பெண்ணை ஆற்றங்கரை' } },
  { id: 'p-vidyapitham', album: 'ashramam', src: '/images/ashram-vidyapitham.jpg', w: 959, h: 716, title: { en: 'Vidyapitham', ta: 'வித்யாபீடம்' } },
  { id: 'p-acharya-1', album: 'swamiji', src: '/images/acharya-1.jpg', w: 778, h: 433, title: { en: 'Acharya', ta: 'ஆசார்யர்' } },
  { id: 'p-ghosala', album: 'ashramam', src: '/images/ashram-ghosala.jpg', w: 959, h: 716, title: { en: 'Go Shala', ta: 'கோசாலை' } },
  { id: 'p-patashala', album: 'ashramam', src: '/images/ashram-patashala.jpg', w: 959, h: 716, title: { en: 'Pathashala', ta: 'பாடசாலை' } },
  { id: 'p-vilasa', album: 'festivals', src: '/images/ashram-vilasa.jpg', w: 959, h: 716, title: { en: 'Ashram Gathering', ta: 'ஆசிரமக் கூடுகை' } },
  { id: 'p-acharya-2', album: 'swamiji', src: '/images/acharya-2.jpg', w: 805, h: 433, title: { en: 'Acharya in discourse', ta: 'சொற்பொழிவில் ஆசார்யர்' } },
  { id: 'p-classroom', album: 'ashramam', src: '/images/ashram-classroom.jpg', w: 959, h: 716, title: { en: 'Classroom', ta: 'வகுப்பறை' } },
  { id: 'p-dining', album: 'ashramam', src: '/images/ashram-dining.jpg', w: 959, h: 716, title: { en: 'Annadhanam Hall', ta: 'அன்னதான மண்டபம்' } },
  { id: 'p-acharya-3', album: 'swamiji', src: '/images/acharya-3.jpg', w: 804, h: 433, title: { en: 'Acharya with devotees', ta: 'பக்தர்களுடன் ஆசார்யர்' } },
];

// ---------- helpers ----------
// 2710 -> "45:10", 3750 -> "1:02:30"
export function clock(s: number) {
  if (!Number.isFinite(s) || s < 0) return '0:00';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`;
}
