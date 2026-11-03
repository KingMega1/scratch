# AT-43 — Security and CEO2 nonproduction preparation

Security fix: cee2d7a34033f74eaade796baa935c71928769fd; original full CI https://github.com/KingMega1/scratch/actions/runs/41611691993.
P5 branch fast-forwarded from 85c4e1264437a751153b39ff340502396bcb47fd, preserving all changes.

Candidate is pinned to P1 record commit 0b066207e43baa9af7e9b1d536e3ba8568d023ce / source 49c4b88ce7171d1ece776d818aac95b8ff1755fd.
P1 record SHA256 f46f4c1c04dcd32c5bba6b1f65f169395f9fd7d1a8e557665052ae9eb2bc805c.
Dataset file SHA256 f3b65f3eb21e908d68402cc1f4399b00ea35621e42aae685073566225c2a4311.
Dataset content SHA256 aa5e32ee11a9ef0f6d1f5b4ce44bf177579e5efb8834f9373dc0c930ae2344e1.
P2 source 5a373d7a5ee97247f2da6de65239ff61c79cab4e, P2-CEO-CONFIRMED-20261102-R1.
P2 catalogue SHA256 2b796199e6c534cc69464ee181254bd127bc766511b52d833b9a4d9384479488. No canonical automotive records changed.

Default preview and production remain P1-RELEASE-T1 / U11. Candidate is selected only with P1_CANDIDATE=U12-CEO2 AND CI_ENV=preview, and VERCEL_ENV must not be production. Forbidden selection refuses FMC. No deployment/DNS operation is part of this change.
Candidate files copied as existing Git blobs from exact P1 commit; runtime checks record SHA, every dependency SHA/bytes, engine, transport, schema, dataset ID/content hash. No frontend parser or ranking copy.
Edit saves use T.editBrief for T1.2, keep T1 legacy behavior, preserve untouched parsed budget ranges and clear them on deliberate budget edits.

CI keeps all existing typecheck, unit, build, smoke, FMC, production-boundary and mandatory audit gates. It then builds CEO2 locally (never deployed), runs exact P1-output API comparisons and EN/AR desktop/mobile rendered edit journeys. Screenshots: smoke-evidence/ci-evidence/ceo2. API logs contain version/result audit only; no buyer text.

Remaining acceptance gates: final P1/P3 copy and release-authority approval; protected deployed candidate verification before promoting a preview binding. Moving P1 branch already contains CEO3; this integration deliberately does not silently adopt it.
