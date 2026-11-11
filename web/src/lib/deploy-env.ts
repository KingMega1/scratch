/* Single source for the deployment environment and public site origin (server-side; read at build and request time).
   CI_ENV wins; on Vercel it falls back to VERCEL_ENV so a production deploy without CI_ENV is still treated as
   production (indexable, robots allow, no preview bar) instead of silently shipping noindex. */
export type DeployEnv = 'local' | 'preview' | 'staging' | 'production';
const ENVS: readonly DeployEnv[] = ['local', 'preview', 'staging', 'production'];

export function deployEnv(): DeployEnv {
  const ci = process.env.CI_ENV;
  if (ci && (ENVS as readonly string[]).includes(ci)) return ci as DeployEnv;
  const v = process.env.VERCEL_ENV;
  return v === 'production' ? 'production' : v ? 'preview' : 'local';
}
export const isProduction = () => deployEnv() === 'production';

/* Canonical origin. Production must not fall back to the per-deployment VERCEL_URL (canonicals would point at
   a *.vercel.app host); it uses the project's production domain when NEXT_PUBLIC_SITE_URL is unset. */
export function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/+$/, '');
  if (process.env.VERCEL_ENV === 'production' && process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'http://localhost:3000';
}

/* Editorial drafts are visible (tagged "Draft", noindex) on preview builds only; never served in production. */
export const showDrafts = () => !isProduction();
