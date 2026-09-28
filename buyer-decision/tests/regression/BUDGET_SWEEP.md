# Budget-curve sensitivity sweep

Budgets EGP 0.8M–6M in 0.1M steps (53) × 8 profiles × 3 budget intentions, data U11-2026-09-26. Follow-up questions are not simulated (real journeys add priorities and tie less).

Earned shows the median buyer-priority fit gain in brackets (scale 0–1). Ratios = shown car price ÷ stated budget, over all shown cars (main + alternatives). "Earned" = an above-budget car whose buyer-priority fit beats the best car at or under budget by more than the tie margin (0.02); "no priority" = the brief has no priority that could justify extra spend. Winner = the main-ranking leader when not a tie ("TIE" otherwise).

## target

| Variant | Results | Cars <80% | Cars <70% | Cars >100% | Stretch median / max | Above-budget earned / not earned / no priority | Winner changes vs current | Top-3 changes | Spend-less card | Tie |
|---|---|---|---|---|---|---|---|---|---|---|
| current (around 90–100, max 70–100) | 422 (+2 none) | 6% | 2% | 7% | +2% / +9% | 13% (fit +0.17) / 65% / 21% | — | — | 26% | 93% |
| 90–100 (both) | 422 (+2 none) | 6% | 2% | 7% | +2% / +9% | 13% (fit +0.17) / 65% / 21% | 0% | 0% | 26% | 93% |
| 85–110 (flat to 110) | 422 (+2 none) | 14% | 2% | 34% | +8% / +10% | 3% (fit +0.70) / 48% / 49% | 3% | 84% | 13% | 95% |
| 85–115 (flat to 110, steep 110–115) | 422 (+2 none) | 14% | 2% | 35% | +8% / +14% | 5% (fit +0.17) / 47% / 49% | 4% | 86% | 13% | 95% |
| 90–100 + earned-stretch rule | 422 (+2 none) | 6% | 2% | 1% | +7% / +9% | 92% (fit +0.17) / 0% / 8% | 0% | 18% | 26% | 93% |

## max

| Variant | Results | Cars <80% | Cars <70% | Cars >100% | Stretch median / max | Above-budget earned / not earned / no priority | Winner changes vs current | Top-3 changes | Spend-less card | Tie |
|---|---|---|---|---|---|---|---|---|---|---|
| current (around 90–100, max 70–100) | 421 (+3 none) | 39% | 2% | 0% | — / — | — / — / — | — | — | 0% | 96% |
| 90–100 (both) | 421 (+3 none) | 6% | 2% | 0% | — / — | — / — / — | 1% | 85% | 26% | 94% |
| 85–110 (flat to 110) | 421 (+3 none) | 15% | 2% | 0% | — / — | — / — / — | 1% | 80% | 11% | 95% |
| 85–115 (flat to 110, steep 110–115) | 421 (+3 none) | 15% | 2% | 0% | — / — | — / — / — | 1% | 80% | 11% | 95% |
| 90–100 + earned-stretch rule | 421 (+3 none) | 6% | 2% | 0% | — / — | — / — / — | 1% | 85% | 26% | 94% |

## max+stretch

| Variant | Results | Cars <80% | Cars <70% | Cars >100% | Stretch median / max | Above-budget earned / not earned / no priority | Winner changes vs current | Top-3 changes | Spend-less card | Tie |
|---|---|---|---|---|---|---|---|---|---|---|
| current (around 90–100, max 70–100) | 422 (+2 none) | 38% | 2% | 6% | +1% / +9% | 14% (fit +0.17) / 66% / 20% | — | — | 0% | 95% |
| 90–100 (both) | 422 (+2 none) | 6% | 2% | 7% | +2% / +9% | 13% (fit +0.17) / 65% / 21% | 2% | 84% | 26% | 93% |
| 85–110 (flat to 110) | 422 (+2 none) | 14% | 2% | 34% | +8% / +10% | 3% (fit +0.70) / 48% / 49% | 4% | 91% | 13% | 95% |
| 85–115 (flat to 110, steep 110–115) | 422 (+2 none) | 14% | 2% | 35% | +8% / +14% | 5% (fit +0.17) / 47% / 49% | 4% | 92% | 13% | 95% |
| 90–100 + earned-stretch rule | 422 (+2 none) | 6% | 2% | 1% | +7% / +9% | 92% (fit +0.17) / 0% / 8% | 2% | 87% | 26% | 93% |

## Pathological examples (up to 4 per kind per variant)

### current (around 90–100, max 70–100)

- extra spend not earned: 142 — e.g. SUV, no priorities | target @ 1M: Chery Tiggo 7 at 101% (no priority to justify it); SUV, space | max+stretch @ 1.5M: BAIC BJ30 at 105% (priority fit +0.000 vs best in budget); SUV, premium | max+stretch @ 2.6M: MINI Countryman at 101% (priority fit +0.000 vs best in budget); SUV, economy | max+stretch @ 4.3M: Li Auto L9 at 101% (priority fit +0.000 vs best in budget)
- main car under 70% of budget: 82 — e.g. 7 seats | target @ 5.1M: Kia Sorento at 69%; 7 seats | target @ 5.8M: ROX 01 at 62%; 7 seats | max @ 5.6M: ROX 01 at 64%; 7 seats | max+stretch @ 5.4M: Hyundai Santa Fe at 65%
- result lost vs current: none

### 90–100 (both)

- extra spend not earned: 146 — e.g. SUV, no priorities | target @ 1M: Chery Tiggo 7 at 101% (no priority to justify it); SUV, space | max+stretch @ 2.4M: Li Auto L6 at 106% (priority fit +0.000 vs best in budget); SUV, premium | max+stretch @ 2.5M: Li Auto L6 at 102% (priority fit +0.000 vs best in budget); SUV, economy | max+stretch @ 3.7M: ROX Adamas at 101% (priority fit +0.000 vs best in budget)
- main car under 70% of budget: 84 — e.g. 7 seats | target @ 5.1M: Kia Sorento at 69%; 7 seats | target @ 5.8M: Toyota Fortuner at 64%; 7 seats | max @ 5.6M: ROX 01 at 64%; 7 seats | max+stretch @ 5.4M: Hyundai Santa Fe at 65%
- result lost vs current: none

### 85–110 (flat to 110)

- extra spend not earned: 828 — e.g. SUV, no priorities | target @ 0.8M: Arcfox T1 at 106% (no priority to justify it); SUV, space | max+stretch @ 3M: Genesis GV60 at 108% (priority fit +0.000 vs best in budget); SUV, economy | max+stretch @ 1.8M: Volvo EX30 at 108% (priority fit +0.000 vs best in budget); SUV, no Chinese | max+stretch @ 3.3M: BMW X1 at 102% (no priority to justify it)
- main car under 70% of budget: 84 — e.g. 7 seats | target @ 5.1M: Kia Sorento at 69%; 7 seats | target @ 5.8M: Toyota Fortuner at 64%; 7 seats | max @ 5.6M: ROX 01 at 64%; 7 seats | max+stretch @ 5.4M: Hyundai Santa Fe at 65%
- result lost vs current: none

### 85–115 (flat to 110, steep 110–115)

- extra spend not earned: 830 — e.g. SUV, no priorities | target @ 0.8M: Arcfox T1 at 106% (no priority to justify it); SUV, space | max+stretch @ 3.4M: Li Auto L7 at 106% (priority fit +0.000 vs best in budget); SUV, economy | max+stretch @ 2.2M: Toyota bZ4X at 108% (priority fit +0.000 vs best in budget); SUV, no Chinese | max+stretch @ 3.3M: BMW X1 at 102% (no priority to justify it)
- main car under 70% of budget: 84 — e.g. 7 seats | target @ 5.1M: Kia Sorento at 69%; 7 seats | target @ 5.8M: Toyota Fortuner at 64%; 7 seats | max @ 5.6M: ROX 01 at 64%; 7 seats | max+stretch @ 5.4M: Hyundai Santa Fe at 65%
- result lost vs current: none

### 90–100 + earned-stretch rule

- extra spend not earned: 2 — e.g. 7 seats | target @ 1M: Jetour X70 at 110% (no priority to justify it); 7 seats | max+stretch @ 1M: Jetour X70 at 110% (no priority to justify it)
- main car under 70% of budget: 84 — e.g. 7 seats | target @ 5.1M: Kia Sorento at 69%; 7 seats | target @ 5.8M: Toyota Fortuner at 64%; 7 seats | max @ 5.6M: ROX 01 at 64%; 7 seats | max+stretch @ 5.4M: Hyundai Santa Fe at 65%
- result lost vs current: none

