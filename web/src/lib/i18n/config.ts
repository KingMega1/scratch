export const LOCALES = ['ar', 'en'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'ar'; // Arabic is primary (Brand V2 F4)
export const isLocale = (x: string | undefined | null): x is Locale => !!x && (LOCALES as readonly string[]).includes(x);
export const dirOf = (l: Locale) => (l === 'ar' ? 'rtl' : 'ltr');
export const otherLocale = (l: Locale): Locale => (l === 'ar' ? 'en' : 'ar');

/* Swap the locale segment of a path, keeping the rest (entity, query) intact. */
export function switchLocalePath(pathname: string, to: Locale): string {
  const parts = pathname.split('/');
  if (isLocale(parts[1])) parts[1] = to;
  else parts.splice(1, 0, to);
  return parts.join('/') || `/${to}`;
}
