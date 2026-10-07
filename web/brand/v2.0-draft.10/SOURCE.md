# Brand V2 package — provenance

Release: **CarIndex brand system v2.0-draft.10** (tokens dated 5 Oct 2026), governed by
`01-skill-prompt.md` (Drive file `1KyTk9htGMrtdQwGaRumZUa4kqEVk65zX`, "social content skill v0.7, matches brand system v2.0-draft.10")
in Drive folder `1CatHPXah60JBNVMPT2yGqc8WE28lg0vQ`. Loaded 7 Oct 2026 for WEB-LAUNCH-01.

| Asset | Origin | Verification |
|---|---|---|
| `tokens/carindex.css` | Drive `tokens/carindex.css` | byte-identical (4,804 B), copied to `src/styles/carindex.tokens.css` |
| `tokens/carindex.tokens.json` | Drive `tokens/` (13,306 B) | read; source of the CSS above (not vendored) |
| Fonts (served from `public/fonts`) | Archivo, Noto Kufi Arabic, IBM Plex Sans, IBM Plex Sans Arabic Regular/Bold: P3 artifact bundle; Plex Arabic Medium/SemiBold: google/fonts (source named in package README) | byte sizes equal Drive files for all 7 (`tests/unit/brand.test.mjs`) |
| Lexend | not loaded — package: "logo source only, never set text in Lexend" | — |
| `logo/*.svg` | Drive `logo/carindex-logo-masters.json` clean masters | metadata-free per logo README |
| `icons/body-sedan-ink.svg`, `body-minivan-ink.svg` | Drive `icons/` | C2PA `<metadata>` stripped per logo README |
| `icons/body-family-suv-ink.svg`, `body-hatchback-ink.svg`, `body-compact-crossover-ink.svg` | P3 artifact (claimed from same package) | not byte-compared with Drive copies |
| Licences | `fonts/OFL-*.txt` from google/fonts | SIL OFL 1.1 |

Note: `carindex.tokens.json` `$description` says "Draft: V1.5 remains the operating baseline." This build follows the
WEB-LAUNCH-01 instruction (Brand V2 governs; V1.5 not used). Flagged for the brand owner.
