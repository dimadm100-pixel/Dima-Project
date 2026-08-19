import { db } from "../db.js";
import { fmtMoney, fmtMoneyShort, fmtDate, todayStr, addDays, svgSparkline, escapeHtml } from "../utils.js";

export function renderDashboard(container) {
  const today = todayStr();
  const thisMonth = today.slice(0, 7);
  const balance = db.currentBalance();
  const pnl = db.pnlForMonth(thisMonth);

  // runway: average daily spend over last 30 days of actuals, fallback to budget
  const start30 = addDays(today, -30);
  const recentExpenses = db.data.actuals.filter((t) => t.date >= start30 && t.date <= today && t.amount < 0);
  const totalRecentExpense = recentExpenses.reduce((s, t) => s + Math.abs(t.amount), 0);
  let avgDaily = totalRecentExpense / 30;
  let runwaySource = "actual";
  if (!avgDaily) {
    const budgetExpenses = db.data.budget.filter((t) => t.amount < 0);
    const monthsSpan = Math.max(1, new Set(budgetExpenses.map((t) => t.date.slice(0, 7))).size);
    avgDaily = budgetExpenses.reduce((s, t) => s + Math.abs(t.amount), 0) / (monthsSpan * 30);
    runwaySource = "budget";
  }
  const runwayDays = avgDaily > 0 ? Math.round(balance / avgDaily) : null;

  const trajectory = db.projectedTrajectory(addDays(today, 21));
  const sparkHTML = svgSparkline(trajectory, { height: 70 });

  const upcoming = db.data.budget
    .filter((b) => b.date > today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 4);

  const recent = [...db.data.actuals].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)).slice(0, 5);

  const creditEntries = db.data.creditRating;
  const latestCredit = creditEntries.length ? creditEntries[creditEntries.length - 1] : null;

  const goalCards = [
    goalMiniCard("Marriage", db.data.goals.marriage.reserveAnnualUSD * db.data.goals.marriage.fxRate, db.data.goals.marriage.savedSoFar, "#goals/marriage"),
    goalMiniCard("Home", homeTargetUZS(), db.data.goals.home.savedSoFar, "#goals/home"),
    goalMiniCard("Umrah", umrahTotalUZS(), db.data.goals.umrah.savedSoFar, "#goals/umrah")
  ].join("");

  container.innerHTML = `
    <div class="page-title">Dashboard</div>
    <p class="page-sub">${fmtDate(today)}</p>

    <div class="card hero-balance">
      <div class="label">Current cash balance</div>
      <div class="amount">${fmtMoney(balance)}</div>
      ${runwayDays !== null ? `<div class="sub" style="color:var(--text-dim); font-size:12px;">~${runwayDays} days of runway, based on ${runwaySource === "actual" ? "your last 30 days" : "your budget"}</div>` : ""}
    </div>

    <div class="grid-2">
      <div class="stat">
        <div class="label">Income this month</div>
        <div class="value pos">${fmtMoneyShort(pnl.incomeTotal)}</div>
      </div>
      <div class="stat">
        <div class="label">Expenses this month</div>
        <div class="value neg">${fmtMoneyShort(pnl.expenseTotal)}</div>
      </div>
    </div>

    <div class="card">
      <h2>Balance trend (next 21 days)</h2>
      ${sparkHTML}
      <div class="sub" style="color:var(--text-dim); font-size:11px; margin-top:6px;">Solid line = actual to date, then budget projection</div>
    </div>

    <div class="card">
      <h2>Goals</h2>
      <div class="grid-3">${goalCards}</div>
    </div>

    ${recent.length ? `
    <div class="card">
      <h2>Recent activity</h2>
      <table>
        <tbody>
          ${recent.map((t) => `
            <tr>
              <td>${fmtDate(t.date)}<br><span style="color:var(--text-dim); font-size:11px;">${escapeHtml(t.category)}</span></td>
              <td class="num ${t.amount >= 0 ? "amt-pos" : "amt-neg"}">${fmtMoney(t.amount)}</td>
            </tr>`).join("")}
        </tbody>
      </table>
    </div>` : `
    <div class="card">
      <h2>Recent activity</h2>
      <div class="empty-state">No transactions logged yet — tap + to add your first one.</div>
    </div>`}

    ${upcoming.length ? `
    <div class="card">
      <h2>Upcoming (budget)</h2>
      <table>
        <tbody>
          ${upcoming.map((b) => `
            <tr>
              <td>${fmtDate(b.date)}<br><span style="color:var(--text-dim); font-size:11px;">${escapeHtml(b.category)}</span></td>
              <td class="num ${b.amount >= 0 ? "amt-pos" : "amt-neg"}">${fmtMoney(b.amount)}</td>
            </tr>`).join("")}
        </tbody>
      </table>
    </div>` : ""}

    <div class="card">
      <h2>Credit rating</h2>
      ${latestCredit ? `
        <div class="stat" style="border:none; padding:0;">
          <div class="value">${latestCredit.score}</div>
          <div class="sub">as of ${fmtDate(latestCredit.date)}</div>
        </div>
      ` : `<div class="empty-state">No credit score logged yet.</div>`}
    </div>
  `;

  container.querySelectorAll("[data-goal-link]").forEach((n) => {
    n.addEventListener("click", () => { window.location.hash = n.dataset.goalLink; });
  });
}

function goalMiniCard(name, target, saved, hash) {
  const pct = target > 0 ? Math.min(100, Math.round((saved / target) * 100)) : 0;
  return `
    <div class="stat" data-goal-link="${hash}" style="cursor:pointer;">
      <div class="label">${name}</div>
      <div class="value" style="font-size:15px;">${pct}%</div>
      <div class="progress-bar" style="margin-top:6px;"><div class="fill" style="width:${pct}%"></div></div>
    </div>
  `;
}

function homeTargetUZS() {
  const cheapest = db.data.goals.home.variants.reduce((min, v) => {
    const initial = v.initialPct * v.pricePerSqmMlnUZS * v.sqm * 1_000_000;
    return Math.min(min, initial);
  }, Infinity);
  return cheapest;
}

function umrahTotalUZS() {
  const u = db.data.goals.umrah;
  return (u.amountUSD * u.people + u.bufferUSD) * u.fxRate;
}

