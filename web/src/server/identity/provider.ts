import 'server-only';
import { serverEnv } from '../env';

/* Customer identity boundary — logically separate from vehicle data (separate service + store in S2).
   UX: mobile-first OTP, email retained as backup contact. First recommendation is viewable without verification;
   verification gates save / persistent share / history / referral management.
   Production activation is compliance-gated (FEATURE_CUSTOMER_PII): needs legal/privacy approval of PII hosting
   (overseas hosting NOT assumed approved), an approved SMS provider, and production SMTP. S1 ships the interface only. */

export interface IdentityProvider {
  enabled(): boolean;
  startOtp(input: { channel: 'sms' | 'email'; destination: string }): Promise<{ challengeId: string }>;
  verifyOtp(input: { challengeId: string; code: string }): Promise<{ customerRef: string }>;
}

export class IdentityDisabledError extends Error { constructor() { super('identity_disabled'); } }

const PROVIDER_WIRED = false;

class GatedIdentityProvider implements IdentityProvider {
  // Stays false even if FEATURE_CUSTOMER_PII=true: no approved SMS/SMTP provider is wired in S1.
  enabled() { return serverEnv().FEATURE_CUSTOMER_PII === 'true' && PROVIDER_WIRED; }
  async startOtp(): Promise<{ challengeId: string }> { throw new IdentityDisabledError(); }
  async verifyOtp(): Promise<{ customerRef: string }> { throw new IdentityDisabledError(); }
}

let p: IdentityProvider | null = null;
export const identity = () => (p ??= new GatedIdentityProvider());

/* Egyptian mobile / email validation (server-side). Inputs are validated, never logged. */
export const EG_MOBILE = /^(?:\+20|0020|0)?1[0125]\d{8}$/;
export const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,}$/i;
