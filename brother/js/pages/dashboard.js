import { db } from "../db.js";
import { fmtMoney, fmtMoneyShort, fmtDate, fmtMonth, todayStr, addDays, svgSparkline, escapeHtml } from "../utils.js";
import { showToast } from "../ui.js";
import { analyze } from "../insights.js";
import { effectiveRate, triggeredAlerts } from "../fx.js";

// The handful of entries you log most often, so a repeat is one tap.
function quickRepeats() {
  const counts = {};
  for (const t of db.data.actuals) {
    if (t.amount >= 0) continue;
    const key = `${t.category}|${t.amount}`;
    counts[key] = counts[key] || { count: 0, category: t.category, amount: t.amount, last: t.date };
    counts[key].count++;
    if (t.date > counts[key].last) counts[key].last = t.date;
  }
  return Object.values(counts)
    .sort((a, b) => b.count - a.count || b.last.localeCompare(a.last))
    .slice(0, 6);
}

// Reminders surface when you open the app; there is no server to push them.
function reminders() {
  const out = [];
  const today = todayStr();
  const dismissed = db.data.dismissed || {};

  for (const f of analyze()) {
    if (f.kind !== "overspending" && f.kind !== "cash_hole") continue;
    if (f.severity === "low") continue;
    if (dismissed[f.id] === today) continue;
    out.push({ id: f.id, title: f.title, detail: f.detail, severity: f.severity });
  }

  for (const a of triggeredAlerts()) {
    if (dismissed[a.id] === today) continue;
    out.push({
      id: a.id,
      title: `${a.ccy} is ${a.direction} ${Math.round(a.threshold).toLocaleString("en-US")}`,
      detail: `Now ${Math.round(a.rate).toLocaleString("en-US")} UZS per ${a.ccy} — past the threshold you set.`,
      severity: "medium",
      link: "#fx"
    });
  }

  // Weekly digest: offered once per ISO week, on or after Sunday.
  const week = isoWeekKey(today);
  if (dismissed[`digest-${week}`] !== "seen" && new Date(today + "T00:00:00Z").getUTCDay() === 0) {
    out.push({ id: `digest-${week}`, title: "Your weekly summary is ready", detail: "See how last week went across income, spending and goals.", severity: "low", link: "#insights" });
  }
  return out.slice(0, 3);
}

function isoWeekKey(dateStr) {
  const d = new Date(dateStr + "T00:00:00Z");
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${week}`;
}

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

  const alerts = db.budgetAlerts().slice(0, 4);
  const activeReminders = reminders();
  const repeats = quickRepeats();

  const goalCards = [
    goalMiniCard("Marriage", db.data.goals.marriage.reserveAnnualUSD * effectiveRate(db.data.goals.marriage.fxRate), db.data.goals.marriage.savedSoFar, "#goals/marriage"),
    goalMiniCard("Home", homeTargetUZS(), db.data.goals.home.savedSoFar, "#goals/home"),
    goalMiniCard("Umrah", umrahTotalUZS(), db.data.goals.umrah.savedSoFar, "#goals/umrah")
  ].join("");

  container.innerHTML = `
    <div class="page-title">Dashboard</div>
    <p class="page-sub">${fmtDate(today)}</p>

    ${activeReminders.map((r) => `
      <div class="card" style="border-color:${r.severity === "high" ? "var(--danger)" : "var(--warn)"}; display:flex; gap:12px; align-items:flex-start;">
        <div style="flex:1;">
          <div style="font-size:14px; font-weight:600;">${escapeHtml(r.title)}</div>
          <div style="font-size:12px; color:var(--text-dim); margin-top:4px;">${escapeHtml(r.detail)}</div>
          ${r.link ? `<button class="mini-btn" style="margin-top:8px;" data-reminder-link="${r.link}">Open</button>` : ""}
        </div>
        <button class="mini-btn" data-dismiss="${escapeHtml(r.id)}">✕</button>
      </div>
    `).join("")}

    ${repeats.length ? `
    <div class="card">
      <h2>Log again</h2>
      <div class="chip-row">
        ${repeats.map((r) => `
          <button class="chip" data-repeat='${escapeHtml(JSON.stringify({ category: r.category, amount: r.amount }))}'>
            ${escapeHtml(r.category)} · ${fmtMoneyShort(r.amount)}
          </button>`).join("")}
      </div>
      <div class="sub" style="color:var(--text-dim); font-size:11px; margin-top:8px;">One tap logs it for today.</div>
    </div>` : ""}

    <div class="card hero-balance">
      <div class="label">Current cash balance</div>
      <div class="amount" style="color:${balance < 0 ? "var(--danger)" : "var(--text)"};">${fmtMoney(balance)}</div>
      ${balance < 0
        ? `<div class="sub" style="color:var(--danger); font-size:12px;">Balance is negative</div>`
        : runwayDays !== null
          ? `<div class="sub" style="color:var(--text-dim); font-size:12px;">~${runwayDays} days of runway, based on ${runwaySource === "actual" ? "your last 30 days" : "your budget"}</div>`
          : ""}
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

    ${alerts.length ? `
    <div class="card" id="budget-alerts-card" style="cursor:pointer;">
      <h2>Budget watch — ${fmtMonth(thisMonth)}</h2>
      ${alerts.map((a) => `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
          <div>
            <span class="badge ${a.severity === "over" ? "danger" : "warn"}">${a.severity === "over" ? "over budget" : "ahead of pace"}</span>
            <div style="font-size:13px; margin-top:4px;">${escapeHtml(a.category)}</div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:13px; font-weight:700; color:${a.severity === "over" ? "var(--danger)" : "var(--warn)"};">+${fmtMoneyShort(a.overBy)}</div>
            <div style="font-size:11px; color:var(--text-dim);">${fmtMoneyShort(a.actual)} of ${fmtMoneyShort(a.planned)}</div>
          </div>
        </div>
      `).join("")}
      <div class="sub" style="color:var(--text-dim); font-size:11px;">Tap to review in Cash Flow</div>
    </div>` : ""}

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
  const alertsCard = container.querySelector("#budget-alerts-card");
  if (alertsCard) alertsCard.addEventListener("click", () => { window.location.hash = "#cashflow"; });

  container.querySelectorAll("[data-repeat]").forEach((chip) => {
    chip.addEventListener("click", () => {
      const { category, amount } = JSON.parse(chip.dataset.repeat);
      db.addActual({ date: todayStr(), amount, category, note: "" });
      showToast(`Logged ${category}`);
      renderDashboard(container);
    });
  });

  container.querySelectorAll("[data-dismiss]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.dismiss;
      db.data.dismissed[id] = id.startsWith("digest-") ? "seen" : todayStr();
      db.save();
      renderDashboard(container);
    });
  });

  container.querySelectorAll("[data-reminder-link]").forEach((btn) => {
    btn.addEventListener("click", () => { window.location.hash = btn.dataset.reminderLink; });
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
  // No variants configured yet -- report 0 rather than Infinity, which would
  // otherwise render as an unreachable goal.
  return Number.isFinite(cheapest) ? cheapest : 0;
}

function umrahTotalUZS() {
  const u = db.data.goals.umrah;
  return (u.amountUSD * u.people + u.bufferUSD) * effectiveRate(u.fxRate);
}

