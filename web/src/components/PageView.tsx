'use client';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { setAnalyticsContext, track } from '@/lib/analytics/client';
import { pushGtm, siteLanguage } from '@/lib/analytics/gtm';

export default function PageView({ universeVersion }: { universeVersion: string }) {
  const pathname = usePathname();
  useEffect(() => { setAnalyticsContext({ universe_version: universeVersion }); }, [universeVersion]);
  // every route change, client-side navigation included (usePathname changes without a reload)
  useEffect(() => { pushGtm({ event: 'page_context', site_language: siteLanguage(pathname || '') }); track('page_view', { route: pathname }); }, [pathname]);
  return null;
}
