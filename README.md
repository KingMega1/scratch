# scratch

## CarIndex n8n pipeline fixes (branch: claude/carousel-designer-rules-nhvkom)

`CarIndex_Workflow.json` is the full n8n export for workflow `smn2kQ7BP9H926pV`
("CarIndex Content Pipeline v3 (draft)"), pulled from the project's Google Drive
folder for editing since the live n8n instance at 207.127.99.206 is unreachable
from this environment (TCP connect times out on ports 22, 5678, 8080 alike).
The individual `*.json` files at the repo root are the specific nodes touched,
extracted for easy review — apply the fix by pushing the full
`CarIndex_Workflow.json` back to the live instance (`PUT /api/v1/workflows/smn2kQ7BP9H926pV`),
after a fresh pull + diff against whatever is live then, per CLAUDE.md's rule
that the live n8n instance is the source of truth, not any local file.

Changes:
- `carousel_designer.json` / `carousel_designer_retry.json` — added a content-type
  exception permitting a dark (#111111) background on `comparison`-role slides only
  (source-conflict resolution, spec/price bars, Buy If/Skip If splits); every other
  role stays on the default #F9F9F7.
- `content_creation.json` / `content_creation_fallback_gemini.json` — added an
  explicit brand-voice block ("numbers first, opinions last", superlative-sourcing,
  dealer-language ban) and a hook-specificity rule directly into the generation
  prompt, instead of relying solely on the downstream Auditor to catch it after
  the fact.
- `editor_in_chief_fallback_claude.json` — fixed the Claude fallback tier's
  instruction message, which was sent with `role: "assistant"` instead of
  `role: "system"`.
- `verification/` — local mockup renders (Playwright/Chromium) proving the new
  Carousel Designer background rule as written: one `comparison`-role dark slide,
  one default light slide.