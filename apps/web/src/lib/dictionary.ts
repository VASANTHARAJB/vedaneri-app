import en from '@/dictionaries/en.json';
import ta from '@/dictionaries/ta.json';
import type { Locale } from './i18n';

export type Dictionary = typeof en;
const dictionaries: Record<Locale, Dictionary> = { en, ta };
export const getDictionary = (locale: Locale): Dictionary => dictionaries[locale];
