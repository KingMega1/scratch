# CEO-observed recommendation failures: before (d553729) → after

Exact input → interpreted brief → eligible candidates → result. Before: d553729 code on U12-CEO-2026-11-03; after: fixed code on U12-CEO2-2026-11-03. Unasked follow-ups use defaults (budget 2M around, open powertrain/Chinese).

### 1 range: SUV from 1.2M to 1.5M

- Before: brief `{"budget": 1200000, "budgetMode": "around", "stretch": false, "body": ["suv"]}` · ceiling 1,320,000 · eligible 61 · equal/tie: bestune/t55 EGP 1,055,000, chery/tiggo-7-pro EGP 1,075,000 – EGP 1,175,000, jac/js8-pro EGP 1,150,000 – EGP 1,200,000
- After: brief `{"budget": 1500000, "budgetMin": 1200000, "budgetMode": "range", "stretch": false, "body": ["suv"]}` · ceiling 1,650,000 · eligible 110 · equal/tie: forthing/t5-evo EGP 1,190,000 – EGP 1,220,000, soueast/s-07 EGP 1,390,000 – EGP 1,415,000, mitsubishi/eclipse-cross EGP 1,400,000 – EGP 1,500,000

### 1 range AR: من 1.2 مليون لـ 1.5 مليون عربية عالية

- Before: brief `{"budget": 1200000, "budgetMode": "around", "stretch": false, "body": ["suv"]}` · ceiling 1,320,000 · eligible 61 · equal/tie: bestune/t55 EGP 1,055,000, chery/tiggo-7-pro EGP 1,075,000 – EGP 1,175,000, jac/js8-pro EGP 1,150,000 – EGP 1,200,000
- After: brief `{"budget": 1500000, "budgetMin": 1200000, "budgetMode": "range", "stretch": false, "body": ["suv"]}` · ceiling 1,650,000 · eligible 110 · equal/tie: forthing/t5-evo EGP 1,190,000 – EGP 1,220,000, soueast/s-07 EGP 1,390,000 – EGP 1,415,000, mitsubishi/eclipse-cross EGP 1,400,000 – EGP 1,500,000

### 1 +10%: SUV, budget 1.5M, can go up to 10% more

- Before: brief `{"budget": 1500000, "budgetMode": "max", "stretch": false, "body": ["suv"]}` · ceiling 1,500,000 · eligible 95 · equal/tie: forthing/t5-evo EGP 1,190,000 – EGP 1,220,000, soueast/s-07 EGP 1,390,000 – EGP 1,415,000, mitsubishi/eclipse-cross EGP 1,400,000 – EGP 1,500,000
- After: brief `{"budget": 1500000, "budgetMode": "max", "stretch": true, "body": ["suv"]}` · ceiling 1,650,000 · eligible 110 · equal/tie: forthing/t5-evo EGP 1,190,000 – EGP 1,220,000, soueast/s-07 EGP 1,390,000 – EGP 1,415,000, mitsubishi/eclipse-cross EGP 1,400,000 – EGP 1,500,000

### 1 +10% AR: عربية عالية ميزانيتي 1.5 مليون وممكن ازيد ١٠٪

- Before: brief `{"budget": 1500000, "budgetMode": "around", "stretch": false, "body": ["suv"]}` · ceiling 1,650,000 · eligible 110 · equal/tie: forthing/t5-evo EGP 1,190,000 – EGP 1,220,000, soueast/s-07 EGP 1,390,000 – EGP 1,415,000, mitsubishi/eclipse-cross EGP 1,400,000 – EGP 1,500,000
- After: brief `{"budget": 1500000, "budgetMode": "around", "stretch": true, "body": ["suv"]}` · ceiling 1,650,000 · eligible 110 · equal/tie: forthing/t5-evo EGP 1,190,000 – EGP 1,220,000, soueast/s-07 EGP 1,390,000 – EGP 1,415,000, mitsubishi/eclipse-cross EGP 1,400,000 – EGP 1,500,000

### 2 only: I only want a BYD, around 2M

- Before: brief `{"budget": 2000000, "budgetMode": "around", "stretch": false, "brandsPrefer": ["byd"]}` · ceiling 2,200,000 · eligible 154 · equal/tie: byd/sealion-5 EGP 1,479,900 – EGP 1,729,900, byd/sealion-6-ev EGP 1,799,000 – EGP 1,829,900, byd/sealion-6 EGP 1,949,900
- After: brief `{"budget": 2000000, "budgetMode": "around", "stretch": false, "brandsOnly": ["byd"]}` · ceiling 2,200,000 · eligible 4 · equal/tie: byd/sealion-5 EGP 1,479,900 – EGP 1,729,900, byd/sealion-6-ev EGP 1,799,000 – EGP 1,829,900, byd/sealion-6 EGP 1,949,900

### 2 only: BYD, nothing else, 1.8M

- Before: brief `{"budget": 1800000, "budgetMode": "around", "stretch": false, "brandsPrefer": ["byd"]}` · ceiling 1,980,000 · eligible 138 · equal/tie: byd/sealion-5 EGP 1,479,900 – EGP 1,729,900, byd/sealion-6-ev EGP 1,799,000
- After: brief `{"budget": 1800000, "budgetMode": "around", "stretch": false, "brandsOnly": ["byd"]}` · ceiling 1,980,000 · eligible 4 · equal/tie: byd/sealion-5 EGP 1,479,900 – EGP 1,729,900, byd/sealion-6-ev EGP 1,799,000

### 2 only AR: مش عايز غير BYD في حدود 2 مليون

- Before: brief `{"budget": 2000000, "budgetMode": "around", "stretch": false, "brandsExclude": ["byd"]}` · ceiling 2,200,000 · eligible 150 · equal/tie: mg/hs EGP 1,550,000 – EGP 1,650,000, zeekr/x EGP 1,699,000 – EGP 1,849,000, nissan/x-trail EGP 2,000,000
- After: brief `{"budget": 2000000, "budgetMode": "around", "stretch": false, "brandsOnly": ["byd"]}` · ceiling 2,200,000 · eligible 4 · equal/tie: byd/sealion-5 EGP 1,479,900 – EGP 1,729,900, byd/sealion-6-ev EGP 1,799,000 – EGP 1,829,900, byd/sealion-6 EGP 1,949,900

### 2 only AR: مش عايز غير تويوتا في حدود 1.5 مليون

- Before: brief `{"budget": 1500000, "budgetMode": "around", "stretch": false, "brandsExclude": ["toyota"]}` · ceiling 1,650,000 · eligible 109 · equal/tie: forthing/t5-evo EGP 1,190,000 – EGP 1,220,000, baic/x55 EGP 1,200,000 – EGP 1,415,000, mitsubishi/eclipse-cross EGP 1,400,000 – EGP 1,500,000
- After: brief `{"budget": 1500000, "budgetMode": "around", "stretch": false, "brandsOnly": ["toyota"]}` · ceiling 1,650,000 · eligible 1 · single/only: toyota/urban-cruiser EGP 1,430,000

### 2 list: Toyota or Hyundai only, 1.5M

- Before: brief `{"budget": 1500000, "budgetMode": "around", "stretch": false, "brandsOnly": ["hyundai"], "brandsPrefer": ["toyota"]}` · ceiling 1,650,000 · eligible 1 · single/only: hyundai/venue EGP 890,000 – EGP 965,000
- After: brief `{"budget": 1500000, "budgetMode": "around", "stretch": false, "brandsOnly": ["hyundai", "toyota"]}` · ceiling 1,650,000 · eligible 2 · single/lean: toyota/urban-cruiser EGP 1,430,000, hyundai/venue EGP 890,000 – EGP 965,000

### 2 except AR: عايز اي حاجه غير BYD في حدود 2 مليون

- Before: brief `{"budget": 2000000, "budgetMode": "around", "stretch": false, "brandsOnly": ["byd"]}` · ceiling 2,200,000 · eligible 4 · equal/tie: byd/sealion-5 EGP 1,479,900 – EGP 1,729,900, byd/sealion-6-ev EGP 1,799,000 – EGP 1,829,900, byd/sealion-6 EGP 1,949,900
- After: brief `{"budget": 2000000, "budgetMode": "around", "stretch": false, "brandsExclude": ["byd"]}` · ceiling 2,200,000 · eligible 150 · equal/tie: mg/hs EGP 1,550,000 – EGP 1,650,000, zeekr/x EGP 1,699,000 – EGP 1,849,000, nissan/x-trail EGP 2,000,000

### 2 brand: Mercedes-Benz only, 5M

- Before: brief `{"budget": 5000000, "budgetMode": "around", "stretch": false, "brandsOnly": ["mercedes"], "brandsPrefer": ["mercedes"]}` · ceiling 5,500,000 · eligible 6 · equal/tie: mercedes/glc-eq EGP 4,900,000, mercedes/glc EGP 4,370,000 – EGP 4,980,000
- After: brief `{"budget": 5000000, "budgetMode": "around", "stretch": false, "brandsOnly": ["mercedes"]}` · ceiling 5,500,000 · eligible 6 · equal/tie: mercedes/glc-eq EGP 4,900,000, mercedes/glc EGP 4,370,000 – EGP 4,980,000

### 3 running cost: SUV 2M, I care most about resale value and low running costs

- Before: brief `{"budget": 2000000, "budgetMode": "around", "stretch": false, "body": ["suv"], "checks": ["resale"]}` · ceiling 2,200,000 · eligible 154 · equal/tie: mg/hs EGP 1,550,000 – EGP 1,650,000, seat/ateca EGP 1,849,000, nissan/x-trail EGP 2,000,000
- After: brief `{"budget": 2000000, "budgetMode": "around", "stretch": false, "body": ["suv"], "priorities": ["economy"], "checks": ["resale"]}` · ceiling 2,200,000 · eligible 154 · equal/tie: geely/ex5 EGP 1,419,900 – EGP 1,569,900, haval/h7 EGP 1,725,000 – EGP 1,765,000, nissan/qashqai EGP 1,555,000 – EGP 2,000,000

### 3 fuel AR: عايز عربية عالية للعيلة في حدود 1.8 مليون، الأهم عندي البنزين والمساحة، ومش عايز صيني

- Before: brief `{"budget": 1800000, "budgetMode": "around", "stretch": false, "body": ["suv"], "pt": "petrol", "priorities": ["space"], "chinese": "exclude"}` · ceiling 1,980,000 · eligible 32 · equal/tie: toyota/urban-cruiser EGP 1,430,000 – EGP 1,530,000, mitsubishi/eclipse-cross EGP 1,400,000 – EGP 1,690,000, hyundai/tucson EGP 1,800,000
- After: brief `{"budget": 1800000, "budgetMode": "around", "stretch": false, "body": ["suv"], "priorities": ["space", "economy"], "chinese": "exclude"}` · ceiling 1,980,000 · eligible 40 · single/lean: kia/ev3 EGP 1,450,000, chevrolet/captiva-ev EGP 1,399,000 – EGP 1,499,000, volvo/ex30 EGP 1,790,000

### 5 PHEV: plug-in hybrid SUV around 1.8M, no fully electric cars

- Before: brief `{"budget": 1800000, "budgetMode": "around", "stretch": false, "body": ["suv"], "pt": "hybrid", "ptNo": ["ev"]}` · ceiling 1,980,000 · eligible 108 · equal/tie: dfsk/e5-plus EGP 1,494,900, soueast/s-06 EGP 1,649,000 – EGP 1,650,000, haval/h7 EGP 1,725,000 – EGP 1,765,000
- After: brief `{"budget": 1800000, "budgetMode": "around", "stretch": false, "body": ["suv"], "pt": "hybrid", "ptNo": ["ev"], "checks": ["plugin"]}` · ceiling 1,980,000 · eligible 108 · equal/tie: dfsk/e5-plus EGP 1,494,900, soueast/s-06 EGP 1,649,000 – EGP 1,650,000, haval/h7 EGP 1,725,000 – EGP 1,765,000

### 5 PHEV AR: عايز SUV هايبرد بتتشحن بحوالي ١.٨ مليون جنيه ومش عايز عربية كهربا بالكامل

- Before: brief `{"budget": 1800000, "budgetMode": "around", "stretch": false, "body": ["suv"], "pt": "hybrid", "ptNo": ["ev"]}` · ceiling 1,980,000 · eligible 108 · equal/tie: dfsk/e5-plus EGP 1,494,900, soueast/s-06 EGP 1,649,000 – EGP 1,650,000, haval/h7 EGP 1,725,000 – EGP 1,765,000
- After: brief `{"budget": 1800000, "budgetMode": "around", "stretch": false, "body": ["suv"], "pt": "hybrid", "ptNo": ["ev"], "checks": ["plugin"]}` · ceiling 1,980,000 · eligible 108 · equal/tie: dfsk/e5-plus EGP 1,494,900, soueast/s-06 EGP 1,649,000 – EGP 1,650,000, haval/h7 EGP 1,725,000 – EGP 1,765,000

### 5 EV: fully electric SUV around 2M

- Before: brief `{"budget": 2000000, "budgetMode": "around", "stretch": false, "body": ["suv"], "pt": "ev"}` · ceiling 2,200,000 · eligible 154 · equal/tie: geely/ex5 EGP 1,419,900 – EGP 1,569,900, arcfox/alpha-t5 EGP 1,499,900 – EGP 1,749,900, kia/ev3 EGP 1,450,000 – EGP 1,850,000
- After: brief `{"budget": 2000000, "budgetMode": "around", "stretch": false, "body": ["suv"], "pt": "ev"}` · ceiling 2,200,000 · eligible 154 · equal/tie: geely/ex5 EGP 1,419,900 – EGP 1,569,900, arcfox/alpha-t5 EGP 1,499,900 – EGP 1,749,900, kia/ev3 EGP 1,450,000 – EGP 1,850,000

### known GLC: I want a petrol SUV with maximum budget 5.5 million EGP. I am considering Mercedes GLC. No fully electric cars.

- Before: brief `{"budget": 5500000, "budgetMode": "max", "stretch": false, "body": ["suv"], "pt": "petrol", "ptNo": ["ev"]}` · ceiling 5,500,000 · eligible 121 · shortlist/lean: mercedes/glc EGP 4,370,000 – EGP 5,460,000, bmw/x2 EGP 3,450,000 – EGP 4,950,000
- After: brief `{"budget": 5500000, "budgetMode": "max", "stretch": false, "body": ["suv"], "pt": "petrol", "ptNo": ["ev"]}` · ceiling 5,500,000 · eligible 121 · shortlist/lean: mercedes/glc EGP 4,370,000 – EGP 5,460,000, bmw/x2 EGP 3,450,000 – EGP 4,950,000

### known Corolla: petrol sedan max 1.5M, Toyota Corolla

- Before: brief `{"budget": 1500000, "budgetMode": "max", "stretch": false, "body": ["sedan"], "pt": "petrol"}` · ceiling 1,500,000 · eligible 29 · shortlist/tie: toyota/corolla EGP 1,280,000 – EGP 1,480,000
- After: brief `{"budget": 1500000, "budgetMode": "max", "stretch": false, "body": ["sedan"], "pt": "petrol"}` · ceiling 1,500,000 · eligible 29 · shortlist/tie: toyota/corolla EGP 1,280,000 – EGP 1,480,000

### known EX5 AR: عايز جيلي اي اكس ٥ اي ام اي لحد ١.٨ مليون جنيه

- Before: brief `{"budget": 1800000, "budgetMode": "max", "stretch": false}` · ceiling 1,800,000 · eligible 123 · shortlist/tie: geely/ex5-em-i EGP 1,399,900 – EGP 1,549,900, mg/hs EGP 1,550,000 – EGP 1,650,000
- After: brief `{"budget": 1800000, "budgetMode": "max", "stretch": false}` · ceiling 1,800,000 · eligible 123 · shortlist/tie: geely/ex5-em-i EGP 1,399,900 – EGP 1,549,900, mg/hs EGP 1,550,000 – EGP 1,650,000

### known K4: Kia K4 max 1,510,000

- Before: brief `{"budget": 1510000, "budgetMode": "max", "stretch": false}` · ceiling 1,510,000 · eligible 36 · conflict/tie: hyundai/elantra EGP 1,020,000 – EGP 1,250,000, changan/uni-v EGP 1,365,000, toyota/corolla EGP 1,280,000 – EGP 1,480,000
- After: brief `{"budget": 1510000, "budgetMode": "max", "stretch": false}` · ceiling 1,510,000 · eligible 36 · conflict/tie: hyundai/elantra EGP 1,020,000 – EGP 1,250,000, changan/uni-v EGP 1,365,000, toyota/corolla EGP 1,280,000 – EGP 1,480,000

