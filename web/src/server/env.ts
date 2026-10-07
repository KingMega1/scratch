import 'server-only';
import { z } from 'zod';

/* Server-only environment. Validated once; secrets never cross into client bundles (no NEXT_PUBLIC_ prefix). */
const Env = z.object({
  CI_ENV: z.enum(['local', 'preview', 'staging', 'production']).default('local'),
  FEATURE_CUSTOMER_PII: z.enum(['true', 'false']).default('false'),
  FEATURE_FMC_SEMANTIC: z.enum(['true', 'false']).default('false'),
  ADMIN_BASIC_AUTH_USER: z.string().optional(),
  ADMIN_BASIC_AUTH_PASS: z.string().optional(),
});
let env: z.infer<typeof Env> | null = null;
export function serverEnv() {
  if (!env) {
    const e = { ...process.env };
    if (!e.CI_ENV && process.env.VERCEL_ENV) e.CI_ENV = process.env.VERCEL_ENV === 'production' ? 'production' : 'preview';
    env = Env.parse(Object.fromEntries(Object.entries(e).filter(([, v]) => v !== '')));
  }
  return env;
}
