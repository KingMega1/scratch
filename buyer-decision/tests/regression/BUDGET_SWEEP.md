# Budget-curve sensitivity sweep

Budgets EGP 0.8M–6M in 0.1M steps (53) × 7 profiles × 3 budget modes. Data U11-2026-09-26.

Price ratios are version price ÷ stated budget for all shown cars (main pick + alternatives). Churn = share of 0.1M steps where the main pick changes.

## Current curve

| Profile | Mode | Results | Median pick ratio | Cars <80% | Cars <70% | Cars >100% | Pick churn | Tie / lean / clear | Spend-less card | Widened |
|---|---|---|---|---|---|---|---|---|---|---|
| SUV, open | around | 53 | 0.87 | 0% | 0% | 4% | 83% | 100/0/0% | 21% | 0% |
| SUV, open | max | 53 | 0.70 | 38% | 0% | 0% | 87% | 100/0/0% | 0% | 0% |
| SUV, open | max+stretch | 53 | 0.70 | 38% | 0% | 4% | 87% | 100/0/0% | 0% | 0% |
| SUV, space | around | 53 | 0.89 | 9% | 0% | 17% | 31% | 72/28/0% | 8% | 0% |
| SUV, space | max | 53 | 0.81 | 27% | 0% | 0% | 19% | 85/15/0% | 0% | 0% |
| SUV, space | max+stretch | 53 | 0.83 | 24% | 0% | 14% | 15% | 79/21/0% | 0% | 0% |
| SUV, premium | around | 53 | 0.83 | 0% | 0% | 13% | 58% | 100/0/0% | 0% | 0% |
| SUV, premium | max | 53 | 0.72 | 35% | 0% | 0% | 56% | 100/0/0% | 0% | 0% |
| SUV, premium | max+stretch | 53 | 0.72 | 35% | 0% | 13% | 52% | 100/0/0% | 0% | 0% |
| SUV, hybrid | around | 53 | 0.83 | 10% | 0% | 5% | 48% | 92/8/0% | 21% | 0% |
| SUV, hybrid | max | 53 | 0.73 | 41% | 0% | 0% | 46% | 92/8/0% | 0% | 0% |
| SUV, hybrid | max+stretch | 53 | 0.73 | 40% | 0% | 6% | 48% | 92/8/0% | 0% | 0% |
| SUV, no Chinese | around | 53 | 0.88 | 1% | 0% | 4% | 73% | 94/6/0% | 42% | 0% |
| SUV, no Chinese | max | 53 | 0.71 | 36% | 0% | 0% | 71% | 98/0/0% | 0% | 0% |
| SUV, no Chinese | max+stretch | 53 | 0.71 | 36% | 0% | 3% | 71% | 98/2/0% | 0% | 0% |
| Sedan, open | around | 53 | 0.89 | 0% | 0% | 2% | 60% | 100/0/0% | 64% | 0% |
| Sedan, open | max | 53 | 0.72 | 40% | 0% | 0% | 56% | 100/0/0% | 0% | 0% |
| Sedan, open | max+stretch | 53 | 0.72 | 39% | 0% | 1% | 56% | 100/0/0% | 0% | 0% |
| 7 seats | around | 51 (+2 none) | 0.87 | 33% | 20% | 1% | 31% | 94/4/0% | 43% | 20% |
| 7 seats | max | 50 (+3 none) | 0.72 | 54% | 18% | 0% | 29% | 98/0/0% | 0% | 20% |
| 7 seats | max+stretch | 51 (+2 none) | 0.72 | 54% | 18% | 1% | 29% | 96/2/0% | 0% | 20% |

## Variants vs current

| Variant | Main pick changes | Top-3 set changes | Cars <80% (cur → var) | Cars >100% (cur → var) | Pick churn (cur → var) | Spend-less card (cur → var) |
|---|---|---|---|---|---|---|
| below slope ×2 (1.0) | 21% | 21% | 28% → 28% | 4% → 5% | 53% → 54% | 9% → 15% |
| below slope ÷2 (0.25) | 22% | 23% | 28% → 32% | 4% → 4% | 53% → 51% | 9% → 4% |
| around: flat from 80% | 25% | 26% | 28% → 36% | 4% → 4% | 53% → 51% | 9% → 1% |
| max: flat from 80% | 37% | 38% | 28% → 23% | 4% → 4% | 53% → 52% | 9% → 12% |
| max: flat from 90% | 54% | 56% | 28% → 8% | 4% → 4% | 53% → 55% | 9% → 28% |
| stretch penalty ÷2 (1) | 1% | 17% | 28% → 28% | 4% → 9% | 53% → 53% | 9% → 9% |
| spend-less floor 60% | 44% | 45% | 28% → 32% | 4% → 4% | 53% → 50% | 9% → 22% |
| spend-less floor 80% | 54% | 56% | 28% → 5% | 4% → 5% | 53% → 56% | 9% → 2% |
