'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { type Locale, otherLocale, switchLocalePath } from '@/lib/i18n/config';
import { dict } from '@/lib/i18n/dictionaries';
import { track } from '@/lib/analytics/client';

const NAV = [
  ['fmc', '/find-my-car'],
  ['cars', '/cars'],
  ['compare', '/compare'],
  ['market', '/market'],
  ['news', '/news'],
  ['search', '/search'],
] as const;

function SearchIcon() {
  return (<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M15.5 15.5 21 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>);
}

export default function Header({ locale }: { locale: Locale }) {
  const t = dict(locale);
  const pathname = usePathname() || `/${locale}`;
  const [open, setOpen] = useState(false);
  useEffect(() => { setOpen(false); }, [pathname]);
  const other = otherLocale(locale);
  const langHref = switchLocalePath(pathname, other);
  const isCurrent = (href: string) => pathname === `/${locale}${href}` || pathname.startsWith(`/${locale}${href}/`);

  return (
    <header className="gh">
      <div className="wrap gh-row">
        <Link className="gh-logo" href={`/${locale}`} aria-label={`${t.brand} — ${t.nav.home}`}>
          <img src="/brand/carindex-logo-ink.svg" alt="CarIndex" width={106} height={24} />
        </Link>
        <nav className="gh-nav" aria-label={locale === 'ar' ? 'القائمة الرئيسية' : 'Primary'}>
          {NAV.filter(([k]) => k !== 'search').map(([k, href]) => (
            <Link key={k} href={`/${locale}${href}`} aria-current={isCurrent(href) ? 'page' : undefined}>{t.nav[k]}</Link>
          ))}
        </nav>
        <div className="gh-tools">
          <form className="gh-search" role="search" action={`/${locale}/search`}>
            <SearchIcon />
            <label className="visually-hidden" htmlFor="gh-q">{t.nav.search}</label>
            <input id="gh-q" name="q" type="search" placeholder={t.searchPlaceholder} autoComplete="off" />
          </form>
          <Link className="gh-iconbtn gh-search-btn" href={`/${locale}/search`} aria-label={t.nav.search}><SearchIcon /></Link>
          <a
            className="lang" href={langHref} hrefLang={other} lang={other}
            onClick={(e) => {
              try { document.cookie = `ci_locale=${other}; path=/; max-age=31536000; samesite=lax`; } catch { /* cookies blocked */ }
              track('lang_switch', { from: locale, to: other });
              e.currentTarget.href = langHref + window.location.search;
            }}
          >{t.lang.switchTo}</a>
          <Link className="btn btn-sm btn-ghost gh-account" href={`/${locale}/my-carindex`} aria-current={isCurrent('/my-carindex') ? 'page' : undefined}>{t.nav.account}</Link>
          <button className="gh-iconbtn gh-menu-btn" type="button" aria-expanded={open} aria-controls="gh-drawer" aria-label={open ? t.nav.close : t.nav.menu} onClick={() => setOpen(o => !o)}>
            <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" focusable="false">{open
              ? <path d="M5 5l14 14M19 5 5 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              : <path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />}</svg>
          </button>
        </div>
      </div>
      <div id="gh-drawer" className="gh-drawer wrap" hidden={!open}>
        <form role="search" action={`/${locale}/search`}>
          <label className="visually-hidden" htmlFor="gh-q2">{t.nav.search}</label>
          <input id="gh-q2" name="q" type="search" placeholder={t.searchPlaceholder} />
          <button className="btn btn-primary" type="submit">{t.search.submit}</button>
        </form>
        <nav aria-label={locale === 'ar' ? 'القائمة' : 'Menu'}>
          {NAV.map(([k, href]) => (
            <Link key={k} href={`/${locale}${href}`} aria-current={isCurrent(href) ? 'page' : undefined}>{t.nav[k]}</Link>
          ))}
          <Link href={`/${locale}/my-carindex`} aria-current={isCurrent('/my-carindex') ? 'page' : undefined}>{t.nav.account}</Link>
        </nav>
      </div>
    </header>
  );
}
