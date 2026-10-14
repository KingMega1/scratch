import 'server-only';

/* CarIndex Take (Best for / Think twice if) is evidence/recommendation-owned (P1 semantics + evidence ledger),
   NOT static editorial copy. Each statement must be bound to data and carry provenance.
   S1: no approved source exists, so every model returns null and the page renders an explicit empty slot. */
export interface TakeStatement { code: string; text: { ar: string; en: string }; evidence: { field: string; source_kind: string; date: string }[] }
export interface CarTake { modelId: string; bestFor: TakeStatement[]; thinkTwice: TakeStatement[]; engine_version: string; universe_version: string }
export interface TakeProvider { forModel(modelId: string): Promise<CarTake | null> }

class NoTakeProvider implements TakeProvider { async forModel(): Promise<CarTake | null> { return null; } }
let p: TakeProvider | null = null;
export const takes = () => (p ??= new NoTakeProvider());
