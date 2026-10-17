import { db } from "../db.js";
import { t as T } from "../i18n.js";
import { fmtMoney, fmtMonth, todayStr } from "../utils.js";

let selectedMonth = todayStr().slice(0, 7);

export function renderAccCashFlow(container) {
  const months = db.budgetMonths();
  if (!months.includes(selectedMonth)) selectedMonth = months.includes(todayStr().slice(0, 7)) ? todayStr().slice(0, 7) : months[0];

  const rows = db.dailyBalances(selectedMonth);
  const today = todayStr();

  container.innerHTML = `
    <div class="page-title">${T("acc.title")}</div>
    <p class="page-sub">${T("acc.sub")}</p>

    <div class="tabs" id="month-tabs">
      ${months.map((m) => `<button class="${m === selectedMonth ? "active" : ""}" data-month="${m}">${fmtMonth(m)}</button>`).join("")}
    </div>

    <div class="card">
      <table>
        <thead>
          <tr>
            <th>${T("common.date")}</th>
            <th class="num">${T("acc.budgetedAcc")}</th>
            <th class="num">${T("acc.actualAcc")}</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((r) => rowHTML(r, today)).join("")}
        </tbody>
      </table>
    </div>

    <div class="legend">
      <div class="legend-item"><span class="legend-dot" style="background:var(--accent-2);"></span>${T("acc.legendBudget")}</div>
      <div class="legend-item"><span class="legend-dot" style="background:var(--accent);"></span>${T("acc.legendActual")}</div>
      <div class="legend-item"><span class="legend-dot" style="background:var(--danger);"></span>${T("acc.legendNegative")}</div>
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
      <td>${day}${isToday ? ` <span class="badge">${T("common.today")}</span>` : ""}</td>
      <td class="num">${budgetCell}</td>
      <td class="num">${actualCell}</td>
    </tr>
  `;
}
