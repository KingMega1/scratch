import profiles from '@data/registry/social-profiles.json';
import { SITE_URL } from '@/lib/seo';

/* Site-wide Organization JSON-LD. sameAs carries only profiles verified live (data/registry/social-profiles.json). */
type Candidate = { url: string; verified: boolean };
export const SAME_AS = (profiles.candidates as Candidate[]).filter(c => c.verified === true && /^https:\/\//.test(c.url)).map(c => c.url);

export function orgJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${SITE_URL}/#organization`,
    name: 'CarIndexed',
    alternateName: 'كار إندكسد',
    url: SITE_URL,
    logo: `${SITE_URL}/brand/carindexed-app-icon.svg`,
    ...(SAME_AS.length ? { sameAs: SAME_AS } : {}),
  };
}

export default function OrgJsonLd() {
  // `<` escaped so the JSON can never close the script element.
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd()).replace(/</g, '\\u003c') }} />;
}
