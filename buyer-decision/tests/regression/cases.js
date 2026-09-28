// P1.2 Step 0 — regression / diagnostic cases. These are NOT target answers: no case says which car must win.
// Each case is replayed through the same consultation flow the app uses (brief parse -> follow-ups -> confirm).
//   text:    what the buyer typed ('' = guided path, no text)
//   persona: how the buyer answers a follow-up if it is asked (unlisted questions get DEFAULT_ANSWERS)
//   script:  exact recorded answers, applied in order instead of simulating the questions (real sessions)
//   observed: what the live product showed at the time (recorded fact, for traceability only)
//   expect:  what the parser must understand from the text (understanding, not a car). known: open defect id
//            -> reported as KNOWN, does not fail the run until the defect is fixed (then remove 'known')
const DEFAULT_ANSWERS = {
  budget: { budget: 1500000, budgetMode: 'around' }, size: { sizePref: 'medium' }, pt: { pt: 'open' },
  chinese: { chinese: 'open' }, usage: { usage: 'mixed' }, priorities: { priorities: [] }, drive: { drive4: true },
  attraction: { attraction: 'size' }, body: { body: ['suv'] }, seats: { seats: 5 },
};

const CASES = [
  // --- human sessions (live, collector Sheet) ---
  { id: 'H1', group: 'human', lang: 'EN', note: 'Live session 5b467e66, 2026-09-27 — EGP 3M max+stretch, premium/space/economy, no full EV',
    text: 'A reliable suv with good resale value',
    script: [{ budget: 3000000, budgetMode: 'max', stretch: true }, { priorities: ['premium', 'space', 'economy'] }, { pt: 'no_ev' }, { chinese: 'open' }],
    observed: ['li-auto/l6', 'gmc/terrain', 'audi/q5'] },
  { id: 'H2', group: 'human', lang: 'EN', note: 'Qashqai-like reference journey (evidence-gap diagnostic)',
    text: "I want something around the Qashqai's size and price for my wife." },

  // --- live QA journeys (external QA, P1.1) ---
  { id: 'L1', group: 'live-qa', lang: 'EN', text: 'Family sedan around EGP 1.4 million', persona: { priorities: { priorities: ['space'] } } },
  { id: 'L2', group: 'live-qa', lang: 'EN', text: 'Family SUV around EGP 1.8M, open to Chinese brands, technology, value and comfort matter', persona: { priorities: { priorities: ['space'] } } },
  { id: 'L3', group: 'live-qa', lang: 'EN', text: 'Rugged SUV around EGP 2.5M with character, rough-road and off-road capability, strong brand, proven 4x4' },
  { id: 'L3a', group: 'live-qa', lang: 'AR', text: 'عايز عربية اوف رود دفع رباعي متينة في حدود 2.5 مليون' },
  { id: 'L4', group: 'live-qa', lang: 'EN', text: 'Premium SUV around EGP 2.8M, distinctive design, sporty driving character, premium brand' },
  { id: 'L4a', group: 'live-qa', lang: 'AR', text: 'عايز عربية عالية فخمة وشكلها مميز ورياضية في حدود 2.8 مليون' },
  { id: 'L5', group: 'live-qa', lang: 'EN', text: 'Family SUV around EGP 1.5M' },
  { id: 'L6', group: 'live-qa', lang: 'EN', text: '7-seat family car, maximum EGP 2.2M' },
  { id: 'L7', group: 'live-qa', lang: 'EN', text: "I'm considering Tucson and Sportage, family with kids", persona: { seats: { seats: 7 } } },
  { id: 'L8', group: 'live-qa', lang: 'AR', text: 'عايز ٧ راكب لمراتي والأولاد لحد 2.2 مليون' },

  // --- scenario catalogue (human-testing pack, 37 scenarios) ---
  { id: 'A1', group: 'catalogue', lang: 'EN', text: 'About EGP 2M for an SUV' },
  { id: 'A2', group: 'catalogue', lang: 'AR', text: 'عايز عربية عالية في حدود 2.2 مليون' },
  { id: 'A3', group: 'catalogue', lang: 'EN', text: '', persona: { budget: { budget: 1500000 }, body: { body: ['suv'] }, seats: { seats: 5 }, priorities: { priorities: ['economy'] } } },
  { id: 'B1', group: 'catalogue', lang: 'EN', text: 'EGP 1M, SUV', persona: { priorities: { priorities: ['space'] } } },
  { id: 'B2', group: 'catalogue', lang: 'EN', text: 'EGP 1.5M SUV', persona: { priorities: { priorities: ['economy'] } } },
  { id: 'B3', group: 'catalogue', lang: 'EN', text: 'SUV around 4 million' },
  { id: 'B4', group: 'catalogue', lang: 'EN', text: 'around 6 million, premium SUV' },
  { id: 'B5', group: 'catalogue', lang: 'EN', text: 'between 1.2 and 1.5 million sedan, no Kia' },
  { id: 'F1', group: 'catalogue', lang: 'EN', text: '7-seater, maximum EGP 2.2M, wife + children' },
  { id: 'F2', group: 'catalogue', lang: 'AR', text: 'عايز ٧ راكب لمراتي والأولاد واعتمادية مهمة، لحد 2.2 مليون' },
  { id: 'F3', group: 'catalogue', lang: 'EN', text: '7-seat family car, 1.5m' },
  { id: 'F4', group: 'catalogue', lang: 'EN', text: 'Family sedan around EGP 1.4 million', persona: { priorities: { priorities: ['space'] } } },
  { id: 'F5', group: 'catalogue', lang: 'EN', text: 'Family SUV around EGP 1.5M', persona: { priorities: { priorities: ['space'] } } },
  { id: 'S1', group: 'catalogue', lang: 'EN', text: "EGP 2M, I'm considering Tucson and Sportage." },
  { id: 'S2', group: 'catalogue', lang: 'AR', text: 'بفكر في توسان وسبورتاج ومعايا حوالي ٢ مليون' },
  { id: 'S3', group: 'catalogue', lang: 'EN', text: "I'm considering Tucson and Sportage, family with kids", persona: { seats: { seats: 7 } } },
  { id: 'S4', group: 'catalogue', lang: 'EN', text: 'something Qashqai-sized' },
  { id: 'G1', group: 'catalogue', lang: 'EN', text: 'I love the GLC or GLE, budget 1.5M', persona: { attraction: { attraction: 'size' } } },
  { id: 'G2', group: 'catalogue', lang: 'EN', text: 'EGP 1.5M, I really like GLC/GLE because I want comfort and a premium feel.' },
  { id: 'C1', group: 'catalogue', lang: 'EN', text: 'SUV 1.5 million, open to Chinese' },
  { id: 'C2', group: 'catalogue', lang: 'EN', text: 'SUV 1.5 million, prefer not Chinese' },
  { id: 'C3', group: 'catalogue', lang: 'EN', text: 'SUV 1.5 million, absolutely no Chinese brands' },
  { id: 'C4', group: 'catalogue', lang: 'AR', text: 'عايز عربية عالية في حدود مليون ونص ومش عندي مشكلة في الصيني' },
  { id: 'P1', group: 'catalogue', lang: 'EN', text: 'petrol only, 1.5M SUV' },
  { id: 'P2', group: 'catalogue', lang: 'EN', text: '1.5M SUV, I want a hybrid' },
  { id: 'P3', group: 'catalogue', lang: 'EN', text: '1.5M SUV, open to EV' },
  { id: 'P4', group: 'catalogue', lang: 'EN', text: 'no hybrid, no EV, SUV 1.5M' },
  { id: 'P5', group: 'catalogue', lang: 'AR', text: 'ميزانيتي مليون ونص ومش عايز صيني، عايزة عربية هايبرد للزحمة' },
  { id: 'Q1', group: 'catalogue', lang: 'EN', text: 'Family SUV around EGP 1.8M, open to Chinese brands, technology, value and comfort matter', persona: { priorities: { priorities: ['space'] } } },
  { id: 'R1', group: 'catalogue', lang: 'EN', text: 'Rugged SUV around EGP 2.5M with character, rough-road and off-road capability, strong brand, proven 4x4' },
  { id: 'R2', group: 'catalogue', lang: 'AR', text: 'عايز عربية اوف رود متينة في حدود 2.5 مليون' },
  { id: 'M1', group: 'catalogue', lang: 'EN', text: 'Premium SUV around EGP 2.8M, distinctive design, sporty driving character, premium brand' },
  { id: 'M2', group: 'catalogue', lang: 'AR', text: 'عايز عربية عالية فخمة وشكلها مميز ورياضية في حدود 2.8 مليون' },
  { id: 'V1', group: 'catalogue', lang: 'EN', text: 'I need a car', persona: { budget: { budget: 1500000, budgetMode: 'around' }, body: { bodyAny: true } } },
  { id: 'V2', group: 'catalogue', lang: 'EN', text: 'small city car', persona: { budget: { budget: 900000, budgetMode: 'around' }, body: { bodyAny: true } } },
  { id: 'X1', group: 'catalogue', lang: 'EN', text: 'Maximum EGP 1.5M, must be 7 seats, Mercedes only.' },
  { id: 'X2', group: 'catalogue', lang: 'EN', text: 'my dream car, SUV 2m' },

  // --- budget / powertrain probes (same need, one variable changed) ---
  { id: 'T1', group: 'probe', lang: 'EN', text: 'SUV, maximum EGP 3M, I don\'t want a fully electric car', persona: { priorities: { priorities: ['economy'] } },
    expect: { pt: 'no_ev' }, known: 'D1 negation "don\'t want a fully electric" parsed as pt=ev' },
  { id: 'T1a', group: 'probe', lang: 'EN', text: 'SUV max EGP 3M, no fully electric', persona: { priorities: { priorities: ['economy'] } }, expect: { pt: 'no_ev' } },
  { id: 'T1b', group: 'probe', lang: 'AR', text: 'عايز عربية عالية مش كهربا لحد 3 مليون', persona: { priorities: { priorities: ['economy'] } }, expect: { pt: 'no_ev' } },
  { id: 'T2', group: 'probe', lang: 'EN', text: 'SUV around EGP 3M, open to electric', persona: { priorities: { priorities: ['economy'] } }, expect: { pt: 'open' } },
  { id: 'T3', group: 'probe', lang: 'EN', text: 'SUV around EGP 3M', persona: { priorities: { priorities: ['premium'] } } },
];

// EN/AR pairs expressing the same need: parsed briefs are compared; results are compared when briefs agree
const PAIRS = [['T1a', 'T1b'], ['L3', 'L3a'], ['L4', 'L4a'], ['M1', 'M2'], ['C1', 'C4'], ['L6', 'L8'], ['S1', 'S2']];

module.exports = { CASES, PAIRS, DEFAULT_ANSWERS };
