import { db } from "../db.js";
import { fmtMoney, fmtMonth, todayStr } from "../utils.js";

let selectedMonth = todayStr().slice(0, 7);

export function renderAccCashFlow(container) {
  const months = db.budgetMonths();
  if (!months.includes(selectedMonth)) selectedMonth = months.includes(todayStr().slice(0, 7)) ? todayStr().slice(0, 7) : months[0];

  const rows = db.dailyBalances(selectedMonth);
  const today = todayStr();

  container.innerHTML = `
    <div class="page-title">Acc. Cash Flow</div>
    <p class="page-sub">Accumulated cash balance, day by day — budgeted vs actual.</p>

    <div class="tabs" id="month-tabs">
      ${months.map((m) => `<button class="${m === selectedMonth ? "active" : ""}" data-month="${m}">${fmtMonth(m)}</button>`).join("")}
    </div>

    <div class="card">
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th class="num">Budgeted Acc</th>
            <th class="num">Actual Acc</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((r) => rowHTML(r, today)).join("")}
        </tbody>
      </table>
    </div>

    <div class="legend">
      <div class="legend-item"><span class="legend-dot" style="background:var(--accent-2);"></span>Δ that day, budgeted</div>
      <div class="legend-item"><span class="legend-dot" style="background:var(--accent);"></span>Δ that day, actual</div>
      <div class="legend-item"><span class="legend-dot" style="background:var(--danger);"></span>Balance negative</div>
    </div>
  `;

  container.querySelectorAll("#month-tabs button").forEach((btn) => {
    btn.addEventListener("click", () => { selectedMonth = btn.dataset.month; renderAccCashFlow(container); });
  });
}

function rowHTML(r, today) {
  const day = Number(r.date.slice(8, 10));
  const isToday = r.date === today;
  const budgetCell = r.budgetAcc !== null
    ? `<div class="${r.budgetAcc < 0 ? "amt-neg" : ""}" style="font-weight:700;">${fmtMoney(r.budgetAcc)}</div>${r.budgetDelta !== 0 ? `<div style="font-size:11px; color:var(--text-dim);">${r.budgetDelta > 0 ? "+" : ""}${fmtMoney(r.budgetDelta)}</div>` : ""}`
    : `<span style="color:var(--text-dim);">—</span>`;
  const actualCell = r.actualAcc !== null
    ? `<div class="${r.actualAcc < 0 ? "amt-neg" : ""}" style="font-weight:700;">${fmtMoney(r.actualAcc)}</div>${r.actualDelta !== 0 ? `<div style="font-size:11px; color:var(--text-dim);">${r.actualDelta > 0 ? "+" : ""}${fmtMoney(r.actualDelta)}</div>` : ""}`
    : `<span style="color:var(--text-dim);">—</span>`;
  return `
    <tr style="${isToday ? "background:var(--accent-fade);" : ""}">
      <td>${day}${isToday ? ` <span class="badge">today</span>` : ""}</td>
      <td class="num">${budgetCell}</td>
      <td class="num">${actualCell}</td>
    </tr>
  `;
}
