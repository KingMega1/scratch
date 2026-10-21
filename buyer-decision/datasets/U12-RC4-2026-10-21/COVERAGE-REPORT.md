# U12-RC4 recommendation coverage report (2026-10-21)

Dataset `U12-RC4-2026-10-21` built from P2 commit **aadc647** (handoff `p1-release-20261021.json`). Verified before build: canonical_u11.json sha256 9680fc78…f608 and catalogue-serving.release.json sha256 49756cd3…2ec4 equal the handoff; serving release `P2-CATALOGUE-U11-2026-10-21-RC2` (acceptance P2_ACCEPTED_FIELDS_ONLY). Engine E6.1-2026-10-14, transport T1.1-2026-10-15. **Candidate only**: production stays U11.

## Previous vs new coverage

| Measure | U11 (production) | U12-RC3 (15 Oct) | U12-RC4 (21 Oct) |
|---|---|---|---|
| Catalogue identities | 283 | 416 | 419 |
| Recommendable | 283 | 328 | 327 |
| Evidence-filtered (recommendable + P2-accepted price + no source hold) | — | 213 | 218 |
| Recommendable, price P2-accepted | — | 201 | 204 |
| Recommendable, price from official Tier A list | — | 17 | 19 |
| Recommendable, approved U11 price only | 283 | 110 | 104 |
| No current price | — | 43 | 43 |
| No size class | — | 33 | 35 |
| Policy scope (coupe/convertible/van) | — | 12 | 13 |
| Discontinued (P2/CEO decision) | — | 0 | 1 |

## What changed RC3 → RC4

- **Removed:** geely/emgrand-7, by the CEO model-status decision of 21 Oct (discontinued; its 1,827 registrations belong to the current Emgrand). It was recommendable in production U11 ("Unspecified trim", EGP 1.0M).
- **Evidence upgraded (already recommendable, now P2-accepted price):** chery/eq7, forthing/t5, forthing/t5-evo, gac/emzoom, jac/j7, jac/js4, soueast/s-08-dm.
- **Newly priced but still not recommendable:** kia/carnival (segment MPV-D not in the engine size map), geely/emgrand, geely/ex5-em-i, jac/js2, xpeng/gx, geely/ex5-em-r (no usable size class), kia/pv5 (van).
- **P2 price withdrawn (sites disagree), approved U11 price kept:** hongqi/hs3, hongqi/ousado.
- **Powertrain corrections consumed (P2 accepted.powertrains):** byd/sealion-6: ["ev","hybrid"] -> ["hybrid"]; geely/ex5: ["ev","hybrid"] -> ["ev"]; jetour/t2: ["hybrid","petrol"] -> ["petrol"]; kaiyi/x7: ["hybrid","petrol"] -> ["petrol"]; mercedes/glc: ["ev","petrol"] -> ["petrol"]; toyota/corolla: ["hybrid","petrol"] -> ["petrol"].
- **Official MG trims (P2 20 Oct):** MG 7 = Trophy only, MG GT = Luxury only; Luxury/Comfort are absent from the official list and not accepted. RC4 serves the official list.

## Still excluded and why

**No current price (43):** baic/beijing-x7, baic/x55e, bmw/2-series-gran-coupe, bmw/i3-sedan, bmw/i4, bmw/m8, byd/seal, byd/song-l, byd/tang-l, changan/cs35, chevrolet/spark-euv, deepal/s09, denza/b3, denza/b5, denza/b8, dongfeng/huge, dongfeng/l7, fiat/e-ulysse, forthing/friday, gmc/hummer-ev, hyundai/staria, jaguar/f-pace, land-rover/defender, land-rover/range-rover, land-rover/range-rover-evoque, land-rover/range-rover-sport, land-rover/range-rover-vogue, land-rover/velar, lotus/emeya, maserati/ghibli, mercedes/eqe, mercedes/eqs, mercedes/maybach-eqs-680, nissan/armada, nissan/n7, rehigh/rh8, toyota/camry, toyota/land-cruiser, toyota/land-cruiser-prado, venucia/v-online, volkswagen/id-era-9x, xpeng/mona-m03, xpeng/p7-plus

**No size class (35):** audi/rs-e-tron-gt, avatr/06, bmw/ix3-neue-klasse, byd/atto-2, byd/leopard-8, cadillac/lyriq, cadillac/optiq, chery/tiggo-7-pro-max, citroen/c5-aircross, dongfeng/shine, gac/aion-lx, gac/gs3-emzoom, geely/emgrand, geely/ex5-em-i, geely/ex5-em-r, genesis/electrified-g80, haval/h6-hev, haval/jolion-pro, haval/v7, hongqi/eh7, hongqi/ehs7, icaur/v27, jac/js2, jeep/grand-cherokee-l, kaiyi/x3-pro, kia/carnival, mercedes/g-580-eq, mercedes/maybach-s-580, mercedes/v-class, mhero/1, mitsubishi/outlander-sport, porsche/macan-electric, rely/r8, xpeng/gx, zeekr/007. Of these, 22 have only an accepted length, 11 have no size data, kia/carnival has segment MPV-D (unmapped), mhero/1 has an unspecified segment.

**Policy scope:** bmw/4-series, bmw/m4, bmw/z4, dodge/charger, ford/mustang, kia/pv5, mercedes/amg-gt, mercedes/cle, mercedes/sl, mg/cyberster, porsche/718, porsche/911, rolls-royce/spectre

**Discontinued:** geely/emgrand-7

## Official price lists consumed (23 models)

| Model | List date | Versions now | Replaced |
|---|---|---|---|
| mercedes/c-class | 2026-09-24 | C 180 Saloon / Avantgarde=3350000; C 180 Saloon / Sport=3905000; C 200 Saloon / Sport=4390000 | C 180 Avantgarde=3100000 MY2026; C 180 Sport=3650000 MY2026; C 200 Sport=4100000 MY2026; C 43=5800000 MY2026 |
| mercedes/cla | 2026-09-24 | CLA 180 / Progressive=2890000; CLA 200 / Sport=3390000 | CLA 200 Coupé=2930000 MY2026 |
| mercedes/e-class | 2026-09-24 | E 200 Saloon / Premium=4420000; E 200 Saloon / Avantgarde=5260000; E 200 Saloon / Sport=5870000; E 200 Saloon / Exclusive=5870000 | E 200=4920000 MY2026; E 200 Exclusive=5600000 MY2026; E 200 Sport=5600000 MY2026 |
| mercedes/eqa | 2026-09-24 | EQA 250+ / Progressive=3400000 | EQA 250+=3300000 MY2026 |
| mercedes/gla | 2026-09-24 | GLA 200 / Progressive=3140000 | GLA 200=2990000 MY2026 |
| mercedes/glc | 2026-09-24 | GLC 200 4M SUV / Avantgarde=4370000; GLC 200 4M Coupé / Avantgarde=4670000; GLC 200 4M SUV / Sport=4980000; GLC 200 4M Coupé / Sport=5460000 | GLC 200=4930000 MY2026 |
| mercedes/gle | 2026-09-24 | GLE 450 4M SUV / AMG=7200000; Mercedes-AMG GLE 53 4M+ / AMG=8220000 | GLE 450 4MATIC=7090000 MY2025; GLE 53 4MATIC+=8100000 MY2025 |
| mercedes/gls | 2026-09-24 | GLS 580 4M SUV / AMG=9930000 | GLS 580 4MATIC=9930000 MY2025 |
| mg/5 | 2026-10-15 | Comfort=889990; Luxury=989990 | - |
| mg/7 | 2026-10-15 | Trophy=1750000 | Luxury=1625000 MY2027 |
| mg/g50-plus | 2026-10-15 | G50 Plus=1325000 | (1 class)=1300000 MY2027 |
| mg/gt | 2026-10-15 | Luxury=1175000 | Comfort=1110000 MY2027 |
| mg/hs | 2026-10-15 | HS AS33 LUX=1550000; HS HEV=1650000 | Plus Luxury=1525000 MY2027; HEV=1625000 MY2027 |
| mg/one | 2026-10-15 | Luxury=1425000 | (1 class)=1400000 MY2027 |
| mg/rx9 | 2026-10-15 | RX9=1959990 | Luxury=1899000 MY2027; (1 class)=1900000 MY2027 |
| mg/zs | 2026-10-15 | ZS Plus=1165000 | Comfort=1075000 MY2027; Plus=1150000 MY2027; Facelift (1 class)=1150000 MY2027 |
| mercedes/glc-eq | 2026-09-24 | GLC 400 4M Electric / Sport=4900000 | - |
| mg/rx5 | 2026-10-15 | RX5+ Luxury=1475000 | - |
| mercedes/cle | 2026-09-24 | CLE 200 Sport Coupé / Sport=4650000 | - |
| mercedes/g-class | 2026-09-24 | G 500 AMG / Night Edition=13390000 | - |
| mercedes/g-580-eq | 2026-09-24 | G 580 Electric / Night Edition=11200000 | - |
| mercedes/v-class | 2026-09-24 | V 300 Long / Avantgarde=6825000 | - |
| mg/cyberster | 2026-10-15 | Cyberster=2850000 | - |

## Buyer scenarios

42 EN/AR scenarios (budgets, SUV/sedan, family, EV/HEV/PHEV, negation, premium, trade-offs, missing evidence): 669/669 assertions pass. Full table: `BUYER-SCENARIOS.md`.

## Regression corpus changes (57 cases, EN)

### RC3 → RC4
```
same 34 changed 23
L1 | Family sedan around EGP 1.4 million | equal:forthing/s7, xpeng/m03 [EGP 1,290,000 – EGP 1,370,000] -> equal:forthing/s7, xpeng/m03 [EGP 1,290,000 – EGP 1,400,000]
L5 | Family SUV around EGP 1.5M | equal:jetour/x70, citroen/c4-x, mitsubishi/eclipse-cross [EGP 1,095,000 – EGP 1,240,000] -> equal:forthing/t5-evo, baic/x55, mitsubishi/eclipse-cross [EGP 1,190,000 – EGP 1,220,000]
L7 | I'm considering Tucson and Sportage, family with kids | conflict:mitsubishi/destinator, mg/rx9, chery/tiggo-9 [EGP 1,650,000 – EGP 1,850,000] -> conflict:soueast/s-08-dm, mg/rx9, chery/tiggo-9 [EGP 1,800,000 – EGP 1,849,000]
A1 | About EGP 2M for an SUV | equal:kia/seltos, seat/ateca, nissan/x-trail [EGP 1,369,900 – EGP 1,625,000] -> equal:mg/hs, seat/ateca, nissan/x-trail [EGP 1,550,000 – EGP 1,650,000]
A3 | (guided) | equal:forthing/t5-evo, byd/sealion-5, geely/ex5 [EGP 1,190,000] -> equal:forthing/t5-evo, byd/sealion-5, geely/ex5 [EGP 1,190,000 – EGP 1,220,000]
B1 | EGP 1M, SUV | single:baic/x35, geely/gx3-pro, chery/tiggo-4-pro [EGP 900,000] -> single:baic/x35, geely/gx3-pro, haval/jolion [EGP 900,000]
B2 | EGP 1.5M SUV | equal:forthing/t5-evo, byd/sealion-5, geely/ex5 [EGP 1,190,000] -> equal:forthing/t5-evo, byd/sealion-5, geely/ex5 [EGP 1,190,000 – EGP 1,220,000]
F4 | Family sedan around EGP 1.4 million | equal:forthing/s7, xpeng/m03 [EGP 1,290,000 – EGP 1,370,000] -> equal:forthing/s7, xpeng/m03 [EGP 1,290,000 – EGP 1,400,000]
S3 | I'm considering Tucson and Sportage, family with kids | conflict:mitsubishi/destinator, mg/rx9, chery/tiggo-9 [EGP 1,650,000 – EGP 1,850,000] -> conflict:soueast/s-08-dm, mg/rx9, chery/tiggo-9 [EGP 1,800,000 – EGP 1,849,000]
G1 | I love the GLC or GLE, budget 1.5M | single:changan/cs75-plus, jetour/x70, mitsubishi/eclipse-cross [EGP 1,490,000] -> single:changan/cs75-plus, forthing/t5-evo, mitsubishi/eclipse-cross [EGP 1,490,000]
G2 | EGP 1.5M, I really like GLC/GLE because I want comfort and a | equal:bestune/t77-pro, kia/ev3, mitsubishi/eclipse-cross [EGP 1,150,000] -> equal:bestune/t77-pro, chevrolet/captiva, mitsubishi/eclipse-cross [EGP 1,150,000]
C1 | SUV 1.5 million, open to Chinese | equal:jetour/x70, citroen/c4-x, mitsubishi/eclipse-cross [EGP 1,095,000 – EGP 1,240,000] -> equal:forthing/t5-evo, baic/x55, mitsubishi/eclipse-cross [EGP 1,190,000 – EGP 1,220,000]
C2 | SUV 1.5 million, prefer not Chinese | equal:mitsubishi/outlander, citroen/c4-x, kia/seltos [EGP 1,375,000] -> equal:kia/seltos, citroen/c4-x, mitsubishi/eclipse-cross [EGP 1,369,900]
C3 | SUV 1.5 million, absolutely no Chinese brands | equal:mitsubishi/outlander, citroen/c4-x, kia/seltos [EGP 1,375,000] -> equal:kia/seltos, citroen/c4-x, mitsubishi/eclipse-cross [EGP 1,369,900]
C4 | عايز عربية عالية في حدود مليون ونص ومش عندي مشكلة في الصيني | equal:jetour/x70, citroen/c4-x, mitsubishi/eclipse-cross [EGP 1,095,000 – EGP 1,240,000] -> equal:forthing/t5-evo, baic/x55, mitsubishi/eclipse-cross [EGP 1,190,000 – EGP 1,220,000]
P1 | petrol only, 1.5M SUV | equal:jetour/x70, baic/x55, mitsubishi/eclipse-cross [EGP 1,095,000 – EGP 1,240,000] -> equal:jetour/x70, kaiyi/x7, mitsubishi/eclipse-cross [EGP 1,095,000 – EGP 1,240,000]
P3 | 1.5M SUV, open to EV | equal:jetour/x70, citroen/c4-x, mitsubishi/eclipse-cross [EGP 1,095,000 – EGP 1,240,000] -> equal:forthing/t5-evo, baic/x55, mitsubishi/eclipse-cross [EGP 1,190,000 – EGP 1,220,000]
P4 | no hybrid, no EV, SUV 1.5M | equal:jetour/x70, baic/x55, mitsubishi/eclipse-cross [EGP 1,095,000 – EGP 1,240,000] -> equal:jetour/x70, kaiyi/x7, mitsubishi/eclipse-cross [EGP 1,095,000 – EGP 1,240,000]
P5 | ميزانيتي مليون ونص ومش عايز صيني، عايزة عربية هايبرد للزحمة | equal:mitsubishi/outlander, citroen/c4-x, kia/seltos [EGP 1,375,000] -> equal:kia/seltos, citroen/c4-x, mitsubishi/eclipse-cross [EGP 1,369,900]
V1 | I need a car | equal:bestune/b70, mg/one, mitsubishi/eclipse-cross [EGP 1,225,000] -> equal:forthing/t5-evo, baic/x55, mitsubishi/eclipse-cross [EGP 1,190,000 – EGP 1,220,000]
V2 | small city car | equal:geely/ex2, arcfox/t1, dongfeng/box [EGP 749,900 – EGP 849,899] -> equal:arcfox/t1, byd/seagull, geely/ex2 [EGP 789,900 – EGP 849,900]
X2 | my dream car, SUV 2m | equal:kia/seltos, seat/ateca, nissan/x-trail [EGP 1,369,900 – EGP 1,625,000] -> equal:mg/hs, seat/ateca, nissan/x-trail [EGP 1,550,000 – EGP 1,650,000]
T6 | SUV | equal:changan/cs55, gac/gs4, mitsubishi/eclipse-cross [EGP 1,260,000] -> equal:changan/cs55, kia/seltos, mitsubishi/eclipse-cross [EGP 1,260,000]
```
### U11 (production) → RC4
```
same 11 changed 46
H2 | I want something around the Qashqai's size and price for my  | equal:haval/h6, geely/starray, mitsubishi/destinator [EGP 1,300,000 – EGP 1,490,000] -> equal:dfsk/e5-plus, chery/tiggo-8-pro-max, opel/grandland [EGP 1,494,900]
L1 | Family sedan around EGP 1.4 million | equal:forthing/s7, xpeng/m03 [EGP 1,290,000 – EGP 1,370,000] -> equal:forthing/s7, xpeng/m03 [EGP 1,290,000 – EGP 1,400,000]
L2 | Family SUV around EGP 1.8M, open to Chinese brands, technolo | equal:jetour/x90-plus, changan/cs75-plus, geely/monjaro [EGP 1,560,000] -> equal:jetour/x90-plus, geely/okavango, baic/bj30 [EGP 1,560,000]
L3 | Rugged SUV around EGP 2.5M with character, rough-road and of | equal:jetour/t2, toyota/bz4x, hyundai/tucson [EGP 1,900,000 – EGP 2,150,000] -> equal:deepal/g318, rehigh/rh6, zeekr/7x [EGP 2,100,000 – EGP 2,250,000]
L3a | عايز عربية اوف رود دفع رباعي متينة في حدود 2.5 مليون | equal:jetour/t2, toyota/bz4x, hyundai/tucson [EGP 1,900,000 – EGP 2,150,000] -> equal:deepal/g318, rehigh/rh6, zeekr/7x [EGP 2,100,000 – EGP 2,250,000]
L5 | Family SUV around EGP 1.5M | equal:jetour/x70, mg/one, mitsubishi/eclipse-cross [EGP 1,095,000 – EGP 1,240,000] -> equal:forthing/t5-evo, baic/x55, mitsubishi/eclipse-cross [EGP 1,190,000 – EGP 1,220,000]
L6 | 7-seat family car, maximum EGP 2.2M | equal:mg/rx9, chery/tiggo-9 [EGP 1,899,000 – EGP 1,900,000] -> equal:mg/rx9, nissan/x-trail, chery/tiggo-9 [EGP 1,959,990]
L7 | I'm considering Tucson and Sportage, family with kids | conflict:mg/rx9, chery/tiggo-9 [EGP 1,899,000 – EGP 1,900,000] -> conflict:soueast/s-08-dm, mg/rx9, chery/tiggo-9 [EGP 1,800,000 – EGP 1,849,000]
L8 | عايز ٧ راكب لمراتي والأولاد لحد 2.2 مليون | equal:mg/rx9, chery/tiggo-9 [EGP 1,899,000 – EGP 1,900,000] -> equal:mg/rx9, nissan/x-trail, chery/tiggo-9 [EGP 1,959,990]
A1 | About EGP 2M for an SUV | equal:kia/seltos, zeekr/x, nissan/x-trail [EGP 1,350,000 – EGP 1,625,000] -> equal:mg/hs, seat/ateca, nissan/x-trail [EGP 1,550,000 – EGP 1,650,000]
A2 | عايز عربية عالية في حدود 2.2 مليون | equal:soueast/s08, kia/ev3, toyota/bz4x [EGP 1,799,000] -> equal:byd/sealion-6-ev, kia/ev3, toyota/bz4x [EGP 1,799,000]
A3 | (guided) | equal:forthing/t5-evo, byd/sealion-5, geely/ex5 [EGP 1,190,000] -> equal:forthing/t5-evo, byd/sealion-5, geely/ex5 [EGP 1,190,000 – EGP 1,220,000]
B1 | EGP 1M, SUV | single:baic/x35, nissan/magnite, chery/tiggo-4-pro [EGP 900,000] -> single:baic/x35, geely/gx3-pro, haval/jolion [EGP 900,000]
B2 | EGP 1.5M SUV | equal:forthing/t5-evo, byd/sealion-5, geely/ex5 [EGP 1,190,000] -> equal:forthing/t5-evo, byd/sealion-5, geely/ex5 [EGP 1,190,000 – EGP 1,220,000]
B3 | SUV around 4 million | equal:audi/q3, bmw/x2, volvo/xc60 [EGP 2,799,000 – EGP 3,249,000] -> equal:audi/q3, honda/cr-v, volvo/xc60 [EGP 2,799,000 – EGP 3,249,000]
B4 | around 6 million, premium SUV | single:bmw/x2, mercedes/glc, porsche/macan [EGP 3,450,000 – EGP 4,950,000] -> single:bmw/x2, bmw/x3, porsche/macan [EGP 3,450,000 – EGP 4,950,000]
B5 | between 1.2 and 1.5 million sedan, no Kia | equal:bestune/b70, mg/6, toyota/corolla [EGP 1,225,000] -> equal:bestune/b70, changan/uni-v, lynk-co/03 [EGP 1,225,000]
F1 | 7-seater, maximum EGP 2.2M, wife + children | equal:mg/rx9, chery/tiggo-9 [EGP 1,899,000 – EGP 1,900,000] -> equal:mg/rx9, nissan/x-trail, chery/tiggo-9 [EGP 1,959,990]
F2 | عايز ٧ راكب لمراتي والأولاد واعتمادية مهمة، لحد 2.2 مليون | equal:mg/rx9, chery/tiggo-9 [EGP 1,899,000 – EGP 1,900,000] -> equal:mg/rx9, nissan/x-trail, chery/tiggo-9 [EGP 1,959,990]
F3 | 7-seat family car, 1.5m | equal:jetour/x70, soueast/s-07, chery/tiggo-8-pro [EGP 1,095,000 – EGP 1,240,000] -> equal:jetour/x70, dfsk/600, mitsubishi/xpander [EGP 1,095,000 – EGP 1,240,000]
F4 | Family sedan around EGP 1.4 million | equal:forthing/s7, xpeng/m03 [EGP 1,290,000 – EGP 1,370,000] -> equal:forthing/s7, xpeng/m03 [EGP 1,290,000 – EGP 1,400,000]
F5 | Family SUV around EGP 1.5M | single:changan/cs75-plus, jetour/x70, mitsubishi/eclipse-cross [EGP 1,480,000] -> single:changan/cs75-plus, jetour/x70, mitsubishi/eclipse-cross [EGP 1,490,000]
S3 | I'm considering Tucson and Sportage, family with kids | conflict:mg/rx9, chery/tiggo-9 [EGP 1,899,000 – EGP 1,900,000] -> conflict:soueast/s-08-dm, mg/rx9, chery/tiggo-9 [EGP 1,800,000 – EGP 1,849,000]
S4 | something Qashqai-sized | equal:haval/h6, geely/starray, mitsubishi/destinator [EGP 1,300,000 – EGP 1,490,000] -> equal:dfsk/e5-plus, chery/tiggo-8-pro-max, opel/grandland [EGP 1,494,900]
G1 | I love the GLC or GLE, budget 1.5M | single:changan/cs75-plus, jetour/x70, mitsubishi/eclipse-cross [EGP 1,480,000] -> single:changan/cs75-plus, forthing/t5-evo, mitsubishi/eclipse-cross [EGP 1,490,000]
G2 | EGP 1.5M, I really like GLC/GLE because I want comfort and a | equal:chery/tiggo-7-pro, chevrolet/captiva, mitsubishi/eclipse-cross [EGP 1,075,000 – EGP 1,175,000] -> equal:bestune/t77-pro, chevrolet/captiva, mitsubishi/eclipse-cross [EGP 1,150,000]
C1 | SUV 1.5 million, open to Chinese | equal:jetour/x70, mg/one, mitsubishi/eclipse-cross [EGP 1,095,000 – EGP 1,240,000] -> equal:forthing/t5-evo, baic/x55, mitsubishi/eclipse-cross [EGP 1,190,000 – EGP 1,220,000]
C2 | SUV 1.5 million, prefer not Chinese | equal:mitsubishi/outlander, renault/austral, kia/seltos [EGP 1,375,000] -> equal:kia/seltos, citroen/c4-x, mitsubishi/eclipse-cross [EGP 1,369,900]
C3 | SUV 1.5 million, absolutely no Chinese brands | equal:mitsubishi/outlander, renault/austral, kia/seltos [EGP 1,375,000] -> equal:kia/seltos, citroen/c4-x, mitsubishi/eclipse-cross [EGP 1,369,900]
C4 | عايز عربية عالية في حدود مليون ونص ومش عندي مشكلة في الصيني | equal:jetour/x70, mg/one, mitsubishi/eclipse-cross [EGP 1,095,000 – EGP 1,240,000] -> equal:forthing/t5-evo, baic/x55, mitsubishi/eclipse-cross [EGP 1,190,000 – EGP 1,220,000]
P1 | petrol only, 1.5M SUV | equal:jetour/x70, mg/one, mitsubishi/eclipse-cross [EGP 1,095,000 – EGP 1,240,000] -> equal:jetour/x70, kaiyi/x7, mitsubishi/eclipse-cross [EGP 1,095,000 – EGP 1,240,000]
P3 | 1.5M SUV, open to EV | equal:jetour/x70, mg/one, mitsubishi/eclipse-cross [EGP 1,095,000 – EGP 1,240,000] -> equal:forthing/t5-evo, baic/x55, mitsubishi/eclipse-cross [EGP 1,190,000 – EGP 1,220,000]
P4 | no hybrid, no EV, SUV 1.5M | equal:jetour/x70, mg/one, mitsubishi/eclipse-cross [EGP 1,095,000 – EGP 1,240,000] -> equal:jetour/x70, kaiyi/x7, mitsubishi/eclipse-cross [EGP 1,095,000 – EGP 1,240,000]
P5 | ميزانيتي مليون ونص ومش عايز صيني، عايزة عربية هايبرد للزحمة | equal:mitsubishi/outlander, renault/austral, kia/seltos [EGP 1,375,000] -> equal:kia/seltos, citroen/c4-x, mitsubishi/eclipse-cross [EGP 1,369,900]
Q1 | Family SUV around EGP 1.8M, open to Chinese brands, technolo | equal:jetour/x90-plus, changan/cs75-plus, geely/monjaro [EGP 1,560,000] -> equal:jetour/x90-plus, geely/okavango, baic/bj30 [EGP 1,560,000]
R1 | Rugged SUV around EGP 2.5M with character, rough-road and of | equal:jetour/t2, toyota/bz4x, hyundai/tucson [EGP 1,900,000 – EGP 2,150,000] -> equal:deepal/g318, rehigh/rh6, zeekr/7x [EGP 2,100,000 – EGP 2,250,000]
R2 | عايز عربية اوف رود متينة في حدود 2.5 مليون | equal:jetour/t2, toyota/bz4x, hyundai/tucson [EGP 1,900,000 – EGP 2,150,000] -> equal:deepal/g318, rehigh/rh6, zeekr/7x [EGP 2,100,000 – EGP 2,250,000]
V1 | I need a car | equal:bestune/b70, mg/one, mitsubishi/eclipse-cross [EGP 1,225,000] -> equal:forthing/t5-evo, baic/x55, mitsubishi/eclipse-cross [EGP 1,190,000 – EGP 1,220,000]
V2 | small city car | equal:geely/ex2, arcfox/t1, dongfeng/box [EGP 749,900 – EGP 849,899] -> equal:arcfox/t1, byd/seagull, geely/ex2 [EGP 789,900 – EGP 849,900]
X2 | my dream car, SUV 2m | equal:kia/seltos, zeekr/x, nissan/x-trail [EGP 1,350,000 – EGP 1,625,000] -> equal:mg/hs, seat/ateca, nissan/x-trail [EGP 1,550,000 – EGP 1,650,000]
T1 | SUV, maximum EGP 3M, I don't want a fully electric car | equal:byd/sealion-6, lynk-co/08 [EGP 1,949,900 – EGP 2,149,900] -> equal:byd/sealion-6, nissan/x-trail, lynk-co/08 [EGP 1,949,900 – EGP 2,149,900]
T1a | SUV max EGP 3M, no fully electric | equal:byd/sealion-6, lynk-co/08 [EGP 1,949,900 – EGP 2,149,900] -> equal:byd/sealion-6, nissan/x-trail, lynk-co/08 [EGP 1,949,900 – EGP 2,149,900]
T1b | عايز عربية عالية مش كهربا لحد 3 مليون | equal:byd/sealion-6, lynk-co/08 [EGP 1,949,900 – EGP 2,149,900] -> equal:byd/sealion-6, nissan/x-trail, lynk-co/08 [EGP 1,949,900 – EGP 2,149,900]
T4 | 7-seater around EGP 1M | no_match: [] -> single:baw/m7 [EGP 990,000]
T5 | SUV, maximum EGP 1.5M, can stretch a bit for the right car | single:changan/cs75-plus, jetour/x70, mitsubishi/eclipse-cross [EGP 1,480,000] -> single:changan/cs75-plus, jetour/x70, mitsubishi/eclipse-cross [EGP 1,490,000]
T6 | SUV | single:changan/cs75-plus, chery/tiggo-7-pro, renault/austral [EGP 1,480,000] -> equal:changan/cs55, kia/seltos, mitsubishi/eclipse-cross [EGP 1,260,000]
```
