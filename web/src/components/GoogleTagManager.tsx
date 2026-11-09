/* Google Tag Manager (CEO request 9 Nov). Loaded on the production site only, so preview and CI traffic
   never reaches the container. The site's own analytics already push GTM-compatible events into the same
   window.dataLayer (ids and keys only, never the buyer's words; see lib/analytics). */
export const GTM_ID = 'GTM-5WVQ2M7S';

const boot = `window.dataLayer=window.dataLayer||[];window.dataLayer.push({'gtm.start':new Date().getTime(),event:'gtm.js'});`;

export function GtmHead() {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: boot }} />
      <script async src={`https://www.googletagmanager.com/gtm.js?id=${GTM_ID}`} />
    </>
  );
}

export function GtmNoScript() {
  return (
    <noscript>
      <iframe src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`} height="0" width="0" style={{ display: 'none', visibility: 'hidden' }} />
    </noscript>
  );
}
