// Seed data extracted from the user's original "Personal Finance" workbook.
// This only pre-populates the BUDGET (planned) and reference/goal sheets.
// The actual day-to-day ledger (Cash Position) starts clean at the stated
// opening balance so live tracking begins from today, not from old plans.
export const SEED_DATA = {
  meta: {
    version: 1,
    openingBalance: 200000,
    openingDate: "2026-08-19",
    currency: "UZS"
  },

  // Actual, real transactions the user logs day to day. Starts empty.
  actuals: [],

  // The forward budget/plan, carried over from the original "cash flow" sheet.
  budget: [
    {"date":"2026-08-19","amount":-50000,"category":"food"},
    {"date":"2026-08-20","amount":1000000,"category":"extra"},
    {"date":"2026-08-21","amount":-50000,"category":"food"},
    {"date":"2026-08-22","amount":-50000,"category":"food"},
    {"date":"2026-08-23","amount":1900000,"category":"salary"},
    {"date":"2026-08-24","amount":-880000,"category":"debt"},
    {"date":"2026-08-24","amount":-550000,"category":"debt"},
    {"date":"2026-08-25","amount":-50000,"category":"food"},
    {"date":"2026-08-26","amount":-210000,"category":"debt"},
    {"date":"2026-08-27","amount":-350000,"category":"gift"},
    {"date":"2026-08-28","amount":-50000,"category":"food"},
    {"date":"2026-08-30","amount":-200000,"category":"trip to home"},
    {"date":"2026-09-01","amount":5800000,"category":"salary"},
    {"date":"2026-09-03","amount":-100000,"category":"food"},
    {"date":"2026-09-04","amount":-2500000,"category":"to parents"},
    {"date":"2026-09-05","amount":-100000,"category":"food"},
    {"date":"2026-09-06","amount":-100000,"category":"food"},
    {"date":"2026-09-07","amount":-300000,"category":"phone2"},
    {"date":"2026-09-08","amount":-100000,"category":"food"},
    {"date":"2026-09-09","amount":-105000,"category":"debt"},
    {"date":"2026-09-10","amount":-220000,"category":"debt"},
    {"date":"2026-09-11","amount":-100000,"category":"food"},
    {"date":"2026-09-12","amount":-105000,"category":"debt"},
    {"date":"2026-09-13","amount":-315000,"category":"debt"},
    {"date":"2026-09-14","amount":-100000,"category":"food"},
    {"date":"2026-09-15","amount":400000,"category":"extra"},
    {"date":"2026-09-16","amount":6000000,"category":"salary"},
    {"date":"2026-09-17","amount":-200000,"category":"food"},
    {"date":"2026-09-18","amount":-1250000,"category":"rent"},
    {"date":"2026-09-19","amount":-3000000,"category":"to parents"},
    {"date":"2026-09-20","amount":-1075000,"category":"debt"},
    {"date":"2026-09-21","amount":-100000,"category":"food"},
    {"date":"2026-09-23","amount":-100000,"category":"food"},
    {"date":"2026-09-26","amount":-100000,"category":"food"},
    {"date":"2026-09-28","amount":-50000,"category":"food"},
    {"date":"2026-09-29","amount":-100000,"category":"food"},
    {"date":"2026-10-01","amount":6000000,"category":"salary"},
    {"date":"2026-10-03","amount":-100000,"category":"food"},
    {"date":"2026-10-04","amount":-3500000,"category":"to parents"},
    {"date":"2026-10-05","amount":-100000,"category":"food"},
    {"date":"2026-10-06","amount":-50000,"category":"food"},
    {"date":"2026-10-07","amount":-300000,"category":"phone2"},
    {"date":"2026-10-08","amount":-100000,"category":"food"},
    {"date":"2026-10-11","amount":-100000,"category":"food"},
    {"date":"2026-10-12","amount":-450000,"category":"1fit"},
    {"date":"2026-10-14","amount":-100000,"category":"food"},
    {"date":"2026-10-16","amount":6000000,"category":"salary"},
    {"date":"2026-10-17","amount":-200000,"category":"food"},
    {"date":"2026-10-18","amount":-1250000,"category":"rent"},
    {"date":"2026-10-19","amount":-3000000,"category":"to parents"},
    {"date":"2026-10-21","amount":-100000,"category":"food"},
    {"date":"2026-10-23","amount":-100000,"category":"food"},
    {"date":"2026-10-26","amount":-100000,"category":"food"},
    {"date":"2026-10-28","amount":-100000,"category":"food"},
    {"date":"2026-10-29","amount":-50000,"category":"food"},
    {"date":"2026-11-01","amount":6000000,"category":"salary"},
    {"date":"2026-11-03","amount":-100000,"category":"food"},
    {"date":"2026-11-04","amount":-3500000,"category":"to parents"},
    {"date":"2026-11-05","amount":-100000,"category":"food"},
    {"date":"2026-11-06","amount":-100000,"category":"food"},
    {"date":"2026-11-07","amount":-300000,"category":"phone2"},
    {"date":"2026-11-08","amount":-100000,"category":"food"},
    {"date":"2026-11-11","amount":-100000,"category":"food"},
    {"date":"2026-11-12","amount":-450000,"category":"1fit"},
    {"date":"2026-11-14","amount":-100000,"category":"food"},
    {"date":"2026-11-16","amount":6000000,"category":"salary"},
    {"date":"2026-11-17","amount":-200000,"category":"food"},
    {"date":"2026-11-18","amount":-1250000,"category":"rent"},
    {"date":"2026-11-19","amount":-3000000,"category":"to parents"},
    {"date":"2026-11-21","amount":-100000,"category":"food"},
    {"date":"2026-11-23","amount":-100000,"category":"food"},
    {"date":"2026-11-26","amount":-100000,"category":"food"},
    {"date":"2026-11-28","amount":-200000,"category":"food"},
    {"date":"2026-11-29","amount":-100000,"category":"food"},
    {"date":"2026-12-01","amount":6000000,"category":"salary"},
    {"date":"2026-12-03","amount":-100000,"category":"food"},
    {"date":"2026-12-04","amount":-3500000,"category":"to parents"},
    {"date":"2026-12-05","amount":-100000,"category":"food"},
    {"date":"2026-12-06","amount":-200000,"category":"food"},
    {"date":"2026-12-07","amount":-1500000,"category":"to parents"},
    {"date":"2026-12-08","amount":-100000,"category":"food"},
    {"date":"2026-12-10","amount":-300000,"category":"phone2"},
    {"date":"2026-12-11","amount":-100000,"category":"food"},
    {"date":"2026-12-12","amount":-450000,"category":"1fit"},
    {"date":"2026-12-14","amount":-100000,"category":"food"},
    {"date":"2026-12-16","amount":6000000,"category":"salary"},
    {"date":"2026-12-17","amount":-200000,"category":"food"},
    {"date":"2026-12-18","amount":-1250000,"category":"rent"},
    {"date":"2026-12-19","amount":-3000000,"category":"to parents"},
    {"date":"2026-12-21","amount":-100000,"category":"food"},
    {"date":"2026-12-23","amount":-100000,"category":"food"},
    {"date":"2026-12-26","amount":-100000,"category":"food"},
    {"date":"2026-12-28","amount":-200000,"category":"food"},
    {"date":"2026-12-29","amount":-100000,"category":"food"},
    {"date":"2026-12-30","amount":6000000,"category":"salary"},
    {"date":"2026-12-31","amount":-3500000,"category":"to parents"}
  ],

  // Manually-reconciled snapshot of where money physically sits.
  // Not auto-linked to the ledger -- update it occasionally, like the original sheet.
  accounts: [
    {"id":"acc-card1","name":"Card 1","number":"8408","balance":0},
    {"id":"acc-card2","name":"Card 2","number":"5204","balance":30000},
    {"id":"acc-card3","name":"Card 3","number":"1231","balance":0},
    {"id":"acc-card4","name":"Card 4*","number":"0602","balance":0},
    {"id":"acc-card5","name":"Card 5","number":"9651","balance":0},
    {"id":"acc-card6","name":"Card 6","number":"6857","balance":0},
    {"id":"acc-card7","name":"Card 7","number":"5868","balance":70000},
    {"id":"acc-cash","name":"Cash","number":"","balance":100000},
    {"id":"acc-invest","name":"Investment","number":"","balance":0}
  ],

  goals: {
    marriage: {
      fxRate: 12500,
      rows: [
        {"id":"mrow-1","type":"Expense","element":"Monthly rent","units":1,"costUZS":6250000,"costUSD":500},
        {"id":"mrow-2","type":"Expense","element":"Monthly food, beverages","units":1,"costUZS":3000000,"costUSD":240},
        {"id":"mrow-3","type":"Clothes","element":"Monthly average shopping","units":1.25,"costUZS":1000000,"costUSD":80},
        {"id":"mrow-4","type":"Entertainment","element":"Monthly entertainment","units":1,"costUZS":500000,"costUSD":40},
        {"id":"mrow-5","type":"Travel","element":"Visiting hometown","units":1,"costUZS":800000,"costUSD":64},
        {"id":"mrow-6","type":"Study","element":"Payments for master's","units":1,"costUZS":2018750,"costUSD":161.5},
        {"id":"mrow-7","type":"Parents","element":"Payments to parents monthly","units":1,"costUZS":2000000,"costUSD":160}
      ],
      reserveAnnualUSD: 5000,
      savedSoFar: 0
    },
    home: {
      // pricePerSqmMlnUZS: price per square meter, in million UZS (matches how the original sheet priced it)
      variants: [
        {"name":"Variant 1, Eco-residence","sqm":60,"pricePerSqmMlnUZS":12.5,"initialPct":0.2,"markupPct":0.4,"months":120},
        {"name":"Variant 2, G'urur (Assalam Estate)","sqm":55,"pricePerSqmMlnUZS":14,"initialPct":0.2,"markupPct":0.4,"months":120}
      ],
      savedSoFar: 0
    },
    umrah: {
      amountUSD: 1590,
      people: 2,
      bufferUSD: 300,
      fxRate: 12000,
      savedSoFar: 0
    }
  },

  targets: {
    defs: [
      {"name":"Target1","due":"2026-03-01"},
      {"name":"Target2","due":"2026-06-01"},
      {"name":"Target3","due":"2026-08-01"},
      {"name":"Target4","due":"2026-12-01"}
    ],
    checkpoints: [
      {"date":"2026-01-12","target1":8600000,"target2":7950000,"target3":11100000,"target4":18050000},
      {"date":"2026-02-02","target1":7295000,"target2":5370000,"target3":8520000,"target4":15470000},
      {"date":"2026-02-26","target1":6590000,"target2":8165000,"target3":12815000,"target4":20765000},
      {"date":"2026-03-02","target1":9370000,"target2":3495000,"target3":7445000,"target4":13995000}
    ]
  },

  specifications: [],
  creditRating: [],

  balanceSheetExtra: {
    investments: 0,
    otherAssets: [],
    liabilities: []
  }
};
