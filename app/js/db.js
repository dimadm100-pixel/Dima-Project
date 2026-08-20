import { SEED_DATA } from "./seed.js";
import { addDays, todayStr } from "./utils.js";

const STORAGE_KEY = "pft_data_v1";

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function uid(prefix = "id") {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

class Store {
  constructor() {
    this.data = this._load();
    this._listeners = new Set();
  }

  _load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {
      console.error("Failed to load stored data, falling back to seed.", e);
    }
    return clone(SEED_DATA);
  }

  save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    this._listeners.forEach((fn) => fn());
  }

  onChange(fn) {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }

  // ---------- Transactions (actual ledger = Cash Position) ----------
  addActual(tx) {
    this.data.actuals.push({
      id: uid("tx"),
      date: tx.date,
      amount: Number(tx.amount),
      category: tx.category || "other",
      note: tx.note || "",
      accountId: tx.accountId || "",
      createdAt: new Date().toISOString()
    });
    this.data.actuals.sort((a, b) => a.date.localeCompare(b.date));
    this.save();
  }

  updateActual(id, patch) {
    const t = this.data.actuals.find((x) => x.id === id);
    if (!t) return;
    Object.assign(t, patch);
    if (patch.amount !== undefined) t.amount = Number(patch.amount);
    this.data.actuals.sort((a, b) => a.date.localeCompare(b.date));
    this.save();
  }

  deleteActual(id) {
    this.data.actuals = this.data.actuals.filter((x) => x.id !== id);
    this.save();
  }

  // ---------- Budget (planned ledger = Cash Flow) ----------
  addBudgetItem(item) {
    this.data.budget.push({
      id: uid("bud"),
      date: item.date,
      amount: Number(item.amount),
      category: item.category || "other",
      note: item.note || ""
    });
    this.data.budget.sort((a, b) => a.date.localeCompare(b.date));
    this.save();
  }

  updateBudgetItem(id, patch) {
    const t = this.data.budget.find((x) => x.id === id);
    if (!t) return;
    Object.assign(t, patch);
    if (patch.amount !== undefined) t.amount = Number(patch.amount);
    this.data.budget.sort((a, b) => a.date.localeCompare(b.date));
    this.save();
  }

  deleteBudgetItem(id) {
    this.data.budget = this.data.budget.filter((x) => x.id !== id);
    this.save();
  }

  // ---------- Accounts ----------
  updateAccount(id, patch) {
    const a = this.data.accounts.find((x) => x.id === id);
    if (!a) return;
    Object.assign(a, patch);
    if (patch.balance !== undefined) a.balance = Number(patch.balance);
    this.save();
  }

  addAccount(acc) {
    this.data.accounts.push({ id: uid("acc"), name: acc.name, number: acc.number || "", balance: Number(acc.balance) || 0 });
    this.save();
  }

  deleteAccount(id) {
    this.data.accounts = this.data.accounts.filter((x) => x.id !== id);
    this.save();
  }

  // ---------- Goals ----------
  updateGoalField(goalKey, patch) {
    Object.assign(this.data.goals[goalKey], patch);
    this.save();
  }

  addMarriageRow(row) {
    this.data.goals.marriage.rows.push({ id: uid("mrow"), type: row.type, element: row.element, units: Number(row.units) || 1, costUZS: Number(row.costUZS) || 0, costUSD: Number(row.costUSD) || 0 });
    this.save();
  }
  updateMarriageRow(id, patch) {
    const r = this.data.goals.marriage.rows.find((x) => x.id === id);
    if (!r) return;
    Object.assign(r, patch);
    this.save();
  }
  deleteMarriageRow(id) {
    this.data.goals.marriage.rows = this.data.goals.marriage.rows.filter((x) => x.id !== id);
    this.save();
  }

  updateHomeVariant(index, patch) {
    Object.assign(this.data.goals.home.variants[index], patch);
    this.save();
  }

  // ---------- Targets ----------
  addTargetCheckpoint(cp) {
    this.data.targets.checkpoints.push({ date: cp.date, target1: cp.target1 ?? null, target2: cp.target2 ?? null, target3: cp.target3 ?? null, target4: cp.target4 ?? null });
    this.data.targets.checkpoints.sort((a, b) => a.date.localeCompare(b.date));
    this.save();
  }

  updateTargetDef(name, patch) {
    const d = this.data.targets.defs.find((x) => x.name === name);
    if (!d) return;
    Object.assign(d, patch);
    this.save();
  }

  // ---------- Specifications (freeform breakdown lists) ----------
  addSpecification(spec) {
    this.data.specifications.push({
      id: uid("spec"),
      date: spec.date,
      title: spec.title,
      kind: spec.kind || "expense",
      items: spec.items || []
    });
    this.save();
  }

  updateSpecification(id, patch) {
    const s = this.data.specifications.find((x) => x.id === id);
    if (!s) return;
    Object.assign(s, patch);
    this.save();
  }

  deleteSpecification(id) {
    this.data.specifications = this.data.specifications.filter((x) => x.id !== id);
    this.save();
  }

  // ---------- Credit rating ----------
  addCreditEntry(entry) {
    this.data.creditRating.push({ id: uid("cr"), date: entry.date, score: Number(entry.score), bureau: entry.bureau || "", notes: entry.notes || "" });
    this.data.creditRating.sort((a, b) => a.date.localeCompare(b.date));
    this.save();
  }

  deleteCreditEntry(id) {
    this.data.creditRating = this.data.creditRating.filter((x) => x.id !== id);
    this.save();
  }

  // ---------- Balance sheet extras ----------
  updateBalanceSheetExtra(patch) {
    Object.assign(this.data.balanceSheetExtra, patch);
    this.save();
  }

  addOtherAsset(a) {
    this.data.balanceSheetExtra.otherAssets.push({ id: uid("asset"), name: a.name, value: Number(a.value) || 0 });
    this.save();
  }
  deleteOtherAsset(id) {
    this.data.balanceSheetExtra.otherAssets = this.data.balanceSheetExtra.otherAssets.filter((x) => x.id !== id);
    this.save();
  }
  addLiability(l) {
    this.data.balanceSheetExtra.liabilities.push({ id: uid("liab"), name: l.name, value: Number(l.value) || 0 });
    this.save();
  }
  deleteLiability(id) {
    this.data.balanceSheetExtra.liabilities = this.data.balanceSheetExtra.liabilities.filter((x) => x.id !== id);
    this.save();
  }

  // ---------- Meta ----------
  setOpeningBalance(amount, date) {
    this.data.meta.openingBalance = Number(amount);
    if (date) this.data.meta.openingDate = date;
    this.save();
  }

  // ---------- Import / export ----------
  exportJSON() {
    return JSON.stringify(this.data, null, 2);
  }

  importJSON(json) {
    const parsed = JSON.parse(json);
    this.data = parsed;
    this.save();
  }

  resetToSeed() {
    this.data = clone(SEED_DATA);
    this.save();
  }

  // ================= Derived / computed values =================

  // Running actual cash balance as of a given date (inclusive), starting from openingBalance.
  actualBalanceAsOf(dateStr) {
    const opening = this.data.meta.openingBalance;
    const sum = this.data.actuals
      .filter((t) => t.date <= dateStr)
      .reduce((s, t) => s + t.amount, 0);
    return opening + sum;
  }

  currentBalance() {
    const today = todayStr();
    return this.actualBalanceAsOf(today > this.data.meta.openingDate ? today : this.data.meta.openingDate);
  }

  // Full running ledger for the Cash Position page: opening balance row + each actual, with running total.
  cashPositionLedger() {
    const opening = this.data.meta.openingBalance;
    let running = opening;
    const rows = [
      { date: this.data.meta.openingDate, type: "opening", label: "Opening balance", amount: null, balance: opening }
    ];
    const sorted = [...this.data.actuals].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));
    for (const t of sorted) {
      running += t.amount;
      rows.push({ id: t.id, date: t.date, type: t.amount >= 0 ? "income" : "expense", label: t.category, note: t.note, amount: t.amount, balance: running, accountId: t.accountId });
    }
    return rows;
  }

  accountsTotal() {
    return this.data.accounts.reduce((s, a) => s + a.balance, 0);
  }

  // Budget vs actual for a given month "YYYY-MM"
  monthComparison(monthKey) {
    const budgetItems = this.data.budget.filter((b) => b.date.startsWith(monthKey));
    const actualItems = this.data.actuals.filter((a) => a.date.startsWith(monthKey));
    const byCategory = {};
    for (const b of budgetItems) {
      const c = b.category;
      byCategory[c] = byCategory[c] || { category: c, planned: 0, actual: 0 };
      byCategory[c].planned += b.amount;
    }
    for (const a of actualItems) {
      const c = a.category;
      byCategory[c] = byCategory[c] || { category: c, planned: 0, actual: 0 };
      byCategory[c].actual += a.amount;
    }
    const rows = Object.values(byCategory).sort((a, b) => a.category.localeCompare(b.category));
    const plannedTotal = budgetItems.reduce((s, b) => s + b.amount, 0);
    const actualTotal = actualItems.reduce((s, a) => s + a.amount, 0);
    return { rows, plannedTotal, actualTotal };
  }

  // Expense categories tracking over their monthly budget pace, for the current month.
  budgetAlerts() {
    const today = todayStr();
    const monthKey = today.slice(0, 7);
    const [y, m] = monthKey.split("-").map(Number);
    const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const dayOfMonth = Number(today.slice(8, 10));
    const pacePct = dayOfMonth / daysInMonth;

    const { rows } = this.monthComparison(monthKey);
    const alerts = [];
    for (const r of rows) {
      if (r.planned >= 0) continue; // only budgeted expenses
      const planned = Math.abs(r.planned);
      const actual = Math.abs(Math.min(r.actual, 0));
      if (planned === 0) continue;
      const expectedByNow = planned * pacePct;
      const overBy = actual - expectedByNow;
      if (actual > planned) {
        alerts.push({ category: r.category, planned, actual, overBy: actual - planned, severity: "over" });
      } else if (overBy > planned * 0.1) {
        alerts.push({ category: r.category, planned, actual, overBy, severity: "pace" });
      }
    }
    alerts.sort((a, b) => (b.severity === "over") - (a.severity === "over") || b.overBy - a.overBy);
    return alerts;
  }

  // Categories ranked by how often they're used, split by income/expense, for autocomplete.
  categoryFrequency(kind) {
    const counts = {};
    const consider = (list) => {
      for (const t of list) {
        const isIncome = t.amount >= 0;
        if ((kind === "income") !== isIncome) continue;
        counts[t.category] = (counts[t.category] || 0) + 1;
      }
    };
    consider(this.data.actuals);
    consider(this.data.budget);
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([cat]) => cat);
  }

  // Projected balance trajectory combining actuals up to today, budget after.
  projectedTrajectory(toDate) {
    const points = [];
    let running = this.data.meta.openingBalance;
    const today = todayStr();
    const start = this.data.meta.openingDate;
    const actualsByDate = groupSum(this.data.actuals, today);
    const budgetByDate = groupSum(this.data.budget, null);
    let ds = start;
    let guard = 0;
    while (ds <= toDate && guard < 5000) {
      const delta = ds <= today ? (actualsByDate[ds] || 0) : (budgetByDate[ds] || 0);
      if (ds !== start) running += delta;
      points.push({ date: ds, balance: running });
      ds = addDays(ds, 1);
      guard++;
    }
    return points;
  }

  // Pure budget-only cumulative balance: "if everything goes exactly as planned",
  // ignoring actuals entirely. Used to spot a future cash hole in the budget itself.
  budgetTrajectory() {
    const start = this.data.meta.openingDate;
    const lastBudgetDate = this.data.budget.reduce((max, b) => (b.date > max ? b.date : max), start);
    const budgetByDate = groupSum(this.data.budget, null);
    const points = [];
    let running = this.data.meta.openingBalance;
    let ds = start;
    let guard = 0;
    while (ds <= lastBudgetDate && guard < 5000) {
      if (ds !== start) running += budgetByDate[ds] || 0;
      points.push({ date: ds, balance: running });
      ds = addDays(ds, 1);
      guard++;
    }
    return points;
  }

  // Pure actual-only cumulative balance up to today, ignoring budget entirely.
  actualTrajectory() {
    const start = this.data.meta.openingDate;
    const today = todayStr();
    const end = today > start ? today : start;
    const actualsByDate = groupSum(this.data.actuals, null);
    const points = [];
    let running = this.data.meta.openingBalance;
    let ds = start;
    let guard = 0;
    while (ds <= end && guard < 5000) {
      if (ds !== start) running += actualsByDate[ds] || 0;
      points.push({ date: ds, balance: running });
      ds = addDays(ds, 1);
      guard++;
    }
    return points;
  }

  // Finds every stretch in the pure budget trajectory where the balance goes negative --
  // a "cash hole": a point in the plan where you'd run out of money if nothing changes.
  cashHoles() {
    const trajectory = this.budgetTrajectory();
    const holes = [];
    let current = null;
    for (const p of trajectory) {
      if (p.balance < 0) {
        if (!current) {
          current = { start: p.date, end: p.date, lowest: p.balance, lowestDate: p.date };
        } else {
          current.end = p.date;
          if (p.balance < current.lowest) {
            current.lowest = p.balance;
            current.lowestDate = p.date;
          }
        }
      } else if (current) {
        holes.push(current);
        current = null;
      }
    }
    if (current) holes.push(current);
    return holes;
  }


  pnlForMonth(monthKey) {
    const items = this.data.actuals.filter((a) => a.date.startsWith(monthKey));
    const income = {};
    const expense = {};
    let incomeTotal = 0, expenseTotal = 0;
    for (const t of items) {
      if (t.amount >= 0) {
        income[t.category] = (income[t.category] || 0) + t.amount;
        incomeTotal += t.amount;
      } else {
        expense[t.category] = (expense[t.category] || 0) + Math.abs(t.amount);
        expenseTotal += Math.abs(t.amount);
      }
    }
    return { income, expense, incomeTotal, expenseTotal, net: incomeTotal - expenseTotal };
  }

  monthsWithActivity() {
    const set = new Set(this.data.actuals.map((a) => a.date.slice(0, 7)));
    set.add(todayStr().slice(0, 7));
    return [...set].sort();
  }

  // Balance sheet as of now, fully derived (fixes the broken linkage in the original file).
  balanceSheet() {
    const cash = this.currentBalance();
    const investments = this.data.balanceSheetExtra.investments;
    const otherAssets = this.data.balanceSheetExtra.otherAssets.reduce((s, a) => s + a.value, 0);
    const totalAssets = cash + investments + otherAssets;
    const totalLiabilities = this.data.balanceSheetExtra.liabilities.reduce((s, l) => s + l.value, 0);
    const equity = totalAssets - totalLiabilities;
    return { cash, investments, otherAssets, totalAssets, totalLiabilities, equity };
  }

  allCategories() {
    const set = new Set();
    this.data.actuals.forEach((t) => set.add(t.category));
    this.data.budget.forEach((t) => set.add(t.category));
    return [...set].sort();
  }
}

function groupSum(list, cutoffExclusiveAfter) {
  const map = {};
  for (const t of list) {
    if (cutoffExclusiveAfter && t.date > cutoffExclusiveAfter) continue;
    map[t.date] = (map[t.date] || 0) + t.amount;
  }
  return map;
}

export const db = new Store();
export { uid };
