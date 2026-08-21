// Deterministic financial planning. No API key, no network, no cost.
//
// Everything the AI assistant does for the tasks that actually matter --
// generating a budget, finding where money leaks, working out when a goal
// lands -- is arithmetic over the user's own data. This module does that
// arithmetic exactly, so those features work for free and offline.

import { db } from "./db.js";
import { todayStr, addMonths } from "./utils.js";
import { effectiveRate } from "./fx.js";

const MIN_MEANINGFUL_SAVING = 50000; // UZS/month — below this, not worth flagging

// ---------------------------------------------------------------- budgeting

/**
 * Builds a month-by-month budget from real behaviour.
 *
 * Sources, in priority order:
 *   1. Active recurring items — explicit user intent, always honoured.
 *   2. Historical actuals — median monthly total per category.
 *   3. Existing budget — only if there are no actuals to learn from.
 *
 * Categories that occur often (like food) are spread across the month so the
 * projected cash curve stays realistic; occasional ones (rent, salary) land
 * on the day of month they usually land on.
 */
export function buildBudgetPlan({ startMonth, monthCount = 12, replaceExisting = false, overrides = null } = {}) {
  const months = [];
  let mk = startMonth || addMonths(todayStr().slice(0, 7), 1);
  for (let i = 0; i < monthCount; i++) { months.push(mk); mk = addMonths(mk, 1); }

  // Learned patterns are only a starting point -- the user can retune any
  // amount or drop a category entirely before anything is generated.
  let patterns = categoryPatterns();
  if (overrides) {
    patterns = patterns
      .map((p) => {
        const o = overrides[p.category];
        if (!o) return p;
        if (o.enabled === false) return null;
        return {
          ...p,
          monthlyTotal: o.monthlyTotal !== undefined ? Number(o.monthlyTotal) : p.monthlyTotal,
          typicalDay: o.typicalDay !== undefined ? Math.min(28, Math.max(1, Number(o.typicalDay))) : p.typicalDay
        };
      })
      .filter(Boolean);
  }
  const recurringCats = new Set(db.data.recurring.filter((r) => r.active).map((r) => r.category));
  const operations = [];

  if (replaceExisting) {
    for (const b of db.data.budget) {
      if (months.includes(b.date.slice(0, 7))) {
        operations.push({ action: "delete_budget", id: b.id });
      }
    }
  }

  for (const month of months) {
    // Recurring items first — they're the user's stated intent.
    for (const r of db.data.recurring) {
      if (!r.active) continue;
      operations.push({
        action: "add_budget",
        date: `${month}-${String(r.dayOfMonth).padStart(2, "0")}`,
        amount: r.amount,
        category: r.category,
        note: `recurring: ${r.name}`
      });
    }

    // Then learned patterns for everything not already covered.
    for (const p of patterns) {
      if (recurringCats.has(p.category)) continue;
      for (const entry of spreadEntries(p, month)) operations.push(entry);
    }
  }

  return {
    months,
    operations,
    patterns,
    skippedExisting: !replaceExisting && db.data.budget.some((b) => months.includes(b.date.slice(0, 7)))
  };
}

// Splits a category's monthly total into either one dated entry or a few
// spread through the month, depending on how the user actually spends it.
function spreadEntries(pattern, month) {
  const { category, monthlyTotal, typicalDay, perMonthCount } = pattern;
  if (!monthlyTotal) return [];

  if (perMonthCount > 3) {
    // Frequent, diffuse spending (food, transport): four weekly chunks.
    const chunk = Math.round(monthlyTotal / 4);
    return [7, 14, 21, 28].map((day) => ({
      action: "add_budget",
      date: `${month}-${String(day).padStart(2, "0")}`,
      amount: chunk,
      category,
      note: "planned"
    }));
  }

  return [{
    action: "add_budget",
    date: `${month}-${String(typicalDay).padStart(2, "0")}`,
    amount: Math.round(monthlyTotal),
    category,
    note: "planned"
  }];
}

/**
 * Per-category monthly behaviour learned from history.
 * Uses the median month rather than the mean so one unusual month
 * doesn't drag the whole plan off.
 */
export function categoryPatterns() {
  const source = db.data.actuals.length >= 5 ? db.data.actuals : db.data.budget;
  if (!source.length) return [];

  const byCategory = {};
  for (const t of source) {
    const month = t.date.slice(0, 7);
    const c = (byCategory[t.category] = byCategory[t.category] || { category: t.category, months: {}, days: [], count: 0 });
    c.months[month] = (c.months[month] || 0) + t.amount;
    c.days.push(Number(t.date.slice(8, 10)));
    c.count++;
  }

  const monthSpan = new Set(source.map((t) => t.date.slice(0, 7))).size || 1;

  return Object.values(byCategory).map((c) => {
    const totals = Object.values(c.months);
    return {
      category: c.category,
      monthlyTotal: median(totals),
      typicalDay: Math.min(28, mode(c.days) || 15),
      perMonthCount: c.count / monthSpan,
      monthsSeen: totals.length,
      isIncome: median(totals) > 0
    };
  }).filter((p) => p.monthlyTotal !== 0)
    .sort((a, b) => Math.abs(b.monthlyTotal) - Math.abs(a.monthlyTotal));
}

// ------------------------------------------------------------------- leaks

/**
 * Ranks expense categories by how much could realistically be freed up.
 *
 * The trim target isn't invented: it's the user's own better months. If they
 * already hit a lower number some months, that number is provably achievable,
 * so the gap between their typical month and their good month is the honest
 * opportunity.
 */
export function findLeaks() {
  const monthlyByCategory = {};
  for (const t of db.data.actuals) {
    if (t.amount >= 0) continue;
    const month = t.date.slice(0, 7);
    const c = (monthlyByCategory[t.category] = monthlyByCategory[t.category] || {});
    c[month] = (c[month] || 0) + Math.abs(t.amount);
  }

  const totalSpend = Object.values(monthlyByCategory)
    .flatMap((m) => Object.values(m))
    .reduce((s, v) => s + v, 0);

  const leaks = [];
  for (const [category, months] of Object.entries(monthlyByCategory)) {
    const totals = Object.values(months);
    if (totals.length < 2) continue;

    const typical = median(totals);
    const good = percentile(totals, 0.25);
    const saving = typical - good;
    if (saving < MIN_MEANINGFUL_SAVING) continue;

    const keys = Object.keys(months).sort();
    const first = months[keys[0]];
    const last = months[keys[keys.length - 1]];
    const trend = first > 0 ? (last - first) / first : 0;

    leaks.push({
      category,
      typicalMonth: typical,
      goodMonth: good,
      monthlySaving: saving,
      annualSaving: saving * 12,
      shareOfSpend: totalSpend > 0 ? (typical / (totalSpend / new Set(Object.keys(months)).size)) : 0,
      trend,
      monthsObserved: totals.length
    });
  }

  return leaks.sort((a, b) => b.monthlySaving - a.monthlySaving);
}

// ------------------------------------------------------------------- goals

export function goalStatus(monthlyCutTotal = 0) {
  const surplus = averageMonthlySurplus() + monthlyCutTotal;
  const goals = [
    { key: "marriage", label: "Marriage", target: db.data.goals.marriage.reserveAnnualUSD * effectiveRate(db.data.goals.marriage.fxRate), saved: db.data.goals.marriage.savedSoFar },
    { key: "home", label: "Home deposit", target: cheapestHomeInitial(), saved: db.data.goals.home.savedSoFar },
    { key: "umrah", label: "Umrah", target: umrahTotal(), saved: db.data.goals.umrah.savedSoFar }
  ];

  return goals.map((g) => {
    const remaining = Math.max(0, g.target - g.saved);
    const months = surplus > 0 ? Math.ceil(remaining / surplus) : null;
    return {
      ...g,
      remaining,
      surplus,
      months,
      eta: months === null ? null : addMonths(todayStr().slice(0, 7), months),
      done: remaining <= 0
    };
  });
}

// What monthly amount is needed to land a goal by a chosen month.
export function requiredMonthly(goalKey, targetMonth) {
  const g = goalStatus().find((x) => x.key === goalKey);
  if (!g) return null;
  const months = monthsBetween(todayStr().slice(0, 7), targetMonth);
  if (months <= 0) return null;
  return {
    ...g,
    targetMonth,
    monthsAvailable: months,
    requiredPerMonth: Math.ceil(g.remaining / months),
    gap: Math.max(0, Math.ceil(g.remaining / months) - g.surplus)
  };
}

export function averageMonthlySurplus() {
  const months = db.monthsWithActivity();
  const nets = months
    .map((m) => db.pnlForMonth(m))
    .filter((p) => p.incomeTotal > 0)
    .map((p) => p.net);
  if (nets.length) return nets.reduce((s, n) => s + n, 0) / nets.length;

  const budgetMonths = db.budgetMonths();
  if (!budgetMonths.length) return 0;
  return db.data.budget.reduce((s, b) => s + b.amount, 0) / budgetMonths.length;
}

// ------------------------------------------------------- recurring detection

// Entries repeating at the same amount across separate months are almost
// certainly bills; propose them so they stop being typed by hand.
export function detectRecurring() {
  const existing = new Set(db.data.recurring.map((r) => `${r.category}|${r.amount}`));
  const groups = {};
  for (const t of db.data.actuals) {
    const key = `${t.category}|${t.amount}`;
    (groups[key] = groups[key] || []).push(t);
  }

  const out = [];
  for (const [key, items] of Object.entries(groups)) {
    if (existing.has(key)) continue;
    const months = new Set(items.map((t) => t.date.slice(0, 7)));
    if (months.size < 3) continue;
    const [category] = key.split("|");
    out.push({
      category,
      amount: items[0].amount,
      dayOfMonth: Math.min(28, mode(items.map((t) => Number(t.date.slice(8, 10)))) || 1),
      monthsSeen: months.size
    });
  }
  return out.sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
}

// ------------------------------------------------------------------ helpers

function median(arr) {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function percentile(arr, p) {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const idx = Math.floor((s.length - 1) * p);
  return s[idx];
}

function mode(arr) {
  if (!arr.length) return null;
  const counts = {};
  let best = null, bestCount = 0;
  for (const v of arr) {
    counts[v] = (counts[v] || 0) + 1;
    if (counts[v] > bestCount) { bestCount = counts[v]; best = v; }
  }
  return best;
}

function monthsBetween(a, b) {
  const [ay, am] = a.split("-").map(Number);
  const [by, bm] = b.split("-").map(Number);
  return (by * 12 + bm) - (ay * 12 + am);
}

function cheapestHomeInitial() {
  return db.data.goals.home.variants.reduce((min, v) => {
    const initial = v.initialPct * v.pricePerSqmMlnUZS * v.sqm * 1_000_000;
    return Math.min(min, initial);
  }, Infinity);
}

function umrahTotal() {
  const u = db.data.goals.umrah;
  return (u.amountUSD * u.people + u.bufferUSD) * effectiveRate(u.fxRate);
}
