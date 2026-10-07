/* Find My Car component boundaries — SCAFFOLD, NOT RENDERED IN PRODUCTION ROUTES.
   Each component fixes its props contract (from ci.reco.v1) so P3's corrected design can be implemented
   without touching the API, and P1 can review the binding in isolation. They render inert slots only.
   BLOCKED until: P3 semantic delta -> P1 delta re-review -> PASS. */
import type { Locale } from '@/lib/i18n/config';
import type { BuyerBrief, RecommendationResult } from '@/lib/recommendation/contract';

type Slot = { locale: Locale };
const blocked = (name: string) => <div data-fmc-slot={name} data-fmc-blocked="pending_semantic_acceptance" hidden />;

/** Entry: guided start + free-text brief. No preselected answers. */
export function BriefEntry(_: Slot & { onSubmit: (b: Pick<BuyerBrief, 'entry' | 'free_text'>) => void }) { return blocked('brief-entry'); }
/** One guided question; question copy and options come from P1 server-side, never hard-coded here. */
export function GuidedQuestion(_: Slot & { questionId: string; answered: BuyerBrief['answered'] }) { return blocked('guided-question'); }
/** Confirm/edit the parsed brief before any result is requested (brief.confirmed=true). */
export function BriefConfirm(_: Slot & { brief: BuyerBrief; onConfirm: (b: BuyerBrief) => void }) { return blocked('brief-confirm'); }
/** Result switch over the engine state: clear | lean | tie | only_one | no_match. No tier labels, no default winner. */
export function ResultView(_: Slot & { result: RecommendationResult }) { return blocked('result'); }
/** Engine-bound WHY / trade-offs (P1-rendered text per locale). */
export function EngineStatements(_: Slot & { items: RecommendationResult['candidates'][number]['why'] }) { return blocked('engine-statements'); }
/** Why not the others (P1 counts + text). */
export function WhyNotOthers(_: Slot & { data: RecommendationResult['why_not_others'] }) { return blocked('why-not-others'); }
