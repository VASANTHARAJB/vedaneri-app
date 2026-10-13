export const locales = ['en', 'ta'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'en';
export const isLocale = (v: string): v is Locale => (locales as readonly string[]).includes(v);
