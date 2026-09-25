window.CI_UNIVERSE = {
 "meta": {
  "source_schema": "carindex.p1.buyer_view/v2",
  "slice": "suv_2m_v1",
  "generated_as_of": "2026-09-25",
  "universe_rule": {
   "body_type": "carindex_master.body_type_normalized contains 'SUV'",
   "price_band_egp": [
    1600000,
    2400000
   ],
   "price_rule": "at least one numeric official_price in S0 (2026-09-10) for the model falls in, or the model's official price range overlaps, the band (+/-20% of EGP 2.0M)",
   "registration_window": [
    "2025-09",
    "2026-08"
   ],
   "registration_min": 500,
   "registration_rule": "passenger first-registrations in the window via ACCEPTED registration aliases >= registration_min",
   "note": "Models that pass the price rule but whose registration link is REJECTED/unresolved are kept in the output with in_slice=false and a gap entry, so P1 sees them as known-unknowns."
  },
  "snapshots": [
   "S0_2026-09-10",
   "S1_2026-09-25"
  ],
  "p2_view_sha256": "61d8f5339fb3b700d23e66fc170c6560b737e4f9eed4293ae55575948040780c",
  "p2_inputs": [
   {
    "path": "s0_slice_master.csv",
    "sha256": "25125c60665a1fabfe767d2de8f01c61d7d661b86471bbc39d4dff946c753d3b"
   },
   {
    "path": "registration_slice.json",
    "sha256": "844f4adc4016334609e9e6d78f893fb568f332d346f4bcc99047e4ec8c741e56"
   },
   {
    "path": "snapshots/S1_2026-09-25/observations_parsed.csv",
    "sha256": "9574ff56f7b589897a5742bc96a389f10e019b2886d05ae95a8597b4eecab6bf"
   },
   {
    "path": "snapshots/S1_2026-09-25/contactcars_pricetable_cells.csv",
    "sha256": "5b840da0a4455d9b6ec3e84a635c39536934939fe21271c8e1865d1fe572ad31"
   },
   {
    "path": "registry/models.csv",
    "sha256": "2025ec6f01861961b72218f3b5e5f564a72b984901d84d706342373cacd19e87"
   },
   {
    "path": "crosswalk/scrape_aliases.csv",
    "sha256": "b045570bc7cf267e4a6ba28e768f93f46b442f088ae0cb247c0188caa41155d6"
   },
   {
    "path": "crosswalk/registration_aliases.csv",
    "sha256": "fad9e5baa5f0e2f1ea7192f00522ffc6030400a35b312b317572fc0c950623f1"
   },
   {
    "path": "crosswalk/trim_synonyms.csv",
    "sha256": "5356c15ba423f6f924c3b7f1ec33fc234a8cf97be5443279e9808fd53399e45e"
   }
  ],
  "adapter": "buyer-decision/data/adapt_p2.py A1-2026-09-25",
  "models_in_slice": 21,
  "out_of_slice_known": [
   "BYD Song Plus",
   "Citroën C5 Aircross",
   "BYD Song L DM-i"
  ],
  "budget_anchor_egp": 2000000,
  "band": [
   1600000,
   2400000
  ],
  "not_in_data": [
   "reliability",
   "running cost",
   "resale value",
   "safety rating"
  ]
 },
 "models": [
  {
   "id": "m_000001",
   "slug": "kia-sportage",
   "brand": "Kia",
   "model": "Sportage",
   "id_status": "PROVISIONAL",
   "model_year": 2027,
   "price_from": {
    "status": "RESOLVED_RANGE",
    "value": null,
    "value_min": 1824900,
    "value_max": 1825000,
    "trim_key": "lx",
    "confidence": "MEDIUM",
    "model_year": 2027,
    "unresolved_trims_in_cohort": [],
    "basis": "derived: min official price across trims of the latest model-year cohort that has any numeric official price"
   },
   "trims": [
    {
     "key": "lx",
     "label": "LX",
     "labels": [
      "A/T / LX",
      "LX"
     ],
     "status": "NEAR_AGREEMENT",
     "confidence": "MEDIUM",
     "value": null,
     "min": 1824900,
     "max": 1825000,
     "sources": [
      "contactcars",
      "egycar",
      "hatla2ee"
     ],
     "observed_at": "2026-09-25T10:28:21Z",
     "urls": [
      "https://eg.hatla2ee.com/en/new-car/kia/sportage",
      "https://www.contactcars.com/en/new-cars/kia-sportage/year-2027",
      "https://www.egy-car.com/kia-sportage"
     ],
     "powertrain": "petrol",
     "plugin": false,
     "powertrain_basis": "model",
     "changes": []
    },
    {
     "key": "ex",
     "label": "EX",
     "labels": [
      "A/T / EX",
      "EX"
     ],
     "status": "NEAR_AGREEMENT",
     "confidence": "MEDIUM",
     "value": null,
     "min": 1924900,
     "max": 1925000,
     "sources": [
      "contactcars",
      "egycar",
      "hatla2ee"
     ],
     "observed_at": "2026-09-25T10:28:21Z",
     "urls": [
      "https://eg.hatla2ee.com/en/new-car/kia/sportage",
      "https://www.contactcars.com/en/new-cars/kia-sportage/year-2027",
      "https://www.egy-car.com/kia-sportage"
     ],
     "powertrain": "petrol",
     "plugin": false,
     "powertrain_basis": "model",
     "changes": []
    },
    {
     "key": "highline",
     "label": "Highline",
     "labels": [
      "A/T / Highline",
      "Highline"
     ],
     "status": "NEAR_AGREEMENT",
     "confidence": "MEDIUM",
     "value": null,
     "min": 2074900,
     "max": 2075000,
     "sources": [
      "contactcars",
      "egycar",
      "hatla2ee"
     ],
     "observed_at": "2026-09-25T10:28:21Z",
     "urls": [
      "https://eg.hatla2ee.com/en/new-car/kia/sportage",
      "https://www.contactcars.com/en/new-cars/kia-sportage/year-2027",
      "https://www.egy-car.com/kia-sportage"
     ],
     "powertrain": "petrol",
     "plugin": false,
     "powertrain_basis": "model",
     "changes": []
    },
    {
     "key": "premium",
     "label": "Premium",
     "labels": [
      "A/T / Premium",
      "Premium"
     ],
     "status": "NEAR_AGREEMENT",
     "confidence": "MEDIUM",
     "value": null,
     "min": 2299900,
     "max": 2300000,
     "sources": [
      "contactcars",
      "egycar",
      "hatla2ee"
     ],
     "observed_at": "2026-09-25T10:28:21Z",
     "urls": [
      "https://eg.hatla2ee.com/en/new-car/kia/sportage",
      "https://www.contactcars.com/en/new-cars/kia-sportage/year-2027",
      "https://www.egy-car.com/kia-sportage"
     ],
     "powertrain": "petrol",
     "plugin": false,
     "powertrain_basis": "model",
     "changes": []
    },
    {
     "key": "gtline",
     "label": "GT-line",
     "labels": [
      "A/T / GT-line",
      "GT Line",
      "GT-line",
      "GT-line:"
     ],
     "status": "NEAR_AGREEMENT",
     "confidence": "MEDIUM",
     "value": null,
     "min": 2399900,
     "max": 2400000,
     "sources": [
      "contactcars",
      "egycar",
      "hatla2ee"
     ],
     "observed_at": "2026-09-25T10:28:21Z",
     "urls": [
      "https://eg.hatla2ee.com/en/new-car/kia/sportage",
      "https://www.contactcars.com/en/new-cars/kia-sportage/year-2027",
      "https://www.egy-car.com/kia-sportage"
     ],
     "powertrain": "petrol",
     "plugin": false,
     "powertrain_basis": "model",
     "changes": []
    }
   ],
   "unpriced_trims": 0,
   "powertrains": [
    "petrol"
   ],
   "specs": {
    "seats": null,
    "transmission": {
     "status": "MULTIPLE_VALUES",
     "values": [
      {
       "value": "7-speed DCT DRY",
       "sources": [
        "EgyCar"
       ]
      },
      {
       "value": "Dual Clutch",
       "sources": [
        "ContactCars"
       ]
      }
     ]
    },
    "engine_capacity": {
     "status": "MULTIPLE_VALUES",
     "values": [
      {
       "value": "1600cc",
       "sources": [
        "Hatla2ee"
       ]
      },
      {
       "value": "1600cc turbo",
       "sources": [
        "EgyCar"
       ]
      }
     ]
    },
    "horsepower": {
     "status": "SINGLE_VALUE",
     "values": [
      {
       "value": "180",
       "sources": [
        "EgyCar"
       ]
      }
     ]
    },
    "drive_type": {
     "status": "SINGLE_VALUE",
     "values": [
      {
       "value": "FWD",
       "sources": [
        "EgyCar"
       ]
      }
     ]
    },
    "fuel_type_raw": null,
    "warranty": {
     "status": "MULTIPLE_VALUES",
     "values": [
      {
       "value": "100,000km/5yr",
       "sources": [
        "Hatla2ee"
       ]
      },
      {
       "value": "5yr/150,000km",
       "sources": [
        "EgyCar"
       ]
      }
     ]
    },
    "length": {
     "status": "SINGLE_VALUE",
     "values": [
      {
       "value": "451.5cm",
       "sources": [
        "EgyCar"
       ]
      }
     ]
    },
    "trunk_capacity": {
     "status": "SINGLE_VALUE",
     "values": [
      {
       "value": "591L (1780L folded)",
       "sources": [
        "EgyCar"
       ]
      }
     ]
    },
    "fuel_consumption": null,
    "electric_range": null,
    "battery_capacity": null
   },
   "warranty_years_max": 5,
   "registration": {
    "count": 6345,
    "rank": 1,
    "of": 21,
    "share": 0.1562,
    "yoy": -0.054,
    "first_seen": "2021-02",
    "mix": {
     "ICE": 6345
    },
    "last12": [
     [
      "2025-09",
      639
     ],
     [
      "2025-10",
      702
     ],
     [
      "2025-11",
      587
     ],
     [
      "2025-12",
      508
     ],
     [
      "2026-01",
      493
     ],
     [
      "2026-02",
      413
     ],
     [
      "2026-03",
      674
     ],
     [
      "2026-04",
      415
     ],
     [
      "2026-05",
      477
     ],
     [
      "2026-07",
      674
     ],
     [
      "2026-08",
      763
     ]
    ],
    "window": {
     "start": "2025-09",
     "end": "2026-08",
     "months_present": [
      "2025-09",
      "2025-10",
      "2025-11",
      "2025-12",
      "2026-01",
      "2026-02",
      "2026-03",
      "2026-04",
      "2026-05",
      "2026-07",
      "2026-08"
     ],
     "months_missing": [
      "2026-06"
     ]
    },
    "unit": "first registrations (licences), passenger vehicles; not sales",
    "alias_pending_review": false
   },
   "freshness": {
    "price_snapshots": [
     {
      "id": "S0_2026-09-10",
      "observed_at": "2026-09-10",
      "model_observed": true
     },
     {
      "id": "S1_2026-09-25",
      "observed_at": "2026-09-25",
      "model_observed": true
     }
    ],
    "source_stated_price_dates": [
     "2026-06-22"
    ],
    "spec_snapshot": "2026-09-10",
    "registration_data_through": "2026-08"
   },
   "conflicts": [],
   "gaps": [],
   "review_open": []
  },
  {
   "id": "m_000002",
   "slug": "hyundai-tucson",
   "brand": "Hyundai",
   "model": "Tucson",
   "id_status": "PROVISIONAL",
   "model_year": 2027,
   "price_from": {
    "status": "CONFLICT",
    "value": null,
    "candidate_min": 1775000,
    "detail": "the cheapest trim(s) of this cohort have conflicting or unresolved official prices",
    "model_year": 2027,
    "unresolved_trims_in_cohort": [
     "blackdiamond",
     "blaze",
     "night",
     "redline",
     "redlinenpack",
     "shadow"
    ],
    "basis": "derived: min official price across trims of the latest model-year cohort that has any numeric official price"
   },
   "trims": [
    {
     "key": "shadow",
     "label": "SHADOW",
     "labels": [
      "A/T / SHADOW",
      "SHADOW",
      "Shadow"
     ],
     "status": "CONFLICT",
     "confidence": "LOW",
     "value": null,
     "min": 1775000,
     "max": 1800000,
     "sources": [
      "contactcars",
      "egycar",
      "hatla2ee"
     ],
     "observed_at": "2026-09-25T10:28:21Z",
     "urls": [
      "https://eg.hatla2ee.com/en/new-car/hyundai/tucson",
      "https://www.contactcars.com/en/new-cars/hyundai-tucson/year-2027",
      "https://www.egy-car.com/hyundai-tucson"
     ],
     "powertrain": "petrol",
     "plugin": false,
     "powertrain_basis": "model",
     "changes": []
    },
    {
     "key": "blaze",
     "label": "Blaze",
     "labels": [
      "A/T / Blaze",
      "BLAZE",
      "Blaze"
     ],
     "status": "CONFLICT",
     "confidence": "LOW",
     "value": null,
     "min": 1925000,
     "max": 1950000,
     "sources": [
      "contactcars",
      "egycar",
      "hatla2ee"
     ],
     "observed_at": "2026-09-25T10:28:21Z",
     "urls": [
      "https://eg.hatla2ee.com/en/new-car/hyundai/tucson",
      "https://www.contactcars.com/en/new-cars/hyundai-tucson/year-2027",
      "https://www.egy-car.com/hyundai-tucson"
     ],
     "powertrain": "petrol",
     "plugin": false,
     "powertrain_basis": "model",
     "changes": []
    },
    {
     "key": "redline",
     "label": "REDLINE",
     "labels": [
      "A/T / Redine",
      "REDLINE",
      "RedLine",
      "Redine"
     ],
     "status": "CONFLICT",
     "confidence": "LOW",
     "value": null,
     "min": 2025000,
     "max": 2050000,
     "sources": [
      "contactcars",
      "egycar",
      "hatla2ee"
     ],
     "observed_at": "2026-09-25T10:28:21Z",
     "urls": [
      "https://eg.hatla2ee.com/en/new-car/hyundai/tucson",
      "https://www.contactcars.com/en/new-cars/hyundai-tucson/year-2027",
      "https://www.egy-car.com/hyundai-tucson"
     ],
     "powertrain": "petrol",
     "plugin": false,
     "powertrain_basis": "model",
     "changes": []
    },
    {
     "key": "redlinenline",
     "label": "REDLINE N-Line",
     "labels": [
      "REDLINE N-Line"
     ],
     "status": "SINGLE_SOURCE",
     "confidence": "MEDIUM",
     "value": 2125000,
     "min": 2125000,
     "max": 2125000,
     "sources": [
      "egycar"
     ],
     "observed_at": "2026-09-10",
     "urls": [
      "https://www.egy-car.com/hyundai-tucson"
     ],
     "powertrain": "petrol",
     "plugin": false,
     "powertrain_basis": "model",
     "changes": []
    },
    {
     "key": "redlinenpack",
     "label": "REDLINE (N Pack)",
     "labels": [
      "A/T / Redine (N Pack)",
      "REDLINE (N Pack)",
      "Redine (N Pack)"
     ],
     "status": "CONFLICT",
     "confidence": "LOW",
     "value": null,
     "min": 2100000,
     "max": 2125000,
     "sources": [
      "contactcars",
      "hatla2ee"
     ],
     "observed_at": "2026-09-25T10:28:14Z",
     "urls": [
      "https://eg.hatla2ee.com/en/new-car/hyundai/tucson",
      "https://www.contactcars.com/en/new-cars/hyundai-tucson/year-2027"
     ],
     "powertrain": "petrol",
     "plugin": false,
     "powertrain_basis": "model",
     "changes": []
    },
    {
     "key": "night",
     "label": "NIGHT",
     "labels": [
      "A/T / NIGHT",
      "NIGHT",
      "Night"
     ],
     "status": "CONFLICT",
     "confidence": "LOW",
     "value": null,
     "min": 2175000,
     "max": 2200000,
     "sources": [
      "contactcars",
      "egycar",
      "hatla2ee"
     ],
     "observed_at": "2026-09-25T10:28:21Z",
     "urls": [
      "https://eg.hatla2ee.com/en/new-car/hyundai/tucson",
      "https://www.contactcars.com/en/new-cars/hyundai-tucson/year-2027",
      "https://www.egy-car.com/hyundai-tucson"
     ],
     "powertrain": "petrol",
     "plugin": false,
     "powertrain_basis": "model",
     "changes": []
    },
    {
     "key": "blackdiamond",
     "label": "BLACK DIAMOND",
     "labels": [
      "A/T / BLACK DIAMOND",
      "BLACK DIAMOND",
      "Black Diamond"
     ],
     "status": "CONFLICT",
     "confidence": "LOW",
     "value": null,
     "min": 2275000,
     "max": 2300000,
     "sources": [
      "contactcars",
      "egycar",
      "hatla2ee"
     ],
     "observed_at": "2026-09-25T10:28:21Z",
     "urls": [
      "https://eg.hatla2ee.com/en/new-car/hyundai/tucson",
      "https://www.contactcars.com/en/new-cars/hyundai-tucson/year-2027",
      "https://www.egy-car.com/hyundai-tucson"
     ],
     "powertrain": "petrol",
     "plugin": false,
     "powertrain_basis": "model",
     "changes": []
    },
    {
     "key": "nline",
     "label": "N-Line",
     "labels": [
      "A/T / N-Line",
      "N-Line",
      "NLINE"
     ],
     "status": "SINGLE_SOURCE",
     "confidence": "MEDIUM",
     "value": 2375000,
     "min": 2375000,
     "max": 2375000,
     "sources": [
      "hatla2ee"
     ],
     "observed_at": "2026-09-25T10:28:05Z",
     "urls": [
      "https://eg.hatla2ee.com/en/new-car/hyundai/tucson"
     ],
     "powertrain": "petrol",
     "plugin": false,
     "powertrain_basis": "model",
     "changes": []
    },
    {
     "key": "nlineawd",
     "label": "NLINE (AWD)",
     "labels": [
      "NLINE (AWD)"
     ],
     "status": "SINGLE_SOURCE",
     "confidence": "MEDIUM",
     "value": 2400000,
     "min": 2400000,
     "max": 2400000,
     "sources": [
      "contactcars"
     ],
     "observed_at": "2026-09-25T10:28:14Z",
     "urls": [
      "https://www.contactcars.com/en/new-cars/hyundai-tucson/year-2027"
     ],
     "powertrain": "petrol",
     "plugin": false,
     "powertrain_basis": "model",
     "changes": []
    }
   ],
   "unpriced_trims": 1,
   "powertrains": [
    "petrol"
   ],
   "specs": {
    "seats": {
     "status": "SINGLE_VALUE",
     "values": [
      {
       "value": "5",
       "sources": [
        "ContactCars"
       ]
      }
     ]
    },
    "transmission": {
     "status": "MULTIPLE_VALUES",
     "values": [
      {
       "value": "7-speed DCT DRY",
       "sources": [
        "EgyCar"
       ]
      },
      {
       "value": "Automatic",
       "sources": [
        "ContactCars"
       ]
      },
      {
       "value": "Dual Clutch",
       "sources": [
        "ContactCars"
       ]
      }
     ]
    },
    "engine_capacity": {
     "status": "MULTIPLE_VALUES",
     "values": [
      {
       "value": "1600cc",
       "sources": [
        "Hatla2ee"
       ]
      },
      {
       "value": "1600cc turbo",
       "sources": [
        "EgyCar"
       ]
      }
     ]
    },
    "horsepower": {
     "status": "SINGLE_VALUE",
     "values": [
      {
       "value": "180",
       "sources": [
        "EgyCar"
       ]
      }
     ]
    },
    "drive_type": {
     "status": "SINGLE_VALUE",
     "values": [
      {
       "value": "FWD/AWD",
       "sources": [
        "EgyCar"
       ]
      }
     ]
    },
    "fuel_type_raw": {
     "status": "SINGLE_VALUE",
     "values": [
      {
       "value": "Gas",
       "sources": [
        "ContactCars"
       ]
      }
     ]
    },
    "warranty": {
     "status": "MULTIPLE_VALUES",
     "values": [
      {
       "value": "100,000km/5yr",
       "sources": [
        "Hatla2ee"
       ]
      },
      {
       "value": "5yr/100,000km",
       "sources": [
        "ContactCars",
        "EgyCar"
       ]
      }
     ]
    },
    "length": {
     "status": "SINGLE_VALUE",
     "values": [
      {
       "value": "451.0cm",
       "sources": [
        "EgyCar"
       ]
      }
     ]
    },
    "trunk_capacity": {
     "status": "SINGLE_VALUE",
     "values": [
      {
       "value": "503L",
       "sources": [
        "EgyCar"
       ]
      }
     ]
    },
    "fuel_consumption": null,
    "electric_range": null,
    "battery_capacity": null
   },
   "warranty_years_max": 5,
   "registration": {
    "count": 5212,
    "rank": 2,
    "of": 21,
    "share": 0.1283,
    "yoy": -0.046,
    "first_seen": "2021-02",
    "mix": {
     "ICE": 5212
    },
    "last12": [
     [
      "2025-09",
      655
     ],
     [
      "2025-10",
      377
     ],
     [
      "2025-11",
      500
     ],
     [
      "2025-12",
      558
     ],
     [
      "2026-01",
      475
     ],
     [
      "2026-02",
      443
     ],
     [
      "2026-03",
      282
     ],
     [
      "2026-04",
      433
     ],
     [
      "2026-05",
      428
     ],
     [
      "2026-07",
      577
     ],
     [
      "2026-08",
      484
     ]
    ],
    "window": {
     "start": "2025-09",
     "end": "2026-08",
     "months_present": [
      "2025-09",
      "2025-10",
      "2025-11",
      "2025-12",
      "2026-01",
      "2026-02",
      "2026-03",
      "2026-04",
      "2026-05",
      "2026-07",
      "2026-08"
     ],
     "months_missing": [
      "2026-06"
     ]
    },
    "unit": "first registrations (licences), passenger vehicles; not sales",
    "alias_pending_review": false
   },
   "freshness": {
    "price_snapshots": [
     {
      "id": "S0_2026-09-10",
      "observed_at": "2026-09-10",
      "model_observed": true
     },
     {
      "id": "S1_2026-09-25",
      "observed_at": "2026-09-25",
      "model_observed": true
     }
    ],
    "source_stated_price_dates": [
     "2026-05-06"
    ],
    "spec_snapshot": "2026-09-10",
    "registration_data_through": "2026-08"
   },
   "conflicts": [
    {
     "type": "PRICE_CONFLICT",
     "model_year": 2027,
     "trim_key": "blackdiamond",
     "values": [
      2275000,
      2300000
     ],
     "sources": [
      "contactcars",
      "egycar",
      "hatla2ee"
     ],
     "snapshot": "S1_2026-09-25"
    },
    {
     "type": "PRICE_CONFLICT",
     "model_year": 2027,
     "trim_key": "blaze",
     "values": [
      1925000,
      1950000
     ],
     "sources": [
      "contactcars",
      "egycar",
      "hatla2ee"
     ],
     "snapshot": "S1_2026-09-25"
    },
    {
     "type": "PRICE_CONFLICT",
     "model_year": 2027,
     "trim_key": "night",
     "values": [
      2175000,
      2200000
     ],
     "sources": [
      "contactcars",
      "egycar",
      "hatla2ee"
     ],
     "snapshot": "S1_2026-09-25"
    },
    {
     "type": "PRICE_CONFLICT",
     "model_year": 2027,
     "trim_key": "redline",
     "values": [
      2025000,
      2050000
     ],
     "sources": [
      "contactcars",
      "egycar",
      "hatla2ee"
     ],
     "snapshot": "S1_2026-09-25"
    },
    {
     "type": "PRICE_CONFLICT",
     "model_year": 2027,
     "trim_key": "redlinenpack",
     "values": [
      2100000,
      2125000
     ],
     "sources": [
      "contactcars",
      "hatla2ee"
     ],
     "snapshot": "S1_2026-09-25"
    },
    {
     "type": "PRICE_CONFLICT",
     "model_year": 2027,
     "trim_key": "shadow",
     "values": [
      1775000,
      1800000
     ],
     "sources": [
      "contactcars",
      "egycar",
      "hatla2ee"
     ],
     "snapshot": "S1_2026-09-25"
    }
   ],
   "gaps": [
    "FROM_PRICE_IN_CONFLICT"
   ],
   "review_open": [
    {
     "type": "DUPLICATE_ROWS_IN_SNAPSHOT",
     "status": "OPEN",
     "detail": "2027 redlinenpack contactcars official: S0_2026-09-10 [2125000, 2155000] / S1_2026-09-25 [2125000]"
    },
    {
     "type": "PRICE_CONFLICT",
     "status": "OPEN",
     "detail": "2027 blackdiamond: [2275000, 2300000] from ['contactcars', 'egycar', 'hatla2ee']"
    },
    {
     "type": "PRICE_CONFLICT",
     "status": "OPEN",
     "detail": "2027 blaze: [1925000, 1950000] from ['contactcars', 'egycar', 'hatla2ee']"
    },
    {
     "type": "PRICE_CONFLICT",
     "status": "OPEN",
     "detail": "2027 night: [2175000, 2200000] from ['contactcars', 'egycar', 'hatla2ee']"
    },
    {
     "type": "PRICE_CONFLICT",
     "status": "OPEN",
     "detail": "2027 redline: [2025000, 2050000] from ['contactcars', 'egycar', 'hatla2ee']"
    },
    {
     "type": "PRICE_CONFLICT",
     "status": "OPEN",
     "detail": "2027 redlinenpack: [2100000, 2125000] from ['contactcars', 'hatla2ee']"
    },
    {
     "type": "PRICE_CONFLICT",
     "status": "OPEN",
     "detail": "2027 shadow: [1775000, 1800000] from ['contactcars', 'egycar', 'hatla2ee']"
    }
   ]
  },
  {
   "id": "m_000003",
   "slug": "volkswagen-tiguan",
   "brand": "Volkswagen",
   "model": "Tiguan",
   "id_status": "PROVISIONAL",
   "model_year": 2026,
   "price_from": {
    "status": "RESOLVED",
    "value": 2590000,
    "trim_key": "rline",
    "confidence": "HIGH",
    "model_year": 2026,
    "unresolved_trims_in_cohort": [],
    "basis": "derived: min official price across trims of the latest model-year cohort that has any numeric official price"
   },
   "trims": [
    {
     "key": "rline",
     "label": "R-Line",
     "labels": [
      "A/T / R-Line",
      "R-Line"
     ],
     "status": "AGREED",
     "confidence": "HIGH",
     "value": 2590000,
     "min": 2590000,
     "max": 2590000,
     "sources": [
      "contactcars",
      "hatla2ee"
     ],
     "observed_at": "2026-09-25T10:28:20Z",
     "urls": [
      "https://eg.hatla2ee.com/en/new-car/volks-wagen/tiguan",
      "https://www.contactcars.com/en/new-cars/volkswagen-tiguan/year-2026"
     ],
     "powertrain": "petrol",
     "plugin": false,
     "powertrain_basis": "model",
     "changes": []
    }
   ],
   "unpriced_trims": 0,
   "powertrains": [
    "petrol"
   ],
   "specs": {
    "seats": {
     "status": "SINGLE_VALUE",
     "values": [
      {
       "value": "5",
       "sources": [
        "ContactCars"
       ]
      }
     ]
    },
    "transmission": {
     "status": "MULTIPLE_VALUES",
     "values": [
      {
       "value": "Automatic",
       "sources": [
        "Hatla2ee"
       ]
      },
      {
       "value": "Dual Clutch",
       "sources": [
        "ContactCars"
       ]
      }
     ]
    },
    "engine_capacity": {
     "status": "SINGLE_VALUE",
     "values": [
      {
       "value": "1400",
       "sources": [
        "Hatla2ee"
       ]
      }
     ]
    },
    "horsepower": null,
    "drive_type": null,
    "fuel_type_raw": {
     "status": "SINGLE_VALUE",
     "values": [
      {
       "value": "Gas",
       "sources": [
        "ContactCars",
        "Hatla2ee"
       ]
      }
     ]
    },
    "warranty": {
     "status": "SINGLE_VALUE",
     "values": [
      {
       "value": "100,000 Km / 3 Years",
       "sources": [
        "Hatla2ee"
       ]
      }
     ]
    },
    "length": null,
    "trunk_capacity": null,
    "fuel_consumption": null,
    "electric_range": null,
    "battery_capacity": null
   },
   "warranty_years_max": 3,
   "registration": {
    "count": 4280,
    "rank": 3,
    "of": 21,
    "share": 0.1054,
    "yoy": -0.088,
    "first_seen": "2021-02",
    "mix": {
     "ICE": 4280
    },
    "last12": [
     [
      "2025-09",
      362
     ],
     [
      "2025-10",
      334
     ],
     [
      "2025-11",
      350
     ],
     [
      "2025-12",
      436
     ],
     [
      "2026-01",
      362
     ],
     [
      "2026-02",
      397
     ],
     [
      "2026-03",
      459
     ],
     [
      "2026-04",
      240
     ],
     [
      "2026-05",
      372
     ],
     [
      "2026-07",
      461
     ],
     [
      "2026-08",
      507
     ]
    ],
    "window": {
     "start": "2025-09",
     "end": "2026-08",
     "months_present": [
      "2025-09",
      "2025-10",
      "2025-11",
      "2025-12",
      "2026-01",
      "2026-02",
      "2026-03",
      "2026-04",
      "2026-05",
      "2026-07",
      "2026-08"
     ],
     "months_missing": [
      "2026-06"
     ]
    },
    "unit": "first registrations (licences), passenger vehicles; not sales",
    "alias_pending_review": false
   },
   "freshness": {
    "price_snapshots": [
     {
      "id": "S0_2026-09-10",
      "observed_at": "2026-09-10",
      "model_observed": true
     },
     {
      "id": "S1_2026-09-25",
      "observed_at": "2026-09-25",
      "model_observed": true
     }
    ],
    "source_stated_price_dates": [],
    "spec_snapshot": "2026-09-10",
    "registration_data_through": "2026-08"
   },
   "conflicts": [],
   "gaps": [],
   "review_open": []
  },
  {
   "id": "m_000004",
   "slug": "jetour-t2",
   "brand": "Jetour",
   "model": "T2",
   "id_status": "PROVISIONAL",
   "model_year": 2027,
   "price_from": {
    "status": "RESOLVED",
    "value": 1900000,
    "trim_key": "luxury",
    "confidence": "MEDIUM",
    "model_year": 2027,
    "unresolved_trims_in_cohort": [],
    "basis": "derived: min official price across trims of the latest model-year cohort that has any numeric official price"
   },
   "trims": [
    {
     "key": "luxury",
     "label": "Luxury 1.5 L",
     "labels": [
      "Luxury 1.5 L"
     ],
     "status": "SINGLE_SOURCE",
     "confidence": "MEDIUM",
     "value": 1900000,
     "min": 1900000,
     "max": 1900000,
     "sources": [
      "contactcars"
     ],
     "observed_at": "2026-09-25T10:28:15Z",
     "urls": [
      "https://www.contactcars.com/en/new-cars/jetour-t2/year-2027"
     ],
     "powertrain": null,
     "plugin": false,
     "powertrain_basis": "unstated",
     "changes": []
    },
    {
     "key": "mattcolour",
     "label": "Matt Colour",
     "labels": [
      "Matt Colour"
     ],
     "status": "SINGLE_SOURCE",
     "confidence": "MEDIUM",
     "value": 1930000,
     "min": 1930000,
     "max": 1930000,
     "sources": [
      "contactcars"
     ],
     "observed_at": "2026-09-25T10:28:15Z",
     "urls": [
      "https://www.contactcars.com/en/new-cars/jetour-t2/year-2027"
     ],
     "powertrain": null,
     "plugin": false,
     "powertrain_basis": "unstated",
     "changes": []
    },
    {
     "key": "idm",
     "label": "i-DM",
     "labels": [
      "i-DM"
     ],
     "status": "SINGLE_SOURCE",
     "confidence": "MEDIUM",
     "value": 2150000,
     "min": 2150000,
     "max": 2150000,
     "sources": [
      "contactcars"
     ],
     "observed_at": "2026-09-25T10:28:15Z",
     "urls": [
      "https://www.contactcars.com/en/new-cars/jetour-t2/year-2027"
     ],
     "powertrain": "hybrid",
     "plugin": true,
     "powertrain_basis": "label",
     "changes": []
    }
   ],
   "unpriced_trims": 0,
   "powertrains": [
    "hybrid",
    "petrol"
   ],
   "specs": {
    "seats": null,
    "transmission": {
     "status": "SINGLE_VALUE",
     "values": [
      {
       "value": "Dual Clutch",
       "sources": [
        "ContactCars"
       ]
      }
     ]
    },
    "engine_capacity": null,
    "horsepower": {
     "status": "SINGLE_VALUE",
     "values": [
      {
       "value": "184",
       "sources": [
        "ContactCars"
       ]
      }
     ]
    },
    "drive_type": null,
    "fuel_type_raw": {
     "status": "SINGLE_VALUE",
     "values": [
      {
       "value": "Gas-Hybrid",
       "sources": [
        "ContactCars"
       ]
      }
     ]
    },
    "warranty": null,
    "length": null,
    "trunk_capacity": null,
    "fuel_consumption": null,
    "electric_range": null,
    "battery_capacity": {
     "status": "SINGLE_VALUE",
     "values": [
      {
       "value": "26.7 kWh",
       "sources": [
        "ContactCars"
       ]
      }
     ]
    }
   },
   "warranty_years_max": null,
   "registration": {
    "count": 3720,
    "rank": 4,
    "of": 21,
    "share": 0.0916,
    "yoy": 0.695,
    "first_seen": "2024-10",
    "mix": {
     "ICE": 3470,
     "Hybrid": 250
    },
    "last12": [
     [
      "2025-09",
      220
     ],
     [
      "2025-10",
      365
     ],
     [
      "2025-11",
      297
     ],
     [
      "2025-12",
      391
     ],
     [
      "2026-01",
      288
     ],
     [
      "2026-02",
      293
     ],
     [
      "2026-03",
      454
     ],
     [
      "2026-04",
      324
     ],
     [
      "2026-05",
      326
     ],
     [
      "2026-07",
      370
     ],
     [
      "2026-08",
      392
     ]
    ],
    "window": {
     "start": "2025-09",
     "end": "2026-08",
     "months_present": [
      "2025-09",
      "2025-10",
      "2025-11",
      "2025-12",
      "2026-01",
      "2026-02",
      "2026-03",
      "2026-04",
      "2026-05",
      "2026-07",
      "2026-08"
     ],
     "months_missing": [
      "2026-06"
     ]
    },
    "unit": "first registrations (licences), passenger vehicles; not sales",
    "alias_pending_review": true
   },
   "freshness": {
    "price_snapshots": [
     {
      "id": "S0_2026-09-10",
      "observed_at": "2026-09-10",
      "model_observed": true
     },
     {
      "id": "S1_2026-09-25",
      "observed_at": "2026-09-25",
      "model_observed": true
     }
    ],
    "source_stated_price_dates": [],
    "spec_snapshot": "2026-09-10",
    "registration_data_through": "2026-08"
   },
   "conflicts": [],
   "gaps": [
    "SINGLE_SOURCE_MODEL"
   ],
   "review_open": [
    {
     "type": "REGISTRATION_ALIAS",
     "status": "ACCEPTED_PENDING_REVIEW",
     "detail": "Jetour|T2 DM (powertrain suffix (DM) of same model name)"
    }
   ]
  },
  {
   "id": "m_000015",
   "slug": "mitsubishi-eclipse-cross",
   "brand": "Mitsubishi",
   "model": "Eclipse Cross",
   "id_status": "PROVISIONAL",
   "model_year": 2026,
   "price_from": {
    "status": "RESOLVED",
    "value": 1400000,
    "trim_key": "insportbl",
    "confidence": "MEDIUM",
    "model_year": 2026,
    "unresolved_trims_in_cohort": [],
    "basis": "derived: min official price across trims of the latest model-year cohort that has any numeric official price"
   },
   "trims": [
    {
     "key": "insportbl",
     "label": "Insport BL",
     "labels": [
      "A/T / Insport BL",
      "Insport BL"
     ],
     "status": "SINGLE_SOURCE",
     "confidence": "MEDIUM",
     "value": 1400000,
     "min": 1400000,
     "max": 1400000,
     "sources": [
      "hatla2ee"
     ],
     "observed_at": "2026-09-25T10:28:08Z",
     "urls": [
      "https://eg.hatla2ee.com/en/new-car/mitsubishi/Eclipse-Cross"
     ],
     "powertrain": "petrol",
     "plugin": false,
     "powertrain_basis": "model",
     "changes": []
    },
    {
     "key": "insportplusmlplus",
     "label": "Insport PLUS - ML PLUS",
     "labels": [
      "A/T / Insport PLUS - ML PLUS",
      "Insport PLUS - ML PLUS"
     ],
     "status": "SINGLE_SOURCE",
     "confidence": "MEDIUM",
     "value": 1500000,
     "min": 1500000,
     "max": 1500000,
     "sources": [
      "hatla2ee"
     ],
     "observed_at": "2026-09-25T10:28:08Z",
     "urls": [
      "https://eg.hatla2ee.com/en/new-car/mitsubishi/Eclipse-Cross"
     ],
     "powertrain": "petrol",
     "plugin": false,
     "powertrain_basis": "model",
     "changes": []
    },
    {
     "key": "inspirehl",
     "label": "Inspire - HL",
     "labels": [
      "A/T / Inspire - HL",
      "Inspire - HL"
     ],
     "status": "SINGLE_SOURCE",
     "confidence": "MEDIUM",
     "value": 1550000,
     "min": 1550000,
     "max": 1550000,
     "sources": [
      "hatla2ee"
     ],
     "observed_at": "2026-09-25T10:28:08Z",
     "urls": [
      "https://eg.hatla2ee.com/en/new-car/mitsubishi/Eclipse-Cross"
     ],
     "powertrain": "petrol",
     "plugin": false,
     "powertrain_basis": "model",
     "changes": []
    },
    {
     "key": "instyletl",
     "label": "Instyle TL",
     "labels": [
      "A/T / Instyle TL",
      "Instyle TL"
     ],
     "status": "SINGLE_SOURCE",
     "confidence": "MEDIUM",
     "value": 1610000,
     "min": 1610000,
     "max": 1610000,
     "sources": [
      "hatla2ee"
     ],
     "observed_at": "2026-09-25T10:28:08Z",
     "urls": [
      "https://eg.hatla2ee.com/en/new-car/mitsubishi/Eclipse-Cross"
     ],
     "powertrain": "petrol",
     "plugin": false,
     "powertrain_basis": "model",
     "changes": []
    },
    {
     "key": "infinityplawd",
     "label": "INFINITY - PL AWD",
     "labels": [
      "A/T / INFINITY - PL AWD",
      "INFINITY - PL AWD"
     ],
     "status": "SINGLE_SOURCE",
     "confidence": "MEDIUM",
     "value": 1690000,
     "min": 1690000,
     "max": 1690000,
     "sources": [
      "hatla2ee"
     ],
     "observed_at": "2026-09-25T10:28:08Z",
     "urls": [
      "https://eg.hatla2ee.com/en/new-car/mitsubishi/Eclipse-Cross"
     ],
     "powertrain": "petrol",
     "plugin": false,
     "powertrain_basis": "model",
     "changes": []
    }
   ],
   "unpriced_trims": 0,
   "powertrains": [
    "petrol"
   ],
   "specs": {
    "seats": null,
    "transmission": {
     "status": "SINGLE_VALUE",
     "values": [
      {
       "value": "Automatic",
       "sources": [
        "Hatla2ee"
       ]
      }
     ]
    },
    "engine_capacity": {
     "status": "SINGLE_VALUE",
     "values": [
      {
       "value": "1500",
       "sources": [
        "Hatla2ee"
       ]
      }
     ]
    },
    "horsepower": null,
    "drive_type": {
     "status": "SINGLE_VALUE",
     "values": [
      {
       "value": "AWD",
       "sources": [
        "Hatla2ee"
       ]
      }
     ]
    },
    "fuel_type_raw": null,
    "warranty": {
     "status": "SINGLE_VALUE",
     "values": [
      {
       "value": "1,000,000 Km / 5 Years",
       "sources": [
        "Hatla2ee"
       ]
      }
     ]
    },
    "length": null,
    "trunk_capacity": null,
    "fuel_consumption": null,
    "electric_range": null,
    "battery_capacity": null
   },
   "warranty_years_max": 5,
   "registration": {
    "count": 2269,
    "rank": 5,
    "of": 21,
    "share": 0.0559,
    "yoy": -0.306,
    "first_seen": "2021-02",
    "mix": {
     "ICE": 2269
    },
    "last12": [
     [
      "2025-09",
      175
     ],
     [
      "2025-10",
      126
     ],
     [
      "2025-11",
      155
     ],
     [
      "2025-12",
      256
     ],
     [
      "2026-01",
      199
     ],
     [
      "2026-02",
      203
     ],
     [
      "2026-03",
      239
     ],
     [
      "2026-04",
      314
     ],
     [
      "2026-05",
      173
     ],
     [
      "2026-07",
      234
     ],
     [
      "2026-08",
      195
     ]
    ],
    "window": {
     "start": "2025-09",
     "end": "2026-08",
     "months_present": [
      "2025-09",
      "2025-10",
      "2025-11",
      "2025-12",
      "2026-01",
      "2026-02",
      "2026-03",
      "2026-04",
      "2026-05",
      "2026-07",
      "2026-08"
     ],
     "months_missing": [
      "2026-06"
     ]
    },
    "unit": "first registrations (licences), passenger vehicles; not sales",
    "alias_pending_review": true
   },
   "freshness": {
    "price_snapshots": [
     {
      "id": "S0_2026-09-10",
      "observed_at": "2026-09-10",
      "model_observed": true
     },
     {
      "id": "S1_2026-09-25",
      "observed_at": "2026-09-25",
      "model_observed": true
     }
    ],
    "source_stated_price_dates": [],
    "spec_snapshot": "2026-09-10",
    "registration_data_through": "2026-08"
   },
   "conflicts": [],
   "gaps": [
    "SINGLE_SOURCE_MODEL"
   ],
   "review_open": [
    {
     "type": "REGISTRATION_ALIAS",
     "status": "ACCEPTED_PENDING_REVIEW",
     "detail": "Mitsubishi|Eclipse (prefix; only Mitsubishi model starting 'Eclipse' in any scrape or registration source)"
    }
   ]
  },
  {
   "id": "m_000005",
   "slug": "peugeot-3008",
   "brand": "Peugeot",
   "model": "3008",
   "id_status": "PROVISIONAL",
   "model_year": 2027,
   "price_from": {
    "status": "RESOLVED",
    "value": 2099990,
    "trim_key": "allure",
    "confidence": "MEDIUM",
    "model_year": 2027,
    "unresolved_trims_in_cohort": [],
    "basis": "derived: min official price across trims of the latest model-year cohort that has any numeric official price"
   },
   "trims": [
    {
     "key": "allure",
     "label": "Allure",
     "labels": [
      "A/T / Allure",
      "Allure"
     ],
     "status": "SINGLE_SOURCE",
     "confidence": "MEDIUM",
     "value": 2099990,
     "min": 2099990,
     "max": 2099990,
     "sources": [
      "hatla2ee"
     ],
     "observed_at": "2026-09-25T10:28:08Z",
     "urls": [
      "https://eg.hatla2ee.com/en/new-car/peugeot/3008"
     ],
     "powertrain": "petrol",
     "plugin": false,
     "powertrain_basis": "model",
     "changes": []
    },
    {
     "key": "gt",
     "label": "GT",
     "labels": [
      "A/T / GT",
      "GT"
     ],
     "status": "SINGLE_SOURCE",
     "confidence": "MEDIUM",
     "value": 2399990,
     "min": 2399990,
     "max": 2399990,
     "sources": [
      "hatla2ee"
     ],
     "observed_at": "2026-09-25T10:28:08Z",
     "urls": [
      "https://eg.hatla2ee.com/en/new-car/peugeot/3008"
     ],
     "powertrain": "petrol",
     "plugin": false,
     "powertrain_basis": "model",
     "changes": []
    }
   ],
   "unpriced_trims": 0,
   "powertrains": [
    "petrol"
   ],
   "specs": {
    "seats": null,
    "transmission": {
     "status": "SINGLE_VALUE",
     "values": [
      {
       "value": "Automatic",
       "sources": [
        "Hatla2ee"
       ]
      }
     ]
    },
    "engine_capacity": {
     "status": "SINGLE_VALUE",
     "values": [
      {
       "value": "1600",
       "sources": [
        "Hatla2ee"
       ]
      }
     ]
    },
    "horsepower": null,
    "drive_type": null,
    "fuel_type_raw": null,
    "warranty": {
     "status": "SINGLE_VALUE",
     "values": [
      {
       "value": "150,000 Km / 5 Years",
       "sources": [
        "Hatla2ee"
       ]
      }
     ]
    },
    "length": null,
    "trunk_capacity": null,
    "fuel_consumption": null,
    "electric_range": null,
    "battery_capacity": null
   },
   "warranty_years_max": 5,
   "registration": {
    "count": 1927,
    "rank": 6,
    "of": 21,
    "share": 0.0474,
    "yoy": -0.453,
    "first_seen": "2021-02",
    "mix": {
     "ICE": 1927
    },
    "last12": [
     [
      "2025-09",
      150
     ],
     [
      "2025-10",
      154
     ],
     [
      "2025-11",
      138
     ],
     [
      "2025-12",
      174
     ],
     [
      "2026-01",
      208
     ],
     [
      "2026-02",
      236
     ],
     [
      "2026-03",
      334
     ],
     [
      "2026-04",
      135
     ],
     [
      "2026-05",
      108
     ],
     [
      "2026-07",
      163
     ],
     [
      "2026-08",
      127
     ]
    ],
    "window": {
     "start": "2025-09",
     "end": "2026-08",
     "months_present": [
      "2025-09",
      "2025-10",
      "2025-11",
      "2025-12",
      "2026-01",
      "2026-02",
      "2026-03",
      "2026-04",
      "2026-05",
      "2026-07",
      "2026-08"
     ],
     "months_missing": [
      "2026-06"
     ]
    },
    "unit": "first registrations (licences), passenger vehicles; not sales",
    "alias_pending_review": false
   },
   "freshness": {
    "price_snapshots": [
     {
      "id": "S0_2026-09-10",
      "observed_at": "2026-09-10",
      "model_observed": true
     },
     {
      "id": "S1_2026-09-25",
      "observed_at": "2026-09-25",
      "model_observed": true
     }
    ],
    "source_stated_price_dates": [],
    "spec_snapshot": "2026-09-10",
    "registration_data_through": "2026-08"
   },
   "conflicts": [],
   "gaps": [
    "SINGLE_SOURCE_MODEL"
   ],
   "review_open": []
  },
  {
   "id": "m_000019",
   "slug": "soueast-s06",
   "brand": "Soueast",
   "model": "S06",
   "id_status": "PROVISIONAL",
   "model_year": 2027,
   "price_from": {
    "status": "RESOLVED",
    "value": 1350000,
    "trim_key": "highline",
    "confidence": "HIGH",
    "model_year": 2027,
    "unresolved_trims_in_cohort": [],
    "basis": "derived: min official price across trims of the latest model-year cohort that has any numeric official price"
   },
   "trims": [
    {
     "key": "highline",
     "label": "Highline",
     "labels": [
      "A/T / Highline",
      "Highline"
     ],
     "status": "AGREED",
     "confidence": "HIGH",
     "value": 1350000,
     "min": 1350000,
     "max": 1350000,
     "sources": [
      "contactcars",
      "hatla2ee"
     ],
     "observed_at": "2026-09-25T10:28:19Z",
     "urls": [
      "https://eg.hatla2ee.com/en/new-car/soueast/S+06",
      "https://www.contactcars.com/en/new-cars/soueast-s_06/year-2027"
     ],
     "powertrain": null,
     "plugin": false,
     "powertrain_basis": "unstated",
     "changes": []
    },
    {
     "key": "premium",
     "label": "Premium",
     "labels": [
      "A/T / Premium",
      "Premium"
     ],
     "status": "AGREED",
     "confidence": "HIGH",
     "value": 1485000,
     "min": 1485000,
     "max": 1485000,
     "sources": [
      "contactcars",
      "hatla2ee"
     ],
     "observed_at": "2026-09-25T10:28:19Z",
     "urls": [
      "https://eg.hatla2ee.com/en/new-car/soueast/S+06",
      "https://www.contactcars.com/en/new-cars/soueast-s_06/year-2027"
     ],
     "powertrain": null,
     "plugin": false,
     "powertrain_basis": "unstated",
     "changes": []
    },
    {
     "key": "intelligentdmi",
     "label": "Intellingent (DM-i )",
     "labels": [
      "A/T / Intelligent (DM-i)",
      "A/T / Intellingent (DM-i )"
     ],
     "status": "SINGLE_SOURCE",
     "confidence": "MEDIUM",
     "value": 1649000,
     "min": 1649000,
     "max": 1649000,
     "sources": [
      "hatla2ee"
     ],
     "observed_at": "2026-09-25T10:28:10Z",
     "urls": [
      "https://eg.hatla2ee.com/en/new-car/soueast/S+06"
     ],
     "powertrain": "hybrid",
     "plugin": true,
     "powertrain_basis": "label",
     "changes": []
    },
    {
     "key": "dm",
     "label": "DM",
     "labels": [
      "DM"
     ],
     "status": "SINGLE_SOURCE",
     "confidence": "MEDIUM",
     "value": 1650000,
     "min": 1650000,
     "max": 1650000,
     "sources": [
      "contactcars"
     ],
     "observed_at": "2026-09-25T10:28:19Z",
     "urls": [
      "https://www.contactcars.com/en/new-cars/soueast-s_06/year-2027"
     ],
     "powertrain": "hybrid",
     "plugin": true,
     "powertrain_basis": "label",
     "changes": []
    }
   ],
   "unpriced_trims": 0,
   "powertrains": [
    "hybrid",
    "petrol"
   ],
   "specs": {
    "seats": null,
    "transmission": {
     "status": "MULTIPLE_VALUES",
     "values": [
      {
       "value": "Automatic",
       "sources": [
        "Hatla2ee"
       ]
      },
      {
       "value": "Dual Clutch",
       "sources": [
        "ContactCars"
       ]
      }
     ]
    },
    "engine_capacity": {
     "status": "MULTIPLE_VALUES",
     "values": [
      {
       "value": "1500",
       "sources": [
        "Hatla2ee"
       ]
      },
      {
       "value": "1600",
       "sources": [
        "Hatla2ee"
       ]
      }
     ]
    },
    "horsepower": null,
    "drive_type": null,
    "fuel_type_raw": {
     "status": "MULTIPLE_VALUES",
     "values": [
      {
       "value": "Gas",
       "sources": [
        "Hatla2ee"
       ]
      },
      {
       "value": "Gas-Hybrid",
       "sources": [
        "ContactCars"
       ]
      },
      {
       "value": "Plug-in Hybrid",
       "sources": [
        "Hatla2ee"
       ]
      }
     ]
    },
    "warranty": {
     "status": "SINGLE_VALUE",
     "values": [
      {
       "value": "150,000 Km / 6 Years",
       "sources": [
        "Hatla2ee"
       ]
      }
     ]
    },
    "length": null,
    "trunk_capacity": null,
    "fuel_consumption": null,
    "electric_range": null,
    "battery_capacity": null
   },
   "warranty_years_max": 6,
   "registration": {
    "count": 1755,
    "rank": 7,
    "of": 21,
    "share": 0.0432,
    "yoy": null,
    "first_seen": "2025-07",
    "mix": {
     "ICE": 1741,
     "Hybrid": 14
    },
    "last12": [
     [
      "2025-09",
      155
     ],
     [
      "2025-10",
      127
     ],
     [
      "2025-11",
      237
     ],
     [
      "2025-12",
      154
     ],
     [
      "2026-01",
      111
     ],
     [
      "2026-02",
      133
     ],
     [
      "2026-03",
      243
     ],
     [
      "2026-04",
      157
     ],
     [
      "2026-05",
      165
     ],
     [
      "2026-07",
      159
     ],
     [
      "2026-08",
      114
     ]
    ],
    "window": {
     "start": "2025-09",
     "end": "2026-08",
     "months_present": [
      "2025-09",
      "2025-10",
      "2025-11",
      "2025-12",
      "2026-01",
      "2026-02",
      "2026-03",
      "2026-04",
      "2026-05",
      "2026-07",
      "2026-08"
     ],
     "months_missing": [
      "2026-06"
     ]
    },
    "unit": "first registrations (licences), passenger vehicles; not sales",
    "alias_pending_review": true
   },
   "freshness": {
    "price_snapshots": [
     {
      "id": "S0_2026-09-10",
      "observed_at": "2026-09-10",
      "model_observed": true
     },
     {
      "id": "S1_2026-09-25",
      "observed_at": "2026-09-25",
      "model_observed": true
     }
    ],
    "source_stated_price_dates": [],
    "spec_snapshot": "2026-09-10",
    "registration_data_through": "2026-08"
   },
   "conflicts": [],
   "gaps": [],
   "review_open": [
    {
     "type": "REGISTRATION_ALIAS",
     "status": "ACCEPTED_PENDING_REVIEW",
     "detail": "Soueast|S06DM (powertrain suffix (DM) of same model name)"
    }
   ]
  },
  {
   "id": "m_000006",
   "slug": "nissan-qashqai",
   "brand": "Nissan",
   "model": "Qashqai",
   "id_status": "PROVISIONAL",
   "model_year": 2027,
   "price_from": {
    "status": "RESOLVED",
    "value": 1555000,
    "trim_key": "nconnecta",
    "confidence": "HIGH",
    "model_year": 2027,
    "unresolved_trims_in_cohort": [],
    "basis": "derived: min official price across trims of the latest model-year cohort that has any numeric official price"
   },
   "trims": [
    {
     "key": "nconnecta",
     "label": "N-Connecta",
     "labels": [
      "N-Connecta",
      "N-connecta"
     ],
     "status": "AGREED",
     "confidence": "HIGH",
     "value": 1555000,
     "min": 1555000,
     "max": 1555000,
     "sources": [
      "contactcars",
      "egycar"
     ],
     "observed_at": "2026-09-25T10:28:23Z",
     "urls": [
      "https://www.contactcars.com/en/new-cars/nissan-qashqai/year-2027",
      "https://www.egy-car.com/nissan-qashqai"
     ],
     "powertrain": null,
     "plugin": false,
     "powertrain_basis": "unstated",
     "changes": []
    },
    {
     "key": "nconnectaplus",
     "label": "N-connecta Plus",
     "labels": [
      "N-Connecta +",
      "N-Connecta+",
      "N-connecta Plus"
     ],
     "status": "AGREED",
     "confidence": "HIGH",
     "value": 1757000,
     "min": 1757000,
     "max": 1757000,
     "sources": [
      "contactcars",
      "egycar"
     ],
     "observed_at": "2026-09-25T10:28:23Z",
     "urls": [
      "https://www.contactcars.com/en/new-cars/nissan-qashqai/year-2027",
      "https://www.egy-car.com/nissan-qashqai"
     ],
     "powertrain": null,
     "plugin": false,
     "powertrain_basis": "unstated",
     "changes": []
    },
    {
     "key": "nconnectaplus2t",
     "label": "N-connecta+ 2T",
     "labels": [
      "N-connecta+ 2T"
     ],
     "status": "SINGLE_SOURCE",
     "confidence": "MEDIUM",
     "value": 1777000,
     "min": 1777000,
     "max": 1777000,
     "sources": [
      "contactcars"
     ],
     "observed_at": "2026-09-25T10:28:17Z",
     "urls": [
      "https://www.contactcars.com/en/new-cars/nissan-qashqai/year-2027"
     ],
     "powertrain": null,
     "plugin": false,
     "powertrain_basis": "unstated",
     "changes": []
    },
    {
     "key": "tekna",
     "label": "TEKNA",
     "labels": [
      "TEKNA"
     ],
     "status": "SINGLE_SOURCE",
     "confidence": "MEDIUM",
     "value": 1868000,
     "min": 1868000,
     "max": 1868000,
     "sources": [
      "egycar"
     ],
     "observed_at": "2026-09-10",
     "urls": [
      "https://www.egy-car.com/nissan-qashqai"
     ],
     "powertrain": null,
     "plugin": false,
     "powertrain_basis": "unstated",
     "changes": []
    },
    {
     "key": "tekna2t",
     "label": "Tekna 2T",
     "labels": [
      "Tekna 2T"
     ],
     "status": "SINGLE_SOURCE",
     "confidence": "MEDIUM",
     "value": 1888000,
     "min": 1888000,
     "max": 1888000,
     "sources": [
      "contactcars"
     ],
     "observed_at": "2026-09-25T10:28:17Z",
     "urls": [
      "https://www.contactcars.com/en/new-cars/nissan-qashqai/year-2027"
     ],
     "powertrain": null,
     "plugin": false,
     "powertrain_basis": "unstated",
     "changes": []
    },
    {
     "key": "ndesignepwr",
     "label": "N-Design e-PWR",
     "labels": [
      "N-Design e-PWR"
     ],
     "status": "SINGLE_SOURCE",
     "confidence": "MEDIUM",
     "value": 1999000,
     "min": 1999000,
     "max": 1999000,
     "sources": [
      "contactcars"
     ],
     "observed_at": "2026-09-25T10:28:17Z",
     "urls": [
      "https://www.contactcars.com/en/new-cars/nissan-qashqai/year-2027"
     ],
     "powertrain": "hybrid",
     "plugin": false,
     "powertrain_basis": "label",
     "changes": []
    },
    {
     "key": "epower",
     "label": "e-Power",
     "labels": [
      "e-Power"
     ],
     "status": "SINGLE_SOURCE",
     "confidence": "MEDIUM",
     "value": 2000000,
     "min": 2000000,
     "max": 2000000,
     "sources": [
      "egycar"
     ],
     "observed_at": "2026-09-10",
     "urls": [
      "https://www.egy-car.com/nissan-qashqai"
     ],
     "powertrain": "hybrid",
     "plugin": false,
     "powertrain_basis": "label",
     "changes": []
    },
    {
     "key": "teknaplus4wd",
     "label": "Tekna Plus 4WD",
     "labels": [
      "TEKNA+ 4WD",
      "Tekna Plus 4WD"
     ],
     "status": "SINGLE_SOURCE",
     "confidence": "MEDIUM",
     "value": 2068000,
     "min": 2068000,
     "max": 2068000,
     "sources": [
      "contactcars"
     ],
     "observed_at": "2026-09-25T10:28:17Z",
     "urls": [
      "https://www.contactcars.com/en/new-cars/nissan-qashqai/year-2027"
     ],
     "powertrain": null,
     "plugin": false,
     "powertrain_basis": "unstated",
     "changes": []
    }
   ],
   "unpriced_trims": 0,
   "powertrains": [
    "hybrid",
    "petrol"
   ],
   "specs": {
    "seats": null,
    "transmission": {
     "status": "SINGLE_VALUE",
     "values": [
      {
       "value": "CVT",
       "sources": [
        "ContactCars",
        "EgyCar"
       ]
      }
     ]
    },
    "engine_capacity": {
     "status": "SINGLE_VALUE",
     "values": [
      {
       "value": "1300cc turbo",
       "sources": [
        "EgyCar"
       ]
      }
     ]
    },
    "horsepower": {
     "status": "MULTIPLE_VALUES",
     "values": [
      {
       "value": "148",
       "sources": [
        "EgyCar"
       ]
      },
      {
       "value": "148/5000",
       "sources": [
        "ContactCars"
       ]
      }
     ]
    },
    "drive_type": {
     "status": "MULTIPLE_VALUES",
     "values": [
      {
       "value": "4WD",
       "sources": [
        "ContactCars",
        "EgyCar"
       ]
      },
      {
       "value": "FWD",
       "sources": [
        "ContactCars"
       ]
      }
     ]
    },
    "fuel_type_raw": {
     "status": "MULTIPLE_VALUES",
     "values": [
      {
       "value": "Gas",
       "sources": [
        "ContactCars"
       ]
      },
      {
       "value": "Hybrid (e-Power)",
       "sources": [
        "ContactCars",
        "EgyCar"
       ]
      }
     ]
    },
    "warranty": {
     "status": "SINGLE_VALUE",
     "values": [
      {
       "value": "5yr/100,000km",
       "sources": [
        "EgyCar"
       ]
      }
     ]
    },
    "length": {
     "status": "SINGLE_VALUE",
     "values": [
      {
       "value": "442.5cm",
       "sources": [
        "EgyCar"
       ]
      }
     ]
    },
    "trunk_capacity": {
     "status": "SINGLE_VALUE",
     "values": [
      {
       "value": "504/404L",
       "sources": [
        "EgyCar"
       ]
      }
     ]
    },
    "fuel_consumption": {
     "status": "SINGLE_VALUE",
     "values": [
      {
       "value": "6.1L/100km",
       "sources": [
        "EgyCar"
       ]
      }
     ]
    },
    "electric_range": null,
    "battery_capacity": null
   },
   "warranty_years_max": 5,
   "registration": {
    "count": 1694,
    "rank": 8,
    "of": 21,
    "share": 0.0417,
    "yoy": -0.37,
    "first_seen": "2021-02",
    "mix": {
     "ICE": 1694
    },
    "last12": [
     [
      "2025-09",
      158
     ],
     [
      "2025-10",
      132
     ],
     [
      "2025-11",
      61
     ],
     [
      "2025-12",
      121
     ],
     [
      "2026-01",
      78
     ],
     [
      "2026-02",
      182
     ],
     [
      "2026-03",
      158
     ],
     [
      "2026-04",
      244
     ],
     [
      "2026-05",
      154
     ],
     [
      "2026-07",
      124
     ],
     [
      "2026-08",
      282
     ]
    ],
    "window": {
     "start": "2025-09",
     "end": "2026-08",
     "months_present": [
      "2025-09",
      "2025-10",
      "2025-11",
      "2025-12",
      "2026-01",
      "2026-02",
      "2026-03",
      "2026-04",
      "2026-05",
      "2026-07",
      "2026-08"
     ],
     "months_missing": [
      "2026-06"
     ]
    },
    "unit": "first registrations (licences), passenger vehicles; not sales",
    "alias_pending_review": false
   },
   "freshness": {
    "price_snapshots": [
     {
      "id": "S0_2026-09-10",
      "observed_at": "2026-09-10",
      "model_observed": true
     },
     {
      "id": "S1_2026-09-25",
      "observed_at": "2026-09-25",
      "model_observed": true
     }
    ],
    "source_stated_price_dates": [
     "2026-07-15"
    ],
    "spec_snapshot": "2026-09-10",
    "registration_data_through": "2026-08"
   },
   "conflicts": [],
   "gaps": [],
   "review_open": []
  },
  {
   "id": "m_000007",
   "slug": "opel-grandland",
   "brand": "Opel",
   "model": "Grandland",
   "id_status": "PROVISIONAL",
   "model_year": 2026,
   "price_from": {
    "status": "RESOLVED_RANGE",
    "value": null,
    "value_min": 1849990,
    "value_max": 1850000,
    "trim_key": "highlineplus",
    "confidence": "MEDIUM",
    "model_year": 2026,
    "unresolved_trims_in_cohort": [],
    "basis": "derived: min official price across trims of the latest model-year cohort that has any numeric official price"
   },
   "trims": [
    {
     "key": "highlineplus",
     "label": "Highline Plus",
     "labels": [
      "A/T / Highline+",
      "Highline Plus"
     ],
     "status": "NEAR_AGREEMENT",
     "confidence": "MEDIUM",
     "value": null,
     "min": 1849990,
     "max": 1850000,
     "sources": [
      "contactcars",
      "hatla2ee"
     ],
     "observed_at": "2026-09-25T10:28:18Z",
     "urls": [
      "https://eg.hatla2ee.com/en/new-car/opel/Grandland",
      "https://www.contactcars.com/en/new-cars/opel-grand_land/year-2026"
     ],
     "powertrain": "petrol",
     "plugin": false,
     "powertrain_basis": "model",
     "changes": []
    },
    {
     "key": "topline",
     "label": "Top Line",
     "labels": [
      "A/T / Top Line",
      "Topline"
     ],
     "status": "NEAR_AGREEMENT",
     "confidence": "MEDIUM",
     "value": null,
     "min": 1949990,
     "max": 1950000,
     "sources": [
      "contactcars",
      "hatla2ee"
     ],
     "observed_at": "2026-09-25T10:28:18Z",
     "urls": [
      "https://eg.hatla2ee.com/en/new-car/opel/Grandland",
      "https://www.contactcars.com/en/new-cars/opel-grand_land/year-2026"
     ],
     "powertrain": "petrol",
     "plugin": false,
     "powertrain_basis": "model",
     "changes": []
    },
    {
     "key": "toplineplus",
     "label": "Topline Plus",
     "labels": [
      "A/T / Top Line+",
      "Topline Plus"
     ],
     "status": "NEAR_AGREEMENT",
     "confidence": "MEDIUM",
     "value": null,
     "min": 2099990,
     "max": 2100000,
     "sources": [
      "contactcars",
      "hatla2ee"
     ],
     "observed_at": "2026-09-25T10:28:18Z",
     "urls": [
      "https://eg.hatla2ee.com/en/new-car/opel/Grandland",
      "https://www.contactcars.com/en/new-cars/opel-grand_land/year-2026"
     ],
     "powertrain": "petrol",
     "plugin": false,
     "powertrain_basis": "model",
     "changes": []
    }
   ],
   "unpriced_trims": 0,
   "powertrains": [
    "petrol"
   ],
   "specs": {
    "seats": null,
    "transmission": {
     "status": "SINGLE_VALUE",
     "values": [
      {
       "value": "Automatic",
       "sources": [
        "ContactCars",
        "Hatla2ee"
       ]
      }
     ]
    },
    "engine_capacity": {
     "status": "SINGLE_VALUE",
     "values": [
      {
       "value": "1600",
       "sources": [
        "ContactCars",
        "Hatla2ee"
       ]
      }
     ]
    },
    "horsepower": null,
    "drive_type": null,
    "fuel_type_raw": {
     "status": "SINGLE_VALUE",
     "values": [
      {
       "value": "Gas",
       "sources": [
        "Hatla2ee"
       ]
      }
     ]
    },
    "warranty": {
     "status": "SINGLE_VALUE",
     "values": [
      {
       "value": "150,000 Km / 5 Years",
       "sources": [
        "Hatla2ee"
       ]
      }
     ]
    },
    "length": null,
    "trunk_capacity": null,
    "fuel_consumption": null,
    "electric_range": null,
    "battery_capacity": null
   },
   "warranty_years_max": 5,
   "registration": {
    "count": 1688,
    "rank": 9,
    "of": 21,
    "share": 0.0416,
    "yoy": -0.009,
    "first_seen": "2021-02",
    "mix": {
     "ICE": 1688
    },
    "last12": [
     [
      "2025-09",
      116
     ],
     [
      "2025-10",
      185
     ],
     [
      "2025-11",
      109
     ],
     [
      "2025-12",
      118
     ],
     [
      "2026-01",
      65
     ],
     [
      "2026-02",
      90
     ],
     [
      "2026-03",
      213
     ],
     [
      "2026-04",
      133
     ],
     [
      "2026-05",
      140
     ],
     [
      "2026-07",
      259
     ],
     [
      "2026-08",
      260
     ]
    ],
    "window": {
     "start": "2025-09",
     "end": "2026-08",
     "months_present": [
      "2025-09",
      "2025-10",
      "2025-11",
      "2025-12",
      "2026-01",
      "2026-02",
      "2026-03",
      "2026-04",
      "2026-05",
      "2026-07",
      "2026-08"
     ],
     "months_missing": [
      "2026-06"
     ]
    },
    "unit": "first registrations (licences), passenger vehicles; not sales",
    "alias_pending_review": false
   },
   "freshness": {
    "price_snapshots": [
     {
      "id": "S0_2026-09-10",
      "observed_at": "2026-09-10",
      "model_observed": true
     },
     {
      "id": "S1_2026-09-25",
      "observed_at": "2026-09-25",
      "model_observed": true
     }
    ],
    "source_stated_price_dates": [],
    "spec_snapshot": "2026-09-10",
    "registration_data_through": "2026-08"
   },
   "conflicts": [],
   "gaps": [],
   "review_open": []
  },
  {
   "id": "m_000009",
   "slug": "jetour-t1",
   "brand": "Jetour",
   "model": "T1",
   "id_status": "PROVISIONAL",
   "model_year": 2027,
   "price_from": {
    "status": "RESOLVED",
    "value": 1730000,
    "trim_key": "luxury",
    "confidence": "MEDIUM",
    "model_year": 2027,
    "unresolved_trims_in_cohort": [],
    "basis": "derived: min official price across trims of the latest model-year cohort that has any numeric official price"
   },
   "trims": [
    {
     "key": "luxury",
     "label": "Luxury",
     "labels": [
      "Luxury"
     ],
     "status": "SINGLE_SOURCE",
     "confidence": "MEDIUM",
     "value": 1730000,
     "min": 1730000,
     "max": 1730000,
     "sources": [
      "contactcars"
     ],
     "observed_at": "2026-09-25T10:28:14Z",
     "urls": [
      "https://www.contactcars.com/en/new-cars/jetour-t1/year-2027"
     ],
     "powertrain": "petrol",
     "plugin": false,
     "powertrain_basis": "model",
     "changes": []
    },
    {
     "key": "mattcolour",
     "label": "Matt Colour",
     "labels": [
      "Matt Colour"
     ],
     "status": "SINGLE_SOURCE",
     "confidence": "MEDIUM",
     "value": 1760000,
     "min": 1760000,
     "max": 1760000,
     "sources": [
      "contactcars"
     ],
     "observed_at": "2026-09-25T10:28:14Z",
     "urls": [
      "https://www.contactcars.com/en/new-cars/jetour-t1/year-2027"
     ],
     "powertrain": "petrol",
     "plugin": false,
     "powertrain_basis": "model",
     "changes": []
    }
   ],
   "unpriced_trims": 0,
   "powertrains": [
    "petrol"
   ],
   "specs": {
    "seats": null,
    "transmission": {
     "status": "SINGLE_VALUE",
     "values": [
      {
       "value": "Dual Clutch",
       "sources": [
        "ContactCars"
       ]
      }
     ]
    },
    "engine_capacity": null,
    "horsepower": null,
    "drive_type": null,
    "fuel_type_raw": {
     "status": "SINGLE_VALUE",
     "values": [
      {
       "value": "Gas",
       "sources": [
        "ContactCars"
       ]
      }
     ]
    },
    "warranty": null,
    "length": null,
    "trunk_capacity": null,
    "fuel_consumption": null,
    "electric_range": null,
    "battery_capacity": null
   },
   "warranty_years_max": null,
   "registration": {
    "count": 1553,
    "rank": 10,
    "of": 21,
    "share": 0.0382,
    "yoy": 1.072,
    "first_seen": "2025-05",
    "mix": {
     "ICE": 1553
    },
    "last12": [
     [
      "2025-09",
      70
     ],
     [
      "2025-10",
      164
     ],
     [
      "2025-11",
      134
     ],
     [
      "2025-12",
      160
     ],
     [
      "2026-01",
      147
     ],
     [
      "2026-02",
      142
     ],
     [
      "2026-03",
      137
     ],
     [
      "2026-04",
      108
     ],
     [
      "2026-05",
      136
     ],
     [
      "2026-07",
      175
     ],
     [
      "2026-08",
      180
     ]
    ],
    "window": {
     "start": "2025-09",
     "end": "2026-08",
     "months_present": [
      "2025-09",
      "2025-10",
      "2025-11",
      "2025-12",
      "2026-01",
      "2026-02",
      "2026-03",
      "2026-04",
      "2026-05",
      "2026-07",
      "2026-08"
     ],
     "months_missing": [
      "2026-06"
     ]
    },
    "unit": "first registrations (licences), passenger vehicles; not sales",
    "alias_pending_review": false
   },
   "freshness": {
    "price_snapshots": [
     {
      "id": "S0_2026-09-10",
      "observed_at": "2026-09-10",
      "model_observed": true
     },
     {
      "id": "S1_2026-09-25",
      "observed_at": "2026-09-25",
      "model_observed": true
     }
    ],
    "source_stated_price_dates": [],
    "spec_snapshot": "2026-09-10",
    "registration_data_through": "2026-08"
   },
   "conflicts": [],
   "gaps": [
    "SINGLE_SOURCE_MODEL"
   ],
   "review_open": []
  },
  {
   "id": "m_000023",
   "slug": "baic-bj30",
   "brand": "BAIC",
   "model": "BJ30",
   "id_status": "PROVISIONAL",
   "model_year": 2026,
   "price_from": {
    "status": "RESOLVED",
    "value": 1575000,
    "trim_key": "pro",
    "confidence": "MEDIUM",
    "model_year": 2026,
    "unresolved_trims_in_cohort": [],
    "basis": "derived: min official price across trims of the latest model-year cohort that has any numeric official price"
   },
   "trims": [
    {
     "key": "pro",
     "label": "Pro",
     "labels": [
      "Pro"
     ],
     "status": "SINGLE_SOURCE",
     "confidence": "MEDIUM",
     "value": 1575000,
     "min": 1575000,
     "max": 1575000,
     "sources": [
      "contactcars"
     ],
     "observed_at": "2026-09-25T10:28:11Z",
     "urls": [
      "https://www.contactcars.com/en/new-cars/baic-bj30/year-2026"
     ],
     "powertrain": null,
     "plugin": false,
     "powertrain_basis": "unstated",
     "changes": []
    },
    {
     "key": "ultrahybrid",
     "label": "Ultra - Hybrid",
     "labels": [
      "Ultra - Hybrid"
     ],
     "status": "SINGLE_SOURCE",
     "confidence": "MEDIUM",
     "value": 1675000,
     "min": 1675000,
     "max": 1675000,
     "sources": [
      "contactcars"
     ],
     "observed_at": "2026-09-25T10:28:11Z",
     "urls": [
      "https://www.contactcars.com/en/new-cars/baic-bj30/year-2026"
     ],
     "powertrain": "hybrid",
     "plugin": false,
     "powertrain_basis": "label",
     "changes": []
    },
    {
     "key": "offroadhybrid",
     "label": "Off road - Hybrid",
     "labels": [
      "Off road - Hybrid"
     ],
     "status": "SINGLE_SOURCE",
     "confidence": "MEDIUM",
     "value": 1775000,
     "min": 1775000,
     "max": 1775000,
     "sources": [
      "contactcars"
     ],
     "observed_at": "2026-09-25T10:28:11Z",
     "urls": [
      "https://www.contactcars.com/en/new-cars/baic-bj30/year-2026"
     ],
     "powertrain": "hybrid",
     "plugin": false,
     "powertrain_basis": "label",
     "changes": []
    }
   ],
   "unpriced_trims": 0,
   "powertrains": [
    "hybrid",
    "petrol"
   ],
   "specs": {
    "seats": null,
    "transmission": {
     "status": "SINGLE_VALUE",
     "values": [
      {
       "value": "Automatic - Dual Clutch",
       "sources": [
        "ContactCars"
       ]
      }
     ]
    },
    "engine_capacity": null,
    "horsepower": {
     "status": "SINGLE_VALUE",
     "values": [
      {
       "value": "185",
       "sources": [
        "ContactCars"
       ]
      }
     ]
    },
    "drive_type": {
     "status": "SINGLE_VALUE",
     "values": [
      {
       "value": "FWD",
       "sources": [
        "ContactCars"
       ]
      }
     ]
    },
    "fuel_type_raw": {
     "status": "MULTIPLE_VALUES",
     "values": [
      {
       "value": "Gas",
       "sources": [
        "ContactCars"
       ]
      },
      {
       "value": "Gas - Hybrid",
       "sources": [
        "ContactCars"
       ]
      }
     ]
    },
    "warranty": null,
    "length": null,
    "trunk_capacity": null,
    "fuel_consumption": null,
    "electric_range": null,
    "battery_capacity": {
     "status": "SINGLE_VALUE",
     "values": [
      {
       "value": "1.67 kWh Li-NMC",
       "sources": [
        "ContactCars"
       ]
      }
     ]
    }
   },
   "warranty_years_max": null,
   "registration": {
    "count": 1528,
    "rank": 11,
    "of": 21,
    "share": 0.0376,
    "yoy": 0.09,
    "first_seen": "2024-11",
    "mix": {
     "Hybrid": 1483,
     "ICE": 45
    },
    "last12": [
     [
      "2025-09",
      92
     ],
     [
      "2025-10",
      175
     ],
     [
      "2025-11",
      107
     ],
     [
      "2025-12",
      117
     ],
     [
      "2026-01",
      79
     ],
     [
      "2026-02",
      65
     ],
     [
      "2026-03",
      328
     ],
     [
      "2026-04",
      360
     ],
     [
      "2026-05",
      144
     ],
     [
      "2026-07",
      44
     ],
     [
      "2026-08",
      17
     ]
    ],
    "window": {
     "start": "2025-09",
     "end": "2026-08",
     "months_present": [
      "2025-09",
      "2025-10",
      "2025-11",
      "2025-12",
      "2026-01",
      "2026-02",
      "2026-03",
      "2026-04",
      "2026-05",
      "2026-07",
      "2026-08"
     ],
     "months_missing": [
      "2026-06"
     ]
    },
    "unit": "first registrations (licences), passenger vehicles; not sales",
    "alias_pending_review": true
   },
   "freshness": {
    "price_snapshots": [
     {
      "id": "S0_2026-09-10",
      "observed_at": "2026-09-10",
      "model_observed": true
     },
     {
      "id": "S1_2026-09-25",
      "observed_at": "2026-09-25",
      "model_observed": true
     }
    ],
    "source_stated_price_dates": [],
    "spec_snapshot": "2026-09-10",
    "registration_data_through": "2026-08"
   },
   "conflicts": [],
   "gaps": [
    "SINGLE_SOURCE_MODEL"
   ],
   "review_open": [
    {
     "type": "REGISTRATION_ALIAS",
     "status": "ACCEPTED_PENDING_REVIEW",
     "detail": "Baic|BJ30e (powertrain suffix (e) of same model name)"
    }
   ]
  },
  {
   "id": "m_000020",
   "slug": "mg-hs",
   "brand": "MG",
   "model": "HS",
   "id_status": "PROVISIONAL",
   "model_year": 2027,
   "price_from": {
    "status": "RESOLVED",
    "value": 1525000,
    "trim_key": "plusluxury",
    "confidence": "MEDIUM",
    "model_year": 2027,
    "unresolved_trims_in_cohort": [],
    "basis": "derived: min official price across trims of the latest model-year cohort that has any numeric official price"
   },
   "trims": [
    {
     "key": "plusluxury",
     "label": "Plus Luxury",
     "labels": [
      "Plus Luxury"
     ],
     "status": "SINGLE_SOURCE",
     "confidence": "MEDIUM",
     "value": 1525000,
     "min": 1525000,
     "max": 1525000,
     "sources": [
      "egycar"
     ],
     "observed_at": "2026-09-10",
     "urls": [
      "https://www.egy-car.com/mg-hs"
     ],
     "powertrain": null,
     "plugin": false,
     "powertrain_basis": "unstated",
     "changes": []
    },
    {
     "key": "hev",
     "label": "HEV",
     "labels": [
      "HEV"
     ],
     "status": "SINGLE_SOURCE",
     "confidence": "MEDIUM",
     "value": 1625000,
     "min": 1625000,
     "max": 1625000,
     "sources": [
      "egycar"
     ],
     "observed_at": "2026-09-10",
     "urls": [
      "https://www.egy-car.com/mg-hs"
     ],
     "powertrain": "hybrid",
     "plugin": false,
     "powertrain_basis": "label",
     "changes": []
    }
   ],
   "unpriced_trims": 0,
   "powertrains": [
    "hybrid",
    "petrol"
   ],
   "specs": {
    "seats": null,
    "transmission": {
     "status": "MULTIPLE_VALUES",
     "values": [
      {
       "value": "Automatic",
       "sources": [
        "ContactCars"
       ]
      },
      {
       "value": "Automatic - Dual Clutch (Wet DCT, 7-speed)",
       "sources": [
        "ContactCars"
       ]
      },
      {
       "value": "DCT wet, 7-speed",
       "sources": [
        "EgyCar"
       ]
      },
      {
       "value": "EDU Gen 3",
       "sources": [
        "EgyCar"
       ]
      }
     ]
    },
    "engine_capacity": {
     "status": "SINGLE_VALUE",
     "values": [
      {
       "value": "1500cc turbo",
       "sources": [
        "EgyCar"
       ]
      }
     ]
    },
    "horsepower": {
     "status": "MULTIPLE_VALUES",
     "values": [
      {
       "value": "170",
       "sources": [
        "ContactCars",
        "EgyCar"
       ]
      },
      {
       "value": "221",
       "sources": [
        "EgyCar"
       ]
      }
     ]
    },
    "drive_type": {
     "status": "SINGLE_VALUE",
     "values": [
      {
       "value": "FWD",
       "sources": [
        "EgyCar"
       ]
      }
     ]
    },
    "fuel_type_raw": {
     "status": "MULTIPLE_VALUES",
     "values": [
      {
       "value": "Gas",
       "sources": [
        "ContactCars"
       ]
      },
      {
       "value": "Hybrid",
       "sources": [
        "ContactCars"
       ]
      }
     ]
    },
    "warranty": null,
    "length": {
     "status": "SINGLE_VALUE",
     "values": [
      {
       "value": "467cm",
       "sources": [
        "EgyCar"
       ]
      }
     ]
    },
    "trunk_capacity": {
     "status": "SINGLE_VALUE",
     "values": [
      {
       "value": "507-1484L",
       "sources": [
        "EgyCar"
       ]
      }
     ]
    },
    "fuel_consumption": {
     "status": "MULTIPLE_VALUES",
     "values": [
      {
       "value": "5.5L/100km",
       "sources": [
        "EgyCar"
       ]
      },
      {
       "value": "7.6L/100km",
       "sources": [
        "EgyCar"
       ]
      }
     ]
    },
    "electric_range": null,
    "battery_capacity": {
     "status": "SINGLE_VALUE",
     "values": [
      {
       "value": "1.8kWh",
       "sources": [
        "ContactCars",
        "EgyCar"
       ]
      }
     ]
    }
   },
   "warranty_years_max": null,
   "registration": {
    "count": 1338,
    "rank": 12,
    "of": 21,
    "share": 0.0329,
    "yoy": 4.677,
    "first_seen": "2021-02",
    "mix": {
     "ICE": 1338
    },
    "last12": [
     [
      "2025-09",
      161
     ],
     [
      "2025-10",
      56
     ],
     [
      "2025-11",
      51
     ],
     [
      "2025-12",
      114
     ],
     [
      "2026-01",
      81
     ],
     [
      "2026-02",
      117
     ],
     [
      "2026-03",
      216
     ],
     [
      "2026-04",
      173
     ],
     [
      "2026-05",
      108
     ],
     [
      "2026-07",
      130
     ],
     [
      "2026-08",
      131
     ]
    ],
    "window": {
     "start": "2025-09",
     "end": "2026-08",
     "months_present": [
      "2025-09",
      "2025-10",
      "2025-11",
      "2025-12",
      "2026-01",
      "2026-02",
      "2026-03",
      "2026-04",
      "2026-05",
      "2026-07",
      "2026-08"
     ],
     "months_missing": [
      "2026-06"
     ]
    },
    "unit": "first registrations (licences), passenger vehicles; not sales",
    "alias_pending_review": false
   },
   "freshness": {
    "price_snapshots": [
     {
      "id": "S0_2026-09-10",
      "observed_at": "2026-09-10",
      "model_observed": true
     },
     {
      "id": "S1_2026-09-25",
      "observed_at": "2026-09-25",
      "model_observed": true
     }
    ],
    "source_stated_price_dates": [
     "2026-08-05"
    ],
    "spec_snapshot": "2026-09-10",
    "registration_data_through": "2026-08"
   },
   "conflicts": [],
   "gaps": [],
   "review_open": []
  },
  {
   "id": "m_000011",
   "slug": "chery-tiggo-8-pro-max",
   "brand": "Chery",
   "model": "Tiggo 8 Pro Max",
   "id_status": "PROVISIONAL",
   "model_year": 2027,
   "price_from": {
    "status": "RESOLVED",
    "value": 1620000,
    "trim_key": "luxury",
    "confidence": "MEDIUM",
    "model_year": 2027,
    "unresolved_trims_in_cohort": [],
    "basis": "derived: min official price across trims of the latest model-year cohort that has any numeric official price"
   },
   "trims": [
    {
     "key": "luxury",
     "label": "Luxury",
     "labels": [
      "A/T / Luxury"
     ],
     "status": "SINGLE_SOURCE",
     "confidence": "MEDIUM",
     "value": 1620000,
     "min": 1620000,
     "max": 1620000,
     "sources": [
      "hatla2ee"
     ],
     "observed_at": "2026-09-25T10:28:05Z",
     "urls": [
      "https://eg.hatla2ee.com/en/new-car/chery/Tiggo-8-Pro-Max"
     ],
     "powertrain": "petrol",
     "plugin": false,
     "powertrain_basis": "model",
     "changes": []
    },
    {
     "key": "t6dctluxury",
     "label": "1.6T 6DCT Luxury",
     "labels": [
      "1.6T 6DCT Luxury"
     ],
     "status": "SINGLE_SOURCE",
     "confidence": "MEDIUM",
     "value": 1620000,
     "min": 1620000,
     "max": 1620000,
     "sources": [
      "contactcars"
     ],
     "observed_at": "2026-09-25T10:28:14Z",
     "urls": [
      "https://www.contactcars.com/en/new-cars/chery-tiggo_8_pro_max/year-2027"
     ],
     "powertrain": "petrol",
     "plugin": false,
     "powertrain_basis": "model",
     "changes": []
    },
    {
     "key": "flagship",
     "label": "Flagship",
     "labels": [
      "A/T / Flagship"
     ],
     "status": "SINGLE_SOURCE",
     "confidence": "MEDIUM",
     "value": 1720000,
     "min": 1720000,
     "max": 1720000,
     "sources": [
      "hatla2ee"
     ],
     "observed_at": "2026-09-25T10:28:05Z",
     "urls": [
      "https://eg.hatla2ee.com/en/new-car/chery/Tiggo-8-Pro-Max"
     ],
     "powertrain": "petrol",
     "plugin": false,
     "powertrain_basis": "model",
     "changes": []
    },
    {
     "key": "t6dctflagship",
     "label": "1.6T 6DCT Flagship",
     "labels": [
      "1.6T 6DCT Flagship"
     ],
     "status": "SINGLE_SOURCE",
     "confidence": "MEDIUM",
     "value": 1720000,
     "min": 1720000,
     "max": 1720000,
     "sources": [
      "contactcars"
     ],
     "observed_at": "2026-09-25T10:28:14Z",
     "urls": [
      "https://www.contactcars.com/en/new-cars/chery-tiggo_8_pro_max/year-2027"
     ],
     "powertrain": "petrol",
     "plugin": false,
     "powertrain_basis": "model",
     "changes": []
    }
   ],
   "unpriced_trims": 1,
   "powertrains": [
    "petrol"
   ],
   "specs": {
    "seats": null,
    "transmission": {
     "status": "SINGLE_VALUE",
     "values": [
      {
       "value": "6-speed Dual Clutch",
       "sources": [
        "ContactCars"
       ]
      }
     ]
    },
    "engine_capacity": {
     "status": "SINGLE_VALUE",
     "values": [
      {
       "value": "1600cc turbo",
       "sources": [
        "ContactCars"
       ]
      }
     ]
    },
    "horsepower": null,
    "drive_type": null,
    "fuel_type_raw": {
     "status": "SINGLE_VALUE",
     "values": [
      {
       "value": "Gas",
       "sources": [
        "ContactCars"
       ]
      }
     ]
    },
    "warranty": null,
    "length": null,
    "trunk_capacity": null,
    "fuel_consumption": null,
    "electric_range": null,
    "battery_capacity": null
   },
   "warranty_years_max": null,
   "registration": {
    "count": 1009,
    "rank": 13,
    "of": 21,
    "share": 0.0248,
    "yoy": null,
    "first_seen": "2025-07",
    "mix": {
     "ICE": 1009
    },
    "last12": [
     [
      "2025-09",
      94
     ],
     [
      "2025-10",
      79
     ],
     [
      "2025-11",
      26
     ],
     [
      "2025-12",
      93
     ],
     [
      "2026-01",
      119
     ],
     [
      "2026-02",
      94
     ],
     [
      "2026-03",
      136
     ],
     [
      "2026-04",
      110
     ],
     [
      "2026-05",
      86
     ],
     [
      "2026-07",
      110
     ],
     [
      "2026-08",
      62
     ]
    ],
    "window": {
     "start": "2025-09",
     "end": "2026-08",
     "months_present": [
      "2025-09",
      "2025-10",
      "2025-11",
      "2025-12",
      "2026-01",
      "2026-02",
      "2026-03",
      "2026-04",
      "2026-05",
      "2026-07",
      "2026-08"
     ],
     "months_missing": [
      "2026-06"
     ]
    },
    "unit": "first registrations (licences), passenger vehicles; not sales",
    "alias_pending_review": false
   },
   "freshness": {
    "price_snapshots": [
     {
      "id": "S0_2026-09-10",
      "observed_at": "2026-09-10",
      "model_observed": true
     },
     {
      "id": "S1_2026-09-25",
      "observed_at": "2026-09-25",
      "model_observed": true
     }
    ],
    "source_stated_price_dates": [],
    "spec_snapshot": "2026-09-10",
    "registration_data_through": "2026-08"
   },
   "conflicts": [],
   "gaps": [],
   "review_open": []
  },
  {
   "id": "m_000012",
   "slug": "renault-austral",
   "brand": "Renault",
   "model": "Austral",
   "id_status": "PROVISIONAL",
   "model_year": 2026,
   "price_from": {
    "status": "RESOLVED",
    "value": 1400000,
    "trim_key": "evolution",
    "confidence": "MEDIUM",
    "model_year": 2026,
    "unresolved_trims_in_cohort": [],
    "basis": "derived: min official price across trims of the latest model-year cohort that has any numeric official price"
   },
   "trims": [
    {
     "key": "evolution",
     "label": "Evolution",
     "labels": [
      "A/T / Evolution",
      "Evolution"
     ],
     "status": "SINGLE_SOURCE",
     "confidence": "MEDIUM",
     "value": 1400000,
     "min": 1400000,
     "max": 1400000,
     "sources": [
      "hatla2ee"
     ],
     "observed_at": "2026-09-25T10:28:10Z",
     "urls": [
      "https://eg.hatla2ee.com/en/new-car/renault/Austral"
     ],
     "powertrain": "petrol",
     "plugin": false,
     "powertrain_basis": "model",
     "changes": []
    },
    {
     "key": "evolutionfacelift",
     "label": "Evolution Facelift",
     "labels": [
      "Evolution Facelift"
     ],
     "status": "SINGLE_SOURCE",
     "confidence": "MEDIUM",
     "value": 1550000,
     "min": 1550000,
     "max": 1550000,
     "sources": [
      "contactcars"
     ],
     "observed_at": "2026-09-25T10:28:19Z",
     "urls": [
      "https://www.contactcars.com/en/new-cars/renault-austral/year-2026"
     ],
     "powertrain": "petrol",
     "plugin": false,
     "powertrain_basis": "model",
     "changes": []
    },
    {
     "key": "techno",
     "label": "Techno",
     "labels": [
      "A/T / Techno",
      "Techno"
     ],
     "status": "SINGLE_SOURCE",
     "confidence": "MEDIUM",
     "value": 1570000,
     "min": 1570000,
     "max": 1570000,
     "sources": [
      "hatla2ee"
     ],
     "observed_at": "2026-09-25T10:28:10Z",
     "urls": [
      "https://eg.hatla2ee.com/en/new-car/renault/Austral"
     ],
     "powertrain": "petrol",
     "plugin": false,
     "powertrain_basis": "model",
     "changes": []
    },
    {
     "key": "iconic",
     "label": "Iconic",
     "labels": [
      "A/T / Iconic",
      "Iconic"
     ],
     "status": "SINGLE_SOURCE",
     "confidence": "MEDIUM",
     "value": 1630000,
     "min": 1630000,
     "max": 1630000,
     "sources": [
      "hatla2ee"
     ],
     "observed_at": "2026-09-25T10:28:10Z",
     "urls": [
      "https://eg.hatla2ee.com/en/new-car/renault/Austral"
     ],
     "powertrain": "petrol",
     "plugin": false,
     "powertrain_basis": "model",
     "changes": []
    },
    {
     "key": "technofacelift",
     "label": "Techno Facelift",
     "labels": [
      "Techno Facelift"
     ],
     "status": "SINGLE_SOURCE",
     "confidence": "MEDIUM",
     "value": 1690000,
     "min": 1690000,
     "max": 1690000,
     "sources": [
      "contactcars"
     ],
     "observed_at": "2026-09-25T10:28:19Z",
     "urls": [
      "https://www.contactcars.com/en/new-cars/renault-austral/year-2026"
     ],
     "powertrain": "petrol",
     "plugin": false,
     "powertrain_basis": "model",
     "changes": []
    },
    {
     "key": "espritalpine",
     "label": "Esprit Alpine",
     "labels": [
      "A/T /  Esprit Alpine",
      "Esprit Alpine"
     ],
     "status": "SINGLE_SOURCE",
     "confidence": "MEDIUM",
     "value": 1740000,
     "min": 1740000,
     "max": 1740000,
     "sources": [
      "hatla2ee"
     ],
     "observed_at": "2026-09-25T10:28:10Z",
     "urls": [
      "https://eg.hatla2ee.com/en/new-car/renault/Austral"
     ],
     "powertrain": "petrol",
     "plugin": false,
     "powertrain_basis": "model",
     "changes": []
    },
    {
     "key": "espritalpinebe",
     "label": "Esprit Alpine / B/E",
     "labels": [
      "A/T / Esprit Alpine / B/E",
      "Esprit Alpine / B/E"
     ],
     "status": "SINGLE_SOURCE",
     "confidence": "MEDIUM",
     "value": 1770000,
     "min": 1770000,
     "max": 1770000,
     "sources": [
      "hatla2ee"
     ],
     "observed_at": "2026-09-25T10:28:10Z",
     "urls": [
      "https://eg.hatla2ee.com/en/new-car/renault/Austral"
     ],
     "powertrain": "petrol",
     "plugin": false,
     "powertrain_basis": "model",
     "changes": []
    },
    {
     "key": "iconicfacelift",
     "label": "Iconic Facelift",
     "labels": [
      "Iconic Facelift"
     ],
     "status": "SINGLE_SOURCE",
     "confidence": "MEDIUM",
     "value": 1790000,
     "min": 1790000,
     "max": 1790000,
     "sources": [
      "contactcars"
     ],
     "observed_at": "2026-09-25T10:28:19Z",
     "urls": [
      "https://www.contactcars.com/en/new-cars/renault-austral/year-2026"
     ],
     "powertrain": "petrol",
     "plugin": false,
     "powertrain_basis": "model",
     "changes": []
    },
    {
     "key": "espiritalpine",
     "label": "Espirit Alpine",
     "labels": [
      "Espirit Alpine"
     ],
     "status": "SINGLE_SOURCE",
     "confidence": "MEDIUM",
     "value": 1890000,
     "min": 1890000,
     "max": 1890000,
     "sources": [
      "contactcars"
     ],
     "observed_at": "2026-09-25T10:28:19Z",
     "urls": [
      "https://www.contactcars.com/en/new-cars/renault-austral/year-2026"
     ],
     "powertrain": "petrol",
     "plugin": false,
     "powertrain_basis": "model",
     "changes": []
    }
   ],
   "unpriced_trims": 0,
   "powertrains": [
    "petrol"
   ],
   "specs": {
    "seats": {
     "status": "SINGLE_VALUE",
     "values": [
      {
       "value": "5",
       "sources": [
        "ContactCars"
       ]
      }
     ]
    },
    "transmission": {
     "status": "MULTIPLE_VALUES",
     "values": [
      {
       "value": "Automatic",
       "sources": [
        "Hatla2ee"
       ]
      },
      {
       "value": "Dual Clutch-CVT",
       "sources": [
        "ContactCars"
       ]
      }
     ]
    },
    "engine_capacity": {
     "status": "SINGLE_VALUE",
     "values": [
      {
       "value": "1300cc",
       "sources": [
        "Hatla2ee"
       ]
      }
     ]
    },
    "horsepower": null,
    "drive_type": null,
    "fuel_type_raw": {
     "status": "SINGLE_VALUE",
     "values": [
      {
       "value": "Gas",
       "sources": [
        "ContactCars"
       ]
      }
     ]
    },
    "warranty": null,
    "length": null,
    "trunk_capacity": null,
    "fuel_consumption": null,
    "electric_range": null,
    "battery_capacity": null
   },
   "warranty_years_max": null,
   "registration": {
    "count": 964,
    "rank": 14,
    "of": 21,
    "share": 0.0237,
    "yoy": 0.055,
    "first_seen": "2023-05",
    "mix": {
     "ICE": 964
    },
    "last12": [
     [
      "2025-09",
      48
     ],
     [
      "2025-10",
      85
     ],
     [
      "2025-11",
      117
     ],
     [
      "2025-12",
      65
     ],
     [
      "2026-01",
      50
     ],
     [
      "2026-02",
      103
     ],
     [
      "2026-03",
      117
     ],
     [
      "2026-04",
      131
     ],
     [
      "2026-05",
      77
     ],
     [
      "2026-07",
      44
     ],
     [
      "2026-08",
      127
     ]
    ],
    "window": {
     "start": "2025-09",
     "end": "2026-08",
     "months_present": [
      "2025-09",
      "2025-10",
      "2025-11",
      "2025-12",
      "2026-01",
      "2026-02",
      "2026-03",
      "2026-04",
      "2026-05",
      "2026-07",
      "2026-08"
     ],
     "months_missing": [
      "2026-06"
     ]
    },
    "unit": "first registrations (licences), passenger vehicles; not sales",
    "alias_pending_review": false
   },
   "freshness": {
    "price_snapshots": [
     {
      "id": "S0_2026-09-10",
      "observed_at": "2026-09-10",
      "model_observed": true
     },
     {
      "id": "S1_2026-09-25",
      "observed_at": "2026-09-25",
      "model_observed": true
     }
    ],
    "source_stated_price_dates": [],
    "spec_snapshot": "2026-09-10",
    "registration_data_through": "2026-08"
   },
   "conflicts": [],
   "gaps": [],
   "review_open": []
  },
  {
   "id": "m_000013",
   "slug": "soueast-s09",
   "brand": "Soueast",
   "model": "S09",
   "id_status": "PROVISIONAL",
   "model_year": 2027,
   "price_from": {
    "status": "RESOLVED",
    "value": 1600000,
    "trim_key": "premium",
    "confidence": "HIGH",
    "model_year": 2027,
    "unresolved_trims_in_cohort": [],
    "basis": "derived: min official price across trims of the latest model-year cohort that has any numeric official price"
   },
   "trims": [
    {
     "key": "premium",
     "label": "Premium",
     "labels": [
      "A/T / Premium",
      "Premium"
     ],
     "status": "AGREED",
     "confidence": "HIGH",
     "value": 1600000,
     "min": 1600000,
     "max": 1600000,
     "sources": [
      "contactcars",
      "hatla2ee"
     ],
     "observed_at": "2026-09-25T10:28:21Z",
     "urls": [
      "https://eg.hatla2ee.com/en/new-car/soueast/S+09",
      "https://www.contactcars.com/en/new-cars/soueast-s_09/year-2027"
     ],
     "powertrain": "petrol",
     "plugin": false,
     "powertrain_basis": "model",
     "changes": []
    }
   ],
   "unpriced_trims": 0,
   "powertrains": [
    "petrol"
   ],
   "specs": {
    "seats": {
     "status": "SINGLE_VALUE",
     "values": [
      {
       "value": "7",
       "sources": [
        "ContactCars"
       ]
      }
     ]
    },
    "transmission": {
     "status": "MULTIPLE_VALUES",
     "values": [
      {
       "value": "Automatic",
       "sources": [
        "Hatla2ee"
       ]
      },
      {
       "value": "Dual Clutch",
       "sources": [
        "ContactCars"
       ]
      }
     ]
    },
    "engine_capacity": {
     "status": "SINGLE_VALUE",
     "values": [
      {
       "value": "1600",
       "sources": [
        "Hatla2ee"
       ]
      }
     ]
    },
    "horsepower": null,
    "drive_type": null,
    "fuel_type_raw": {
     "status": "SINGLE_VALUE",
     "values": [
      {
       "value": "Gas",
       "sources": [
        "ContactCars",
        "Hatla2ee"
       ]
      }
     ]
    },
    "warranty": {
     "status": "SINGLE_VALUE",
     "values": [
      {
       "value": "150,000 Km / 6 Years",
       "sources": [
        "Hatla2ee"
       ]
      }
     ]
    },
    "length": null,
    "trunk_capacity": null,
    "fuel_consumption": null,
    "electric_range": null,
    "battery_capacity": null
   },
   "warranty_years_max": 6,
   "registration": {
    "count": 914,
    "rank": 15,
    "of": 21,
    "share": 0.0225,
    "yoy": null,
    "first_seen": "2025-07",
    "mix": {
     "ICE": 914
    },
    "last12": [
     [
      "2025-09",
      99
     ],
     [
      "2025-10",
      113
     ],
     [
      "2025-11",
      63
     ],
     [
      "2025-12",
      51
     ],
     [
      "2026-01",
      43
     ],
     [
      "2026-02",
      47
     ],
     [
      "2026-03",
      132
     ],
     [
      "2026-04",
      128
     ],
     [
      "2026-05",
      124
     ],
     [
      "2026-07",
      81
     ],
     [
      "2026-08",
      33
     ]
    ],
    "window": {
     "start": "2025-09",
     "end": "2026-08",
     "months_present": [
      "2025-09",
      "2025-10",
      "2025-11",
      "2025-12",
      "2026-01",
      "2026-02",
      "2026-03",
      "2026-04",
      "2026-05",
      "2026-07",
      "2026-08"
     ],
     "months_missing": [
      "2026-06"
     ]
    },
    "unit": "first registrations (licences), passenger vehicles; not sales",
    "alias_pending_review": false
   },
   "freshness": {
    "price_snapshots": [
     {
      "id": "S0_2026-09-10",
      "observed_at": "2026-09-10",
      "model_observed": true
     },
     {
      "id": "S1_2026-09-25",
      "observed_at": "2026-09-25",
      "model_observed": true
     }
    ],
    "source_stated_price_dates": [],
    "spec_snapshot": "2026-09-10",
    "registration_data_through": "2026-08"
   },
   "conflicts": [],
   "gaps": [],
   "review_open": []
  },
  {
   "id": "m_000014",
   "slug": "peugeot-5008",
   "brand": "Peugeot",
   "model": "5008",
   "id_status": "PROVISIONAL",
   "model_year": 2027,
   "price_from": {
    "status": "RESOLVED",
    "value": 2274990,
    "trim_key": "allure",
    "confidence": "MEDIUM",
    "model_year": 2027,
    "unresolved_trims_in_cohort": [],
    "basis": "derived: min official price across trims of the latest model-year cohort that has any numeric official price"
   },
   "trims": [
    {
     "key": "allure",
     "label": "Allure",
     "labels": [
      "A/T / Allure",
      "Allure"
     ],
     "status": "SINGLE_SOURCE",
     "confidence": "MEDIUM",
     "value": 2274990,
     "min": 2274990,
     "max": 2274990,
     "sources": [
      "hatla2ee"
     ],
     "observed_at": "2026-09-25T10:28:09Z",
     "urls": [
      "https://eg.hatla2ee.com/en/new-car/peugeot/5008"
     ],
     "powertrain": "petrol",
     "plugin": false,
     "powertrain_basis": "model",
     "changes": []
    },
    {
     "key": "gt",
     "label": "GT",
     "labels": [
      "A/T / GT",
      "GT"
     ],
     "status": "SINGLE_SOURCE",
     "confidence": "MEDIUM",
     "value": 2574990,
     "min": 2574990,
     "max": 2574990,
     "sources": [
      "hatla2ee"
     ],
     "observed_at": "2026-09-25T10:28:09Z",
     "urls": [
      "https://eg.hatla2ee.com/en/new-car/peugeot/5008"
     ],
     "powertrain": "petrol",
     "plugin": false,
     "powertrain_basis": "model",
     "changes": []
    }
   ],
   "unpriced_trims": 0,
   "powertrains": [
    "petrol"
   ],
   "specs": {
    "seats": null,
    "transmission": {
     "status": "SINGLE_VALUE",
     "values": [
      {
       "value": "Automatic",
       "sources": [
        "Hatla2ee"
       ]
      }
     ]
    },
    "engine_capacity": {
     "status": "SINGLE_VALUE",
     "values": [
      {
       "value": "1600",
       "sources": [
        "Hatla2ee"
       ]
      }
     ]
    },
    "horsepower": null,
    "drive_type": null,
    "fuel_type_raw": null,
    "warranty": {
     "status": "SINGLE_VALUE",
     "values": [
      {
       "value": "150,000 Km / 5 Years",
       "sources": [
        "Hatla2ee"
       ]
      }
     ]
    },
    "length": null,
    "trunk_capacity": null,
    "fuel_consumption": null,
    "electric_range": null,
    "battery_capacity": null
   },
   "warranty_years_max": 5,
   "registration": {
    "count": 906,
    "rank": 16,
    "of": 21,
    "share": 0.0223,
    "yoy": -0.048,
    "first_seen": "2021-02",
    "mix": {
     "ICE": 906
    },
    "last12": [
     [
      "2025-09",
      36
     ],
     [
      "2025-10",
      53
     ],
     [
      "2025-11",
      51
     ],
     [
      "2025-12",
      69
     ],
     [
      "2026-01",
      87
     ],
     [
      "2026-02",
      54
     ],
     [
      "2026-03",
      155
     ],
     [
      "2026-04",
      104
     ],
     [
      "2026-05",
      67
     ],
     [
      "2026-07",
      126
     ],
     [
      "2026-08",
      104
     ]
    ],
    "window": {
     "start": "2025-09",
     "end": "2026-08",
     "months_present": [
      "2025-09",
      "2025-10",
      "2025-11",
      "2025-12",
      "2026-01",
      "2026-02",
      "2026-03",
      "2026-04",
      "2026-05",
      "2026-07",
      "2026-08"
     ],
     "months_missing": [
      "2026-06"
     ]
    },
    "unit": "first registrations (licences), passenger vehicles; not sales",
    "alias_pending_review": false
   },
   "freshness": {
    "price_snapshots": [
     {
      "id": "S0_2026-09-10",
      "observed_at": "2026-09-10",
      "model_observed": true
     },
     {
      "id": "S1_2026-09-25",
      "observed_at": "2026-09-25",
      "model_observed": true
     }
    ],
    "source_stated_price_dates": [],
    "spec_snapshot": "2026-09-10",
    "registration_data_through": "2026-08"
   },
   "conflicts": [],
   "gaps": [
    "SINGLE_SOURCE_MODEL"
   ],
   "review_open": []
  },
  {
   "id": "m_000016",
   "slug": "kia-seltos",
   "brand": "Kia",
   "model": "Seltos",
   "id_status": "PROVISIONAL",
   "model_year": 2026,
   "price_from": {
    "status": "RESOLVED",
    "value": 1350000,
    "trim_key": "ex",
    "confidence": "HIGH",
    "model_year": 2026,
    "unresolved_trims_in_cohort": [],
    "basis": "derived: min official price across trims of the latest model-year cohort that has any numeric official price"
   },
   "trims": [
    {
     "key": "ex",
     "label": "EX",
     "labels": [
      "EX"
     ],
     "status": "AGREED",
     "confidence": "HIGH",
     "value": 1350000,
     "min": 1350000,
     "max": 1350000,
     "sources": [
      "contactcars",
      "egycar"
     ],
     "observed_at": "2026-09-25T10:28:21Z",
     "urls": [
      "https://www.contactcars.com/en/new-cars/kia-seltos/year-2026",
      "https://www.egy-car.com/kia-seltos"
     ],
     "powertrain": "petrol",
     "plugin": false,
     "powertrain_basis": "model",
     "changes": []
    },
    {
     "key": "highlineturbo",
     "label": "Highline Turbo",
     "labels": [
      "Highline Turbo"
     ],
     "status": "AGREED",
     "confidence": "HIGH",
     "value": 1500000,
     "min": 1500000,
     "max": 1500000,
     "sources": [
      "contactcars",
      "egycar"
     ],
     "observed_at": "2026-09-25T10:28:21Z",
     "urls": [
      "https://www.contactcars.com/en/new-cars/kia-seltos/year-2026",
      "https://www.egy-car.com/kia-seltos"
     ],
     "powertrain": "petrol",
     "plugin": false,
     "powertrain_basis": "model",
     "changes": []
    },
    {
     "key": "toplineturbo",
     "label": "Topline Turbo",
     "labels": [
      "Topline Turbo",
      "Topline Turbo"
     ],
     "status": "AGREED",
     "confidence": "HIGH",
     "value": 1625000,
     "min": 1625000,
     "max": 1625000,
     "sources": [
      "contactcars",
      "egycar"
     ],
     "observed_at": "2026-09-25T10:28:21Z",
     "urls": [
      "https://www.contactcars.com/en/new-cars/kia-seltos/year-2026",
      "https://www.egy-car.com/kia-seltos"
     ],
     "powertrain": "petrol",
     "plugin": false,
     "powertrain_basis": "model",
     "changes": []
    }
   ],
   "unpriced_trims": 0,
   "powertrains": [
    "petrol"
   ],
   "specs": {
    "seats": null,
    "transmission": {
     "status": "MULTIPLE_VALUES",
     "values": [
      {
       "value": "Automatic",
       "sources": [
        "ContactCars"
       ]
      },
      {
       "value": "IVT/DCT",
       "sources": [
        "EgyCar"
       ]
      }
     ]
    },
    "engine_capacity": {
     "status": "SINGLE_VALUE",
     "values": [
      {
       "value": "1500cc/1400cc turbo",
       "sources": [
        "EgyCar"
       ]
      }
     ]
    },
    "horsepower": {
     "status": "SINGLE_VALUE",
     "values": [
      {
       "value": "115/140",
       "sources": [
        "EgyCar"
       ]
      }
     ]
    },
    "drive_type": {
     "status": "SINGLE_VALUE",
     "values": [
      {
       "value": "FWD",
       "sources": [
        "EgyCar"
       ]
      }
     ]
    },
    "fuel_type_raw": null,
    "warranty": null,
    "length": {
     "status": "SINGLE_VALUE",
     "values": [
      {
       "value": "438.5cm",
       "sources": [
        "EgyCar"
       ]
      }
     ]
    },
    "trunk_capacity": {
     "status": "SINGLE_VALUE",
     "values": [
      {
       "value": "433L",
       "sources": [
        "EgyCar"
       ]
      }
     ]
    },
    "fuel_consumption": null,
    "electric_range": null,
    "battery_capacity": null
   },
   "warranty_years_max": null,
   "registration": {
    "count": 797,
    "rank": 17,
    "of": 21,
    "share": 0.0196,
    "yoy": 0.802,
    "first_seen": "2021-08",
    "mix": {
     "ICE": 797
    },
    "last12": [
     [
      "2025-09",
      162
     ],
     [
      "2025-10",
      90
     ],
     [
      "2025-11",
      61
     ],
     [
      "2025-12",
      51
     ],
     [
      "2026-01",
      67
     ],
     [
      "2026-02",
      47
     ],
     [
      "2026-03",
      56
     ],
     [
      "2026-04",
      36
     ],
     [
      "2026-05",
      65
     ],
     [
      "2026-07",
      78
     ],
     [
      "2026-08",
      84
     ]
    ],
    "window": {
     "start": "2025-09",
     "end": "2026-08",
     "months_present": [
      "2025-09",
      "2025-10",
      "2025-11",
      "2025-12",
      "2026-01",
      "2026-02",
      "2026-03",
      "2026-04",
      "2026-05",
      "2026-07",
      "2026-08"
     ],
     "months_missing": [
      "2026-06"
     ]
    },
    "unit": "first registrations (licences), passenger vehicles; not sales",
    "alias_pending_review": false
   },
   "freshness": {
    "price_snapshots": [
     {
      "id": "S0_2026-09-10",
      "observed_at": "2026-09-10",
      "model_observed": true
     },
     {
      "id": "S1_2026-09-25",
      "observed_at": "2026-09-25",
      "model_observed": true
     }
    ],
    "source_stated_price_dates": [
     "2026-03-31"
    ],
    "spec_snapshot": "2026-09-10",
    "registration_data_through": "2026-08"
   },
   "conflicts": [],
   "gaps": [],
   "review_open": []
  },
  {
   "id": "m_000017",
   "slug": "kgm-torres",
   "brand": "KGM",
   "model": "Torres",
   "id_status": "PROVISIONAL",
   "model_year": 2026,
   "price_from": {
    "status": "RESOLVED",
    "value": 1585000,
    "trim_key": "automticcomfort",
    "confidence": "MEDIUM",
    "model_year": 2026,
    "unresolved_trims_in_cohort": [],
    "basis": "derived: min official price across trims of the latest model-year cohort that has any numeric official price"
   },
   "trims": [
    {
     "key": "automticcomfort",
     "label": "Automtic /comfort",
     "labels": [
      "Automtic /comfort"
     ],
     "status": "SINGLE_SOURCE",
     "confidence": "MEDIUM",
     "value": 1585000,
     "min": 1585000,
     "max": 1585000,
     "sources": [
      "hatla2ee"
     ],
     "observed_at": "2026-09-25T10:28:07Z",
     "urls": [
      "https://eg.hatla2ee.com/en/new-car/kgm/KGM-Torres"
     ],
     "powertrain": "petrol",
     "plugin": false,
     "powertrain_basis": "model",
     "changes": []
    },
    {
     "key": "automticadvanced",
     "label": "Automtic /advanced",
     "labels": [
      "Automtic /advanced"
     ],
     "status": "SINGLE_SOURCE",
     "confidence": "MEDIUM",
     "value": 1720002,
     "min": 1720002,
     "max": 1720002,
     "sources": [
      "hatla2ee"
     ],
     "observed_at": "2026-09-25T10:28:07Z",
     "urls": [
      "https://eg.hatla2ee.com/en/new-car/kgm/KGM-Torres"
     ],
     "powertrain": "petrol",
     "plugin": false,
     "powertrain_basis": "model",
     "changes": []
    },
    {
     "key": "premium",
     "label": "Premium",
     "labels": [
      "A/T / Premium"
     ],
     "status": "SINGLE_SOURCE",
     "confidence": "MEDIUM",
     "value": 1850001,
     "min": 1850001,
     "max": 1850001,
     "sources": [
      "hatla2ee"
     ],
     "observed_at": "2026-09-25T10:28:07Z",
     "urls": [
      "https://eg.hatla2ee.com/en/new-car/kgm/KGM-Torres"
     ],
     "powertrain": "petrol",
     "plugin": false,
     "powertrain_basis": "model",
     "changes": []
    },
    {
     "key": "luxury",
     "label": "Luxury",
     "labels": [
      "A/T / Luxury"
     ],
     "status": "SINGLE_SOURCE",
     "confidence": "MEDIUM",
     "value": 1980000,
     "min": 1980000,
     "max": 1980000,
     "sources": [
      "hatla2ee"
     ],
     "observed_at": "2026-09-25T10:28:07Z",
     "urls": [
      "https://eg.hatla2ee.com/en/new-car/kgm/KGM-Torres"
     ],
     "powertrain": "petrol",
     "plugin": false,
     "powertrain_basis": "model",
     "changes": []
    },
    {
     "key": "automticadventureplus44",
     "label": "Automtic /adventure plus 4*4",
     "labels": [
      "Automtic /adventure plus 4*4"
     ],
     "status": "SINGLE_SOURCE",
     "confidence": "MEDIUM",
     "value": 1999000,
     "min": 1999000,
     "max": 1999000,
     "sources": [
      "hatla2ee"
     ],
     "observed_at": "2026-09-25T10:28:07Z",
     "urls": [
      "https://eg.hatla2ee.com/en/new-car/kgm/KGM-Torres"
     ],
     "powertrain": "petrol",
     "plugin": false,
     "powertrain_basis": "model",
     "changes": []
    }
   ],
   "unpriced_trims": 0,
   "powertrains": [
    "petrol"
   ],
   "specs": {
    "seats": null,
    "transmission": {
     "status": "SINGLE_VALUE",
     "values": [
      {
       "value": "Automatic",
       "sources": [
        "Hatla2ee"
       ]
      }
     ]
    },
    "engine_capacity": {
     "status": "SINGLE_VALUE",
     "values": [
      {
       "value": "1500",
       "sources": [
        "Hatla2ee"
       ]
      }
     ]
    },
    "horsepower": null,
    "drive_type": null,
    "fuel_type_raw": {
     "status": "SINGLE_VALUE",
     "values": [
      {
       "value": "Gas",
       "sources": [
        "Hatla2ee"
       ]
      }
     ]
    },
    "warranty": {
     "status": "SINGLE_VALUE",
     "values": [
      {
       "value": "100,000 Km / 5 Years",
       "sources": [
        "Hatla2ee"
       ]
      }
     ]
    },
    "length": null,
    "trunk_capacity": null,
    "fuel_consumption": null,
    "electric_range": null,
    "battery_capacity": null
   },
   "warranty_years_max": 5,
   "registration": {
    "count": 793,
    "rank": 18,
    "of": 21,
    "share": 0.0195,
    "yoy": -0.566,
    "first_seen": "2023-04",
    "mix": {
     "ICE": 793
    },
    "last12": [
     [
      "2025-09",
      64
     ],
     [
      "2025-10",
      38
     ],
     [
      "2025-11",
      27
     ],
     [
      "2025-12",
      75
     ],
     [
      "2026-01",
      67
     ],
     [
      "2026-02",
      59
     ],
     [
      "2026-03",
      190
     ],
     [
      "2026-04",
      61
     ],
     [
      "2026-05",
      98
     ],
     [
      "2026-07",
      87
     ],
     [
      "2026-08",
      27
     ]
    ],
    "window": {
     "start": "2025-09",
     "end": "2026-08",
     "months_present": [
      "2025-09",
      "2025-10",
      "2025-11",
      "2025-12",
      "2026-01",
      "2026-02",
      "2026-03",
      "2026-04",
      "2026-05",
      "2026-07",
      "2026-08"
     ],
     "months_missing": [
      "2026-06"
     ]
    },
    "unit": "first registrations (licences), passenger vehicles; not sales",
    "alias_pending_review": false
   },
   "freshness": {
    "price_snapshots": [
     {
      "id": "S0_2026-09-10",
      "observed_at": "2026-09-10",
      "model_observed": true
     },
     {
      "id": "S1_2026-09-25",
      "observed_at": "2026-09-25",
      "model_observed": true
     }
    ],
    "source_stated_price_dates": [],
    "spec_snapshot": "2026-09-10",
    "registration_data_through": "2026-08"
   },
   "conflicts": [],
   "gaps": [
    "SINGLE_SOURCE_MODEL"
   ],
   "review_open": []
  },
  {
   "id": "m_000018",
   "slug": "byd-sealion-6",
   "brand": "BYD",
   "model": "Sealion 6",
   "id_status": "PROVISIONAL",
   "model_year": 2027,
   "price_from": {
    "status": "RESOLVED",
    "value": 1799000,
    "trim_key": "evluxury",
    "confidence": "MEDIUM",
    "model_year": 2027,
    "unresolved_trims_in_cohort": [],
    "basis": "derived: min official price across trims of the latest model-year cohort that has any numeric official price"
   },
   "trims": [
    {
     "key": "evluxury",
     "label": "EV Luxury",
     "labels": [
      "A/T / EV Luxury",
      "EV Luxury"
     ],
     "status": "SINGLE_SOURCE",
     "confidence": "MEDIUM",
     "value": 1799000,
     "min": 1799000,
     "max": 1799000,
     "sources": [
      "hatla2ee"
     ],
     "observed_at": "2026-09-25T10:28:05Z",
     "urls": [
      "https://eg.hatla2ee.com/en/new-car/byd/sealion-6"
     ],
     "powertrain": "ev",
     "plugin": false,
     "powertrain_basis": "label",
     "changes": []
    },
    {
     "key": "dmiultra",
     "label": "DM-i Ultra",
     "labels": [
      "A/T / DM-i Ultra",
      "DM-i Ultra"
     ],
     "status": "SINGLE_SOURCE",
     "confidence": "MEDIUM",
     "value": 1949900,
     "min": 1949900,
     "max": 1949900,
     "sources": [
      "hatla2ee"
     ],
     "observed_at": "2026-09-25T10:28:05Z",
     "urls": [
      "https://eg.hatla2ee.com/en/new-car/byd/sealion-6"
     ],
     "powertrain": "hybrid",
     "plugin": true,
     "powertrain_basis": "label",
     "changes": []
    },
    {
     "key": "dmiluxury",
     "label": "DM-i Luxury",
     "labels": [
      "A/T / DM-i Luxury",
      "DM-i Luxury"
     ],
     "status": "SINGLE_SOURCE",
     "confidence": "MEDIUM",
     "value": 2149900,
     "min": 2149900,
     "max": 2149900,
     "sources": [
      "hatla2ee"
     ],
     "observed_at": "2026-09-25T10:28:05Z",
     "urls": [
      "https://eg.hatla2ee.com/en/new-car/byd/sealion-6"
     ],
     "powertrain": "hybrid",
     "plugin": true,
     "powertrain_basis": "label",
     "changes": []
    }
   ],
   "unpriced_trims": 0,
   "powertrains": [
    "ev",
    "hybrid"
   ],
   "specs": {
    "seats": null,
    "transmission": {
     "status": "SINGLE_VALUE",
     "values": [
      {
       "value": "Automatic",
       "sources": [
        "Hatla2ee"
       ]
      }
     ]
    },
    "engine_capacity": {
     "status": "SINGLE_VALUE",
     "values": [
      {
       "value": "1500",
       "sources": [
        "Hatla2ee"
       ]
      }
     ]
    },
    "horsepower": null,
    "drive_type": null,
    "fuel_type_raw": {
     "status": "MULTIPLE_VALUES",
     "values": [
      {
       "value": "Electric",
       "sources": [
        "Hatla2ee"
       ]
      },
      {
       "value": "Plug-in Hybrid",
       "sources": [
        "Hatla2ee"
       ]
      }
     ]
    },
    "warranty": {
     "status": "SINGLE_VALUE",
     "values": [
      {
       "value": "150,000 Km / 6 Years",
       "sources": [
        "Hatla2ee"
       ]
      }
     ]
    },
    "length": null,
    "trunk_capacity": null,
    "fuel_consumption": null,
    "electric_range": null,
    "battery_capacity": null
   },
   "warranty_years_max": 6,
   "registration": {
    "count": 767,
    "rank": 19,
    "of": 21,
    "share": 0.0189,
    "yoy": null,
    "first_seen": "2025-11",
    "mix": {
     "BEV": 455,
     "Hybrid": 312
    },
    "last12": [
     [
      "2025-11",
      9
     ],
     [
      "2025-12",
      21
     ],
     [
      "2026-01",
      17
     ],
     [
      "2026-02",
      117
     ],
     [
      "2026-03",
      195
     ],
     [
      "2026-04",
      195
     ],
     [
      "2026-05",
      69
     ],
     [
      "2026-07",
      66
     ],
     [
      "2026-08",
      78
     ]
    ],
    "window": {
     "start": "2025-09",
     "end": "2026-08",
     "months_present": [
      "2025-09",
      "2025-10",
      "2025-11",
      "2025-12",
      "2026-01",
      "2026-02",
      "2026-03",
      "2026-04",
      "2026-05",
      "2026-07",
      "2026-08"
     ],
     "months_missing": [
      "2026-06"
     ]
    },
    "unit": "first registrations (licences), passenger vehicles; not sales",
    "alias_pending_review": true
   },
   "freshness": {
    "price_snapshots": [
     {
      "id": "S0_2026-09-10",
      "observed_at": "2026-09-10",
      "model_observed": true
     },
     {
      "id": "S1_2026-09-25",
      "observed_at": "2026-09-25",
      "model_observed": true
     }
    ],
    "source_stated_price_dates": [],
    "spec_snapshot": "2026-09-10",
    "registration_data_through": "2026-08"
   },
   "conflicts": [],
   "gaps": [
    "SINGLE_SOURCE_MODEL"
   ],
   "review_open": [
    {
     "type": "REGISTRATION_ALIAS",
     "status": "ACCEPTED_PENDING_REVIEW",
     "detail": "BYD|Sealion 06 (zero-padded number fold (06->6))"
    }
   ]
  },
  {
   "id": "m_000021",
   "slug": "deepal-s05",
   "brand": "Deepal",
   "model": "S05",
   "id_status": "PROVISIONAL",
   "model_year": 2026,
   "price_from": {
    "status": "RESOLVED",
    "value": 1599000,
    "trim_key": "reev",
    "confidence": "MEDIUM",
    "model_year": 2026,
    "unresolved_trims_in_cohort": [],
    "basis": "derived: min official price across trims of the latest model-year cohort that has any numeric official price"
   },
   "trims": [
    {
     "key": "reev",
     "label": "REEV",
     "labels": [
      "A/T / REEV"
     ],
     "status": "SINGLE_SOURCE",
     "confidence": "MEDIUM",
     "value": 1599000,
     "min": 1599000,
     "max": 1599000,
     "sources": [
      "hatla2ee"
     ],
     "observed_at": "2026-09-25T10:28:05Z",
     "urls": [
      "https://eg.hatla2ee.com/en/new-car/deepal/Deepal_S05"
     ],
     "powertrain": "hybrid",
     "plugin": true,
     "powertrain_basis": "label",
     "changes": []
    },
    {
     "key": "bev",
     "label": "BEV",
     "labels": [
      "A/T / BEV"
     ],
     "status": "SINGLE_SOURCE",
     "confidence": "MEDIUM",
     "value": 1750000,
     "min": 1750000,
     "max": 1750000,
     "sources": [
      "hatla2ee"
     ],
     "observed_at": "2026-09-25T10:28:05Z",
     "urls": [
      "https://eg.hatla2ee.com/en/new-car/deepal/Deepal_S05"
     ],
     "powertrain": "ev",
     "plugin": false,
     "powertrain_basis": "label",
     "changes": []
    }
   ],
   "unpriced_trims": 0,
   "powertrains": [
    "ev",
    "hybrid"
   ],
   "specs": {
    "seats": null,
    "transmission": {
     "status": "SINGLE_VALUE",
     "values": [
      {
       "value": "Automatic",
       "sources": [
        "Hatla2ee"
       ]
      }
     ]
    },
    "engine_capacity": {
     "status": "SINGLE_VALUE",
     "values": [
      {
       "value": "1500",
       "sources": [
        "Hatla2ee"
       ]
      }
     ]
    },
    "horsepower": null,
    "drive_type": null,
    "fuel_type_raw": {
     "status": "MULTIPLE_VALUES",
     "values": [
      {
       "value": "Electric",
       "sources": [
        "Hatla2ee"
       ]
      },
      {
       "value": "Plug-in Hybrid",
       "sources": [
        "Hatla2ee"
       ]
      }
     ]
    },
    "warranty": {
     "status": "SINGLE_VALUE",
     "values": [
      {
       "value": "250,000 Km / 6 Years",
       "sources": [
        "Hatla2ee"
       ]
      }
     ]
    },
    "length": null,
    "trunk_capacity": null,
    "fuel_consumption": null,
    "electric_range": null,
    "battery_capacity": null
   },
   "warranty_years_max": 6,
   "registration": {
    "count": 600,
    "rank": 20,
    "of": 21,
    "share": 0.0148,
    "yoy": null,
    "first_seen": "2025-09",
    "mix": {
     "REEV": 600
    },
    "last12": [
     [
      "2025-09",
      21
     ],
     [
      "2025-10",
      21
     ],
     [
      "2025-11",
      39
     ],
     [
      "2025-12",
      18
     ],
     [
      "2026-01",
      89
     ],
     [
      "2026-02",
      58
     ],
     [
      "2026-03",
      103
     ],
     [
      "2026-04",
      36
     ],
     [
      "2026-05",
      54
     ],
     [
      "2026-07",
      66
     ],
     [
      "2026-08",
      95
     ]
    ],
    "window": {
     "start": "2025-09",
     "end": "2026-08",
     "months_present": [
      "2025-09",
      "2025-10",
      "2025-11",
      "2025-12",
      "2026-01",
      "2026-02",
      "2026-03",
      "2026-04",
      "2026-05",
      "2026-07",
      "2026-08"
     ],
     "months_missing": [
      "2026-06"
     ]
    },
    "unit": "first registrations (licences), passenger vehicles; not sales",
    "alias_pending_review": false
   },
   "freshness": {
    "price_snapshots": [
     {
      "id": "S0_2026-09-10",
      "observed_at": "2026-09-10",
      "model_observed": true
     },
     {
      "id": "S1_2026-09-25",
      "observed_at": "2026-09-25",
      "model_observed": true
     }
    ],
    "source_stated_price_dates": [],
    "spec_snapshot": "2026-09-10",
    "registration_data_through": "2026-08"
   },
   "conflicts": [],
   "gaps": [
    "SINGLE_SOURCE_MODEL"
   ],
   "review_open": []
  },
  {
   "id": "m_000022",
   "slug": "haval-h7",
   "brand": "Haval",
   "model": "H7",
   "id_status": "PROVISIONAL",
   "model_year": 2027,
   "price_from": {
    "status": "RESOLVED",
    "value": 1725000,
    "trim_key": "ultrablack",
    "confidence": "MEDIUM",
    "model_year": 2027,
    "unresolved_trims_in_cohort": [],
    "basis": "derived: min official price across trims of the latest model-year cohort that has any numeric official price"
   },
   "trims": [
    {
     "key": "ultrablack",
     "label": "Ultra Black",
     "labels": [
      "A/T / Ultra Black",
      "Ultra Black"
     ],
     "status": "SINGLE_SOURCE",
     "confidence": "MEDIUM",
     "value": 1725000,
     "min": 1725000,
     "max": 1725000,
     "sources": [
      "hatla2ee"
     ],
     "observed_at": "2026-09-25T10:28:05Z",
     "urls": [
      "https://eg.hatla2ee.com/en/new-car/haval/haval-H7"
     ],
     "powertrain": "hybrid",
     "plugin": false,
     "powertrain_basis": "model",
     "changes": []
    }
   ],
   "unpriced_trims": 0,
   "powertrains": [
    "hybrid"
   ],
   "specs": {
    "seats": null,
    "transmission": {
     "status": "SINGLE_VALUE",
     "values": [
      {
       "value": "Automatic",
       "sources": [
        "Hatla2ee"
       ]
      }
     ]
    },
    "engine_capacity": {
     "status": "SINGLE_VALUE",
     "values": [
      {
       "value": "1500",
       "sources": [
        "Hatla2ee"
       ]
      }
     ]
    },
    "horsepower": null,
    "drive_type": null,
    "fuel_type_raw": null,
    "warranty": {
     "status": "SINGLE_VALUE",
     "values": [
      {
       "value": "1,000,000 Km / 8 Years",
       "sources": [
        "Hatla2ee"
       ]
      }
     ]
    },
    "length": null,
    "trunk_capacity": null,
    "fuel_consumption": null,
    "electric_range": null,
    "battery_capacity": null
   },
   "warranty_years_max": 8,
   "registration": {
    "count": 553,
    "rank": 21,
    "of": 21,
    "share": 0.0136,
    "yoy": null,
    "first_seen": "2025-10",
    "mix": {
     "Hybrid": 553
    },
    "last12": [
     [
      "2025-10",
      1
     ],
     [
      "2025-11",
      74
     ],
     [
      "2025-12",
      66
     ],
     [
      "2026-01",
      57
     ],
     [
      "2026-02",
      26
     ],
     [
      "2026-03",
      91
     ],
     [
      "2026-04",
      78
     ],
     [
      "2026-05",
      62
     ],
     [
      "2026-07",
      53
     ],
     [
      "2026-08",
      45
     ]
    ],
    "window": {
     "start": "2025-09",
     "end": "2026-08",
     "months_present": [
      "2025-09",
      "2025-10",
      "2025-11",
      "2025-12",
      "2026-01",
      "2026-02",
      "2026-03",
      "2026-04",
      "2026-05",
      "2026-07",
      "2026-08"
     ],
     "months_missing": [
      "2026-06"
     ]
    },
    "unit": "first registrations (licences), passenger vehicles; not sales",
    "alias_pending_review": false
   },
   "freshness": {
    "price_snapshots": [
     {
      "id": "S0_2026-09-10",
      "observed_at": "2026-09-10",
      "model_observed": true
     },
     {
      "id": "S1_2026-09-25",
      "observed_at": "2026-09-25",
      "model_observed": true
     }
    ],
    "source_stated_price_dates": [],
    "spec_snapshot": "2026-09-10",
    "registration_data_through": "2026-08"
   },
   "conflicts": [],
   "gaps": [
    "SINGLE_SOURCE_MODEL"
   ],
   "review_open": []
  }
 ]
};
