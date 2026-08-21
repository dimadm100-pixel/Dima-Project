// Deterministic financial analysis. No API key, no network, no cost.
// Everything here runs offline and is also what gets packaged up and handed
// to the AI as context, so the AI reasons over the same numbers you see.

import { db } from "./db.js";
import { todayStr, addDays, addMonths, fmtMonth } from "./utils.js";

const SEVERITY_ORDER = { high: 0, medium: 1, low: 2 };

export function analyze() {
  const findings = [];
  const today = todayStr();
  const thisMonth = today.slice(0, 7);

  findings.push(...overspendingFindings(thisMonth));
  findings.push(...cashHoleFindings());
  findings.push(...savingsRateFindings(thisMonth));
  findings.push(...categoryCreepFindings(thisMonth));
  findings.push(...unusualTransactionFindings(thisMonth));
  findings.push(...goalPaceFindings());
  findings.push(...recurringSuggestionFindings());
  findings.push(...staleLogFindings(today));

  findings.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
  return findings;
}

// ---------- individual analyses ----------

function overspendingFindings(monthKey) {
  return db.budgetAlerts().map((a) => ({
    id: `overspend-${a.category}`,
    kind: "overspending",
    severity: a.severity === "over" ? "high" : "medium",
    title: a.severity === "over" ? `${a.category} is over budget` : `${a.category} is running hot`,
    detail: a.severity === "over"
      ? `You've spent ${money(a.actual)} against a ${money(a.planned)} budget — ${money(a.overBy)} over with the month not done.`
      : `You've spent ${money(a.actual)} of ${money(a.planned)} already, which is ahead of where you'd expect at this point in the month.`,
    amount: a.overBy,
    category: a.category
  }));
}

function cashHoleFindings() {
  const holes = db.cashHoles();
  return holes.map((h, i) => ({
    id: `cashhole-${i}`,
    kind: "cash_hole",
    severity: "high",
    title: "Your budget runs out of money",
    detail: `Between ${h.start} and ${h.end} your projected balance goes negative, bottoming out at ${money(h.lowest)} on ${h.lowestDate}. Something needs to move before then.`,
    amount: h.lowest
  }));
}

function savingsRateFindings(monthKey) {
  const months = lastNMonths(monthKey, 3).filter((m) => {
    const p = db.pnlForMonth(m);
    return p.incomeTotal > 0 || p.expenseTotal > 0;
  });
  if (!months.length) return [];

  const rates = months.map((m) => {
    const p = db.pnlForMonth(m);
    return { month: m, rate: p.incomeTotal > 0 ? p.net / p.incomeTotal : null, ...p };
  }).filter((r) => r.rate !== null);
  if (!rates.length) return [];

  const latest = rates[rates.length - 1];
  const pct = Math.round(latest.rate * 100);
  let severity = "low";
  if (pct < 0) severity = "high";
  else if (pct < 10) severity = "medium";

  return [{
    id: "savings-rate",
    kind: "savings_rate",
    severity,
    title: `Savings rate: ${pct}% in ${fmtMonth(latest.month)}`,
    detail: pct < 0
      ? `You spent ${money(latest.expenseTotal - latest.incomeTotal)} more than you earned this month.`
      : `You kept ${money(latest.net)} of ${money(latest.incomeTotal)} earned.`,
    amount: latest.net,
    series: rates.map((r) => ({ month: r.month, rate: Math.round(r.rate * 100) }))
  }];
}

function categoryCreepFindings(monthKey) {
  const prev = addMonths(monthKey, -1);
  const cur = db.pnlForMonth(monthKey);
  const before = db.pnlForMonth(prev);
  const out = [];
  for (const [cat, amount] of Object.entries(cur.expense)) {
    const prior = before.expense[cat] || 0;
    if (prior === 0 || amount < 200000) continue;
    const growth = (amount - prior) / prior;
    if (growth > 0.35) {
      out.push({
        id: `creep-${cat}`,
        kind: "category_creep",
        severity: growth > 0.75 ? "medium" : "low",
        title: `${cat} is up ${Math.round(growth * 100)}% vs last month`,
        detail: `${money(prior)} in ${fmtMonth(prev)} → ${money(amount)} so far in ${fmtMonth(monthKey)}.`,
        amount: amount - prior,
        category: cat
      });
    }
  }
  return out;
}

function unusualTransactionFindings(monthKey) {
  const all = db.data.actuals.filter((t) => t.amount < 0);
  if (all.length < 8) return [];
  const byCat = {};
  for (const t of all) {
    (byCat[t.category] = byCat[t.category] || []).push(Math.abs(t.amount));
  }
  const out = [];
  for (const t of db.data.actuals) {
    if (t.amount >= 0 || !t.date.startsWith(monthKey)) continue;
    const peers = byCat[t.category];
    if (!peers || peers.length < 4) continue;
    const med = median(peers);
    const amt = Math.abs(t.amount);
    if (med > 0 && amt > med * 3) {
      out.push({
        id: `unusual-${t.id}`,
        kind: "unusual",
        severity: "low",
        title: `Unusually large ${t.category}: ${money(amt)}`,
        detail: `Your typical ${t.category} is around ${money(med)}. This one on ${t.date} was ${(amt / med).toFixed(1)}× that.`,
        amount: amt,
        category: t.category
      });
    }
  }
  return out.slice(0, 3);
}

function goalPaceFindings() {
  const out = [];
  const monthlyNet = averageMonthlyNet();
  const goals = [
    { key: "marriage", label: "Marriage", target: db.data.goals.marriage.reserveAnnualUSD * db.data.goals.marriage.fxRate, saved: db.data.goals.marriage.savedSoFar },
    { key: "home", label: "Home (initial payment)", target: cheapestHomeInitial(), saved: db.data.goals.home.savedSoFar },
    { key: "umrah", label: "Umrah", target: umrahTotal(), saved: db.data.goals.umrah.savedSoFar }
  ];
  for (const g of goals) {
    if (!g.target || g.target <= 0) continue;
    const remaining = g.target - g.saved;
    if (remaining <= 0) {
      out.push({
        id: `goal-${g.key}`,
        kind: "goal",
        severity: "low",
        title: `${g.label} is fully funded`,
        detail: `You've set aside ${money(g.saved)} against a ${money(g.target)} target.`,
        amount: g.saved
      });
      continue;
    }
    if (monthlyNet > 0) {
      const months = Math.ceil(remaining / monthlyNet);
      out.push({
        id: `goal-${g.key}`,
        kind: "goal",
        severity: months > 60 ? "medium" : "low",
        title: `${g.label}: ~${months} months at your current pace`,
        detail: `${money(remaining)} still needed. You're averaging about ${money(monthlyNet)}/month across your logged months, which lands this around ${fmtMonth(addMonths(todayStr().slice(0, 7), months))} if nothing changes.`,
        amount: remaining,
        goal: g.key
      });
    } else {
      out.push({
        id: `goal-${g.key}`,
        kind: "goal",
        severity: "medium",
        title: `${g.label} isn't moving`,
        detail: `${money(remaining)} still needed, but you aren't netting a surplus right now, so there's nothing to put toward it.`,
        amount: remaining,
        goal: g.key
      });
    }
  }
  return out;
}

// Spots repeating same-amount, same-category entries you type by hand every month.
function recurringSuggestionFindings() {
  const existing = new Set((db.data.recurring || []).map((r) => `${r.category}|${r.amount}`));
  const groups = {};
  for (const t of db.data.actuals) {
    const key = `${t.category}|${t.amount}`;
    (groups[key] = groups[key] || []).push(t);
  }
  const out = [];
  for (const [key, items] of Object.entries(groups)) {
    if (items.length < 3 || existing.has(key)) continue;
    const months = new Set(items.map((t) => t.date.slice(0, 7)));
    if (months.size < 3) continue;
    const [category] = key.split("|");
    out.push({
      id: `recurring-${key}`,
      kind: "recurring_suggestion",
      severity: "low",
      title: `Make "${category}" recurring?`,
      detail: `You've logged ${money(Math.abs(items[0].amount))} for ${category} in ${months.size} different months. Setting it up as recurring means you stop typing it.`,
      amount: items[0].amount,
      category,
      suggestedRecurring: { category, amount: items[0].amount, dayOfMonth: Number(items[items.length - 1].date.slice(8, 10)) }
    });
  }
  return out.slice(0, 3);
}

function staleLogFindings(today) {
  if (!db.data.actuals.length) return [];
  const last = db.data.actuals.reduce((max, t) => (t.date > max ? t.date : max), "");
  const gap = daysBetweenStr(last, today);
  if (gap < 3) return [];
  return [{
    id: "stale-log",
    kind: "stale",
    severity: gap > 7 ? "medium" : "low",
    title: `No entries for ${gap} days`,
    detail: `Your last logged transaction was ${last}. The numbers drift out of date fast when logging stops.`,
    amount: null
  }];
}

// ---------- context packaging for the AI ----------

// Compact, factual snapshot. Kept small on purpose: fewer tokens, less to get wrong.
export function buildAIContext() {
  const today = todayStr();
  const thisMonth = today.slice(0, 7);
  const months = lastNMonths(thisMonth, 6);

  const monthly = months.map((m) => {
    const p = db.pnlForMonth(m);
    return {
      month: m,
      income: p.incomeTotal,
      expenses: p.expenseTotal,
      net: p.net,
      byCategory: p.expense
    };
  }).filter((m) => m.income || m.expenses);

  const cmp = db.monthComparison(thisMonth);

  return {
    today,
    currency: db.data.meta.currency || "UZS",
    currentBalance: db.currentBalance(),
    openingBalance: db.data.meta.openingBalance,
    openingDate: db.data.meta.openingDate,
    monthlyHistory: monthly,
    thisMonthBudgetVsActual: cmp.rows,
    budgetHorizon: {
      months: db.budgetMonths(),
      cashHoles: db.cashHoles(),
      lowestProjected: db.budgetTrajectory().reduce((min, p) => (p.balance < min.balance ? p : min), { balance: Infinity, date: null })
    },
    accounts: db.accountsWithBalances().map((a) => ({ name: a.name, balance: a.balance })),
    unassignedTransactionCount: db.unassignedTransactions().length,
    goals: {
      marriage: { targetUZS: db.data.goals.marriage.reserveAnnualUSD * db.data.goals.marriage.fxRate, saved: db.data.goals.marriage.savedSoFar, monthlyLifestyleCost: db.data.goals.marriage.rows.reduce((s, r) => s + r.costUZS, 0) },
      home: { cheapestInitialUZS: cheapestHomeInitial(), saved: db.data.goals.home.savedSoFar },
      umrah: { totalUZS: umrahTotal(), saved: db.data.goals.umrah.savedSoFar }
    },
    recurring: db.data.recurring || [],
    findings: analyze().map((f) => ({ kind: f.kind, severity: f.severity, title: f.title, detail: f.detail }))
  };
}

// ---------- helpers ----------

function money(n) {
  const v = Math.round(Math.abs(Number(n) || 0));
  return `${v.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")} UZS`;
}

function median(arr) {
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function lastNMonths(monthKey, n) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) out.push(addMonths(monthKey, -i));
  return out;
}

function daysBetweenStr(a, b) {
  let d = a, n = 0;
  while (d < b && n < 400) { d = addDays(d, 1); n++; }
  return n;
}

function averageMonthlyNet() {
  const months = db.monthsWithActivity();
  const nets = months.map((m) => db.pnlForMonth(m)).filter((p) => p.incomeTotal > 0).map((p) => p.net);
  if (!nets.length) {
    // No actuals worth averaging yet — fall back to what the budget implies.
    const budgetMonths = db.budgetMonths();
    if (!budgetMonths.length) return 0;
    const total = db.data.budget.reduce((s, b) => s + b.amount, 0);
    return total / budgetMonths.length;
  }
  return nets.reduce((s, n) => s + n, 0) / nets.length;
}

function cheapestHomeInitial() {
  return db.data.goals.home.variants.reduce((min, v) => {
    const initial = v.initialPct * v.pricePerSqmMlnUZS * v.sqm * 1_000_000;
    return Math.min(min, initial);
  }, Infinity);
}

function umrahTotal() {
  const u = db.data.goals.umrah;
  return (u.amountUSD * u.people + u.bufferUSD) * u.fxRate;
}
