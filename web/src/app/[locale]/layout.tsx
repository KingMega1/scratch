import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import '@/styles/carindex.tokens.css';
import '@/styles/fonts.css';
import '@/styles/site.css';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import PageView from '@/components/PageView';
import { LOCALES, dirOf, isLocale } from '@/lib/i18n/config';
import { dict } from '@/lib/i18n/dictionaries';
import { SITE_URL } from '@/lib/seo';
import { vehicles } from '@/server/vehicles/read-model';

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#0B1620' };

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return {
    metadataBase: new URL(SITE_URL),
    icons: { icon: '/brand/carindex-favicon.svg', apple: '/brand/carindex-app-icon.svg' },
    title: dict(locale).brand,
  };
}

export function generateStaticParams() { return LOCALES.map(locale => ({ locale })); }

export default async function LocaleLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = dict(locale);
  const env = process.env.CI_ENV || (process.env.VERCEL_ENV === 'production' ? 'production' : process.env.VERCEL_ENV ? 'preview' : 'local');
  const meta = vehicles().meta();
  const trackEndpoint = process.env.NEXT_PUBLIC_CI_TRACK_ENDPOINT === 'auto' ? '/api/v1/events' : (process.env.NEXT_PUBLIC_CI_TRACK_ENDPOINT || '');
  return (
    <html lang={locale} dir={dirOf(locale)} data-env={env === 'production' ? 'prod' : env === 'local' ? 'dev' : 'staging'}>
      <head>
        <link rel="preload" href={locale === 'ar' ? '/fonts/IBMPlexSansArabic-Regular.ttf' : '/fonts/IBMPlexSans-Variable.ttf'} as="font" type="font/ttf" crossOrigin="anonymous" />
        <link rel="preload" href={locale === 'ar' ? '/fonts/NotoKufiArabic-Variable.ttf' : '/fonts/Archivo-Variable.ttf'} as="font" type="font/ttf" crossOrigin="anonymous" />
        {trackEndpoint ? <meta name="ci-track-endpoint" content={trackEndpoint} /> : null}
      </head>
      <body>
        <a className="skip" href="#main">{t.skip}</a>
        {env !== 'production' ? <div className="preview-bar" role="note">{t.preview}</div> : null}
        <Header locale={locale} />
        <main id="main" tabIndex={-1}>{children}</main>
        <Footer locale={locale} dataVersion={meta.registry_version} />
        <PageView universeVersion={meta.registry_version} />
      </body>
    </html>
  );
}
