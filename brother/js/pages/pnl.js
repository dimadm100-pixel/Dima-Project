import { db } from "../db.js";
import { t as T } from "../i18n.js";
import { fmtMoney, fmtMonth, todayStr, escapeHtml, svgSparkline, svgDonut, colorForIndex } from "../utils.js";

let selectedMonth = todayStr().slice(0, 7);

export function renderPnl(container) {
  const months = allMonths();
  if (!months.includes(selectedMonth)) selectedMonth = months[months.length - 1] || todayStr().slice(0, 7);

  const pnl = db.pnlForMonth(selectedMonth);
  const incomeRows = Object.entries(pnl.income).sort((a, b) => b[1] - a[1]);
  const expenseRows = Object.entries(pnl.expense).sort((a, b) => b[1] - a[1]);

  const trend = months.map((m) => ({ value: db.pnlForMonth(m).net }));

  const expenseDonutItems = expenseRows.map(([cat, val], i) => ({ label: cat, value: val, color: colorForIndex(i) }));

  container.innerHTML = `
    <div class="page-title">${T("pnl.title")}</div>
    <p class="page-sub">${T("pnl.sub")}</p>

    <div class="tabs" id="month-tabs">
      ${months.map((m) => `<button class="${m === selectedMonth ? "active" : ""}" data-month="${m}">${fmtMonth(m)}</button>`).join("")}
    </div>

    <div class="card hero-balance">
      <div class="label">${T("pnl.netIncomeFor", { month: fmtMonth(selectedMonth) })}</div>
      <div class="amount" style="color:${pnl.net >= 0 ? "var(--accent)" : "var(--danger)"};">${fmtMoney(pnl.net)}</div>
    </div>

    <div class="card">
      <h2>${T("pnl.trend")}</h2>
      ${months.length > 1 ? svgSparkline(trend, { height: 70 }) : `<div class="empty-state">${T("pnl.needMoreMonths")}</div>`}
    </div>

    <div class="grid-2">
      <div class="stat">
        <div class="label">${T("pnl.totalRevenue")}</div>
        <div class="value pos">${fmtMoney(pnl.incomeTotal)}</div>
      </div>
      <div class="stat">
        <div class="label">${T("pnl.totalExpenses")}</div>
        <div class="value neg">${fmtMoney(pnl.expenseTotal)}</div>
      </div>
    </div>

    <div class="card">
      <h2>${T("pnl.revenueByCat")}</h2>
      ${incomeRows.length ? `<table><tbody>${incomeRows.map(([cat, val]) => `<tr><td>${escapeHtml(cat)}</td><td class="num amt-pos">${fmtMoney(val)}</td></tr>`).join("")}</tbody></table>` : `<div class="empty-state">${T("pnl.noRevenue")}</div>`}
    </div>

    <div class="card">
      <h2>${T("pnl.expensesByCat")}</h2>
      ${expenseRows.length ? `
        <div style="display:flex; align-items:center; gap:18px; flex-wrap:wrap;">
          ${svgDonut(expenseDonutItems)}
          <div class="legend" style="flex:1; margin-top:0;">
            ${expenseDonutItems.map((it) => `<div class="legend-item"><span class="legend-dot" style="background:${it.color}"></span>${escapeHtml(it.label)} · ${fmtMoney(it.value)}</div>`).join("")}
          </div>
        </div>
        <table style="margin-top:14px;"><tbody>${expenseRows.map(([cat, val]) => `<tr><td>${escapeHtml(cat)}</td><td class="num amt-neg">${fmtMoney(val)}</td></tr>`).join("")}</tbody></table>
      ` : `<div class="empty-state">${T("pnl.noExpenses")}</div>`}
    </div>
  `;

  container.querySelectorAll("#month-tabs button").forEach((btn) => {
    btn.addEventListener("click", () => { selectedMonth = btn.dataset.month; renderPnl(container); });
  });
}

function allMonths() {
  const set = new Set([...db.data.actuals.map((a) => a.date.slice(0, 7)), todayStr().slice(0, 7)]);
  return [...set].sort();
}
