# P1 → P3 copy request: named cars P1 cannot recommend (2026-10-14)

**Problem.** When a buyer names a car P1 can't recommend because data is missing, the released copy says either:
- "The X isn't sold new in Egypt at the moment" / "الـ X مش بتتباع جديدة في مصر دلوقتي", or
- under the heading "Your requirements rule out the cars you named", "The X don't meet one of your must-haves".

Both are false for cars that are on the Egyptian market but have no confirmed price or size class. Examples: Geely EX5 EM-i, Range Rover, Toyota Land Cruiser and the Denza B3/B5/B8 grey imports.

**P1 change (engine E6.1-2026-10-14; ranking unchanged).** The engine now reports the true reason:
- `unknown_price`: on the market, no current price.
- `unknown_size`: priced, but no confirmed size class (held so size/space ranking stays fair).
- `scope`: coupe/convertible, not covered by recommendations yet.

"Not sold in Egypt" is now used only for a car P2 marks off-sale.

**Drafts in `app/i18n.js`, marked `DRAFT pending P3 approval`. Please approve or replace; keys must stay.**

| Key | EN draft | AR draft |
|---|---|---|
| `conflict_h` (heading) | About the cars you named | عن العربيات اللي ذكرتها |
| `conflict.unknown_price` | We don’t have a current price for the {cars} yet, so we can’t recommend it. Below are the cars that fit your brief. | معندناش لسه سعر حالي للـ {cars}، فمش هنقدر نرشّحها. تحت العربيات المناسبة لطلبك. |
| `conflict.unknown_size` | We don’t have confirmed size details for the {cars} yet, so we can’t compare it fairly. Below are the cars that fit your brief. | معندناش لسه مقاسات مؤكدة للـ {cars}، فمش هنقدر نقارنها بشكل عادل. تحت العربيات المناسبة لطلبك. |
| `conflict.scope` | We don’t cover coupes and convertibles like the {cars} in recommendations yet. Below are the cars that fit your brief. | لسه مش بنرشّح عربيات كوبيه أو مكشوفة زي الـ {cars}. تحت العربيات المناسبة لطلبك. |
| `sl_out.unknown_size` | We don’t have confirmed size details for the {n} yet, so we can’t compare it fairly. | معندناش لسه مقاسات مؤكدة للـ {n}، فمش هنقدر نقارنها بشكل عادل. |
| `sl_out.scope` | We don’t cover coupes and convertibles like the {n} in recommendations yet. | لسه مش بنرشّح عربيات كوبيه أو مكشوفة زي الـ {n}. |

Existing approved copy reused unchanged: `sl_out.unknown_price` ("We don’t have a current price for the {n}." / "معندناش سعر حالي للـ {n}.").

**Also for P3 (pre-existing, not changed):** `conflict.other` reads "The {cars} don’t meet one of your must-haves", which is ungrammatical for a single car.

**Verification.** `node tests/named_cars.test.js` checks that no P2-identified market car is described as "not sold in Egypt" in EN or AR, and that the heading never claims the buyer's requirements ruled out a car that is only missing data.
