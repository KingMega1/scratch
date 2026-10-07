# CarIndex website — WEB-LAUNCH-01 / AT-43 (P5)

Next.js 15 + TypeScript. Arabic-first (`/ar`, RTL) and English (`/en`, LTR), server-rendered `lang`/`dir`.

## Run
```
npm ci
npm run dev                # http://localhost:3000 -> /ar
npm run typecheck && npm run test:unit
npm run build && npm run test:smoke   # Playwright, desktop + mobile
```

## Sources of truth
| Area | Source | In repo |
|---|---|---|
| Design | P3 accepted artifact `FzaL2VQFihFn7zMnJ1UoUk` | implemented in `src/app`, `src/styles/site.css` |
| Brand | Brand V2 **v2.0-draft.10** agent package (Drive `1CatHPXah60JBNVMPT2yGqc8WE28lg0vQ`, skill `01-skill-prompt.md` v0.7) | `brand/v2.0-draft.10/`, `src/styles/carindex.tokens.css` (generated file, unedited), `public/fonts`, `public/brand` |
| Vehicle data | **Canonical**: `KingMega1/scratch` branch `claude/carindex-buyer-vehicle-data-97yinp`, root `vehicle-data/`, accepted view `vehicle-data/views/p1_suv_2m.json` (`carindex.p1.buyer_view/v2`), pinned commit `6f3df7d` | `data/registry/universe.snapshot.json` (deterministic projection) + `display-crosswalk.TEMP.json` (photos/Arabic names, non-canonical) |
| Recommendation | P1 engine `E6-2026-09-28` (vendored verbatim, hash-pinned, server-only) | `src/server/p1/vendor/` |

## Architecture
```
GitHub accepted view --(scripts/sync-vehicle-data.mjs, deterministic)--> data/registry (S1) | Postgres read model (S2, db/read-model.sql)
   --> src/server/vehicles/read-model.ts (read-only, PublicCar shaping) --> pages + BFF /api/v1/*  --> browser
```
- Browser never touches internal schemas; BFF returns shaped responses only.
- Website cannot write vehicle truth. Postgres is a serving projection; GitHub wins on conflict.
- Every projection carries `source.commit`, `source.sha256`, `registry_version`, `snapshot_id`, `synced_at` (`/api/health`).

### BFF endpoints
| Route | Purpose | State |
|---|---|---|
| `GET /api/health` | versions + integrity | live |
| `GET /api/v1/cars`, `/api/v1/cars/:brand/:model` | shaped vehicle data | live |
| `GET /api/v1/search?q=&locale=` | shaped public search index | live |
| `POST /api/v1/recommendation` | brief -> `ci.reco.v1` | **503 pending P1 PASS** |
| `POST /api/v1/identity/otp/{start,verify}` | phone-first OTP | **503 feature-gated** |
| `POST /api/v1/events` | EV3 collector (PII-stripped, redacted) | live (log sink) |

## Gates
- **Find My Car**: scaffold only. Semantic integration stays blocked until **P1 R3 RELEASE**. The vendored engine (E6) was built for the superseded U11 universe; rebinding to the canonical buyer_view is part of R3.
  Contract: `src/lib/recommendation/contract.ts`. Component slots: `src/components/fmc/boundaries.tsx`.
- **Customer PII**: `FEATURE_CUSTOMER_PII` stays false until legal/security/provider sign-off.
- **Admin** (`/admin`): 404 unless `ADMIN_BASIC_AUTH_USER/PASS` are set; then Basic auth, noindex.

## Environments
`CI_ENV` = local | preview | staging | production (Vercel `VERCEL_ENV` maps automatically). Non-production: preview banner, `noindex`, robots disallow.
See `.env.example`. Server secrets never use the `NEXT_PUBLIC_` prefix.

## Rollback
Frontend: redeploy the previous deployment, or `git revert <commit>` and push. Data: re-run sync at the previous commit (S1),
or repoint `vehicles_read.active` (S2). No destructive migrations.

## Asset flags (P2 handoff)
`data-asset-flags` on images: `TEMP_UNVERIFIED`, `EXACT_CAR_UNCONFIRMED`, `PHOTO_NEEDS_ENRICHMENT`, `WATERMARK_CROPPED`.
Models without a mapped photo show the Brand V2 body-type icon, never a guessed photo.

## Vehicle identity (open decision)
The canonical view marks `model_id` PROVISIONAL (D3/D4) and says not to build public URLs on it. Routes use the view's
`slug` field (`/cars/kia-sportage`). If D3/D4 changes slugs, add redirects; do not reuse old slugs for other models.
