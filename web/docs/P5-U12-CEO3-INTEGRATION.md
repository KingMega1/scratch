# AT-43 — Security and CEO3 nonproduction preparation

Security fix: cee2d7a34033f74eaade796baa935c71928769fd (next 15.5.28, zod 4.6.7), preserved unchanged.

## Candidate reconciliation (U12-CEO2 → U12-CEO3)
P1 issued P1-RELEASE-U12-CEO3 at 47e33e1 after the CEO2 candidate (0b06620) was staged in 9659eb9/77e7ada.
CEO3 differs from CEO2 only in the dataset (CEO powertrain decisions for 7 models; iCAUR V27 held), the P5 handoff and the regression report.
Engine E6.1-2026-10-14, transport T1.2-2026-11-03, parser, i18n copy, presentation, redaction and schema bytes are identical.
The staged CEO2 bytes and the older U12-RC3 candidate are removed so neither can be built or served.

Candidate is pinned to P1 record commit 47e33e16475018e440f9de92af4cd4ba22f51559 / source cfa3450f62c8c5353c3eebfda8d096792a034bb2.
P1 record SHA256 06880f9838289247f0e81663f0a7564cbd1f63e2cbc5eb0c9e725b51e45f02d3.
Dataset file SHA256 ccff392b671688ec28071f8066af5584361ed3021bfb27e1d5030afef60758b9.
Dataset content SHA256 4f2e9ccc8d57b5fc9df3de2b7e99df27348047a795f834ea2c1ca975627cfd52 (424 identities).
P2 source 5a373d7a5ee97247f2da6de65239ff61c79cab4e, P2-CEO-CONFIRMED-20261102-R1 — the same release P5 serves; no canonical P2 records changed.

## Binding
Default preview and production remain P1-RELEASE-T1 / U11. The candidate is selected only with P1_CANDIDATE=U12-CEO3 AND CI_ENV=preview, and VERCEL_ENV must not be production; any other selection refuses FMC. No deployment or DNS operation is part of this change.
Runtime checks: record SHA, every runtime file SHA/bytes, engine, transport, schema, dataset ID/content hash. No P5-side parser or ranking logic.
Edit saves use T.editBrief (T1.2), keep T1 legacy behaviour, preserve untouched parsed budget ranges and clear them on deliberate budget edits.

## CI
All existing gates (typecheck, verify:p1, unit, build, smoke, FMC, production boundaries, mandatory dependency audit), then a local CEO3 build (never deployed) with exact P1-output API comparisons and EN/AR desktop/mobile rendered edit journeys.

## Remaining acceptance gates
P1 release authority acceptance of CEO3; P3/CEO copy approval of the no-price wording (conflict.unknown_price, sl_out.unknown_price); protected deployed candidate verification before any preview binding is promoted.
