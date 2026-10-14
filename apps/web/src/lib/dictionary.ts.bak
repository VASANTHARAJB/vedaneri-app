import en from '@/dictionaries/en.json';
import ta from '@/dictionaries/ta.json';
import type { Locale } from './i18n';

const dictionaries = { en, ta } as const;
export const getDictionary = (locale: Locale) => dictionaries[locale];
