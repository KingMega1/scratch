import type { SparePart } from './model';

/* SAMPLE / UNVERIFIED preview fixture (CEO design reference, 9 Nov). Generic part types per category only:
   no part numbers (all null), no prices (unknown or conflict only, i.e. no figure), no fitment claims.
   Replace with an accepted, sourced dataset before this page is indexed or promoted. */
export const PARTS_DATA_STATUS = 'SAMPLE_UNVERIFIED' as const;

export const SAMPLE_PARTS: readonly SparePart[] = [
  { id: 'oil-filter-oem', category: 'filters', kind: 'oem', name: { ar: 'فلتر زيت', en: 'Oil filter' }, partNumber: null, price: { state: 'unknown' } },
  { id: 'air-filter-am', category: 'filters', kind: 'aftermarket', name: { ar: 'فلتر هوا', en: 'Air filter' }, partNumber: null, price: { state: 'unknown' } },
  { id: 'brake-pads-front-am', category: 'brakes', kind: 'aftermarket', name: { ar: 'تيل فرامل أمامي', en: 'Front brake pads' }, partNumber: null, price: { state: 'unknown' } },
  { id: 'brake-discs-oem', category: 'brakes', kind: 'oem', name: { ar: 'ديسكات فرامل أمامية', en: 'Front brake discs' }, partNumber: null, price: { state: 'conflict' } },
  { id: 'battery-am', category: 'electrical', kind: 'aftermarket', name: { ar: 'بطارية', en: 'Battery' }, partNumber: null, price: { state: 'unknown' } },
  { id: 'shock-front-oem', category: 'suspension', kind: 'oem', name: { ar: 'مساعد أمامي', en: 'Front shock absorber' }, partNumber: null, price: { state: 'unknown' } },
  { id: 'tyre-am', category: 'tyres', kind: 'aftermarket', name: { ar: 'إطار', en: 'Tyre' }, note: { ar: 'المقاس حسب الموديل', en: 'Size depends on the model' }, partNumber: null, price: { state: 'unknown' } },
  { id: 'headlamp-oem', category: 'lighting', kind: 'oem', name: { ar: 'فانوس أمامي', en: 'Headlamp' }, partNumber: null, price: { state: 'unknown' } },
  { id: 'radiator-am', category: 'cooling', kind: 'aftermarket', name: { ar: 'رادياتير', en: 'Radiator' }, partNumber: null, price: { state: 'unknown' } },
  { id: 'mirror-oem', category: 'body', kind: 'oem', name: { ar: 'مراية جانبية', en: 'Side mirror' }, partNumber: null, price: { state: 'unknown' } },
  { id: 'charge-cable-oem', category: 'ev-cables', kind: 'oem', name: { ar: 'كابل شحن', en: 'Charging cable' }, note: { ar: 'متوافق حسب نوع الفيشة في العربية', en: 'Fit depends on the car’s plug type' }, partNumber: null, price: { state: 'conflict' } },
  { id: 'wallbox-am', category: 'home-chargers', kind: 'aftermarket', name: { ar: 'شاحن حائط', en: 'Wall charger' }, note: { ar: 'التركيب حسب العداد والتوصيلات', en: 'Installation depends on the meter and wiring' }, partNumber: null, price: { state: 'unknown' } },
];
