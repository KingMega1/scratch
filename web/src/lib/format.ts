import type { Locale } from './i18n/config';

/* Brand V2 "Numbers and names": Western numerals in both languages.
   Prices: "1,895,000 ج.م" in Arabic, "EGP 1,895,000" in English.
   Dates: day and month; year only when it is not the current year. */

const NUM = new Intl.NumberFormat('en-US');
export const num = (n: number) => NUM.format(n);

export function price(n: number, locale: Locale): string {
  return locale === 'ar' ? `${NUM.format(n)} ج.م` : `EGP ${NUM.format(n)}`;
}

export function priceShort(n: number, locale: Locale): string {
  const m = n / 1_000_000;
  const v = m >= 1 ? `${+m.toFixed(m >= 10 ? 1 : 2)}` : `${Math.round(n / 1000)}`;
  if (locale === 'ar') return m >= 1 ? `${v} مليون ج.م` : `${v} ألف ج.م`;
  return m >= 1 ? `EGP ${v}M` : `EGP ${v}K`;
}

const MONTHS = {
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  ar: ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'],
};

export function date(iso: string, locale: Locale, now = new Date()): string {
  const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?/.exec(iso || '');
  if (!m) return '—';
  const [, y, mo, d] = m;
  const month = MONTHS[locale][+mo - 1];
  const year = +y !== now.getUTCFullYear() ? ` ${y}` : '';
  return d ? `${+d} ${month}${year}` : `${month} ${y}`;
}

export function monthLabel(ym: string, locale: Locale): string {
  const m = /^(\d{4})-(\d{2})$/.exec(ym || '');
  return m ? `${MONTHS[locale][+m[2] - 1]} ${m[1]}` : ym;
}
