import { db } from "../db.js";
import { t as T } from "../i18n.js";
import { fmtMoney, fmtMonth, fmtDate, todayStr, escapeHtml, svgBars, svgDualLine } from "../utils.js";
import { openSheet, closeSheet, confirmAction, field, numberInput, dateInput, textInput, selectInput, categoryField, showToast } from "../ui.js";

let selectedMonth = todayStr().slice(0, 7);

export function renderCashFlow(container) {
  const months = allMonths();
  if (!months.includes(selectedMonth)) selectedMonth = months[0] || todayStr().slice(0, 7);

  const cmp = db.monthComparison(selectedMonth);
  const variance = cmp.actualTotal - cmp.plannedTotal;
  const barItems = cmp.rows.map((r) => ({ label: r.category, value: r.actual - r.planned }));

  const budgetTrajectory = db.budgetTrajectory();
  const actualTrajectory = db.actualTrajectory();
  const holes = db.cashHoles();
  const lowestPoint = budgetTrajectory.reduce((min, p) => (p.balance < min.balance ? p : min), budgetTrajectory[0]);

  container.innerHTML = `
    <div class="page-title">${T("cashflow.title")}</div>
    <p class="page-sub">${T("cashflow.sub")}</p>

    <div class="card">
      <h2>${T("cashflow.accTitle")}</h2>
      ${svgDualLine(budgetTrajectory, actualTrajectory)}
      <div class="legend">
        <div class="legend-item"><span class="legend-dot" style="background:var(--accent-2);"></span>${T("cashflow.legendBudget")}</div>
        <div class="legend-item"><span class="legend-dot" style="background:var(--accent);"></span>${T("cashflow.legendActual")}</div>
        ${lowestPoint.balance < 0 ? `<div class="legend-item"><span class="legend-dot" style="background:var(--danger);"></span>${T("cashflow.legendZero")}</div>` : ""}
      </div>
      ${holes.length ? `
        <div class="divider"></div>
        ${holes.map((h) => `
          <div style="margin-bottom:10px;">
            <span class="badge danger">${T("cashflow.cashHole")}</span>
            <div style="font-size:13px; margin-top:6px;">
              ${T("cashflow.holeBody", { start: fmtDate(h.start), end: fmtDate(h.end), lowest: fmtMoney(h.lowest), lowestDate: fmtDate(h.lowestDate) })}
            </div>
          </div>
        `).join("")}
      ` : `
        <p style="font-size:12px; color:var(--text-dim); margin-top:12px;">${T("cashflow.noHoles", { amount: fmtMoney(lowestPoint.balance), date: fmtDate(lowestPoint.date) })}</p>
      `}
    </div>

    <div class="tabs" id="month-tabs">
      ${months.map((m) => `<button class="${m === selectedMonth ? "active" : ""}" data-month="${m}">${fmtMonth(m)}</button>`).join("")}
    </div>

    <div class="grid-2">
      <div class="stat">
        <div class="label">${T("cashflow.plannedNet")}</div>
        <div class="value ${cmp.plannedTotal >= 0 ? "pos" : "neg"}">${fmtMoney(cmp.plannedTotal)}</div>
      </div>
      <div class="stat">
        <div class="label">${T("cashflow.actualNet")}</div>
        <div class="value ${cmp.actualTotal >= 0 ? "pos" : "neg"}">${fmtMoney(cmp.actualTotal)}</div>
      </div>
    </div>

    <div class="card">
      <h2>${T("cashflow.variance")} <span style="font-weight:400;color:var(--text-dim);font-size:12px;">${T("cashflow.varianceNote")}</span></h2>
      ${cmp.rows.length ? svgBars(barItems, { height: 130 }) : `<div class="empty-state">${T("cashflow.nothingThisMonth")}</div>`}
      <table style="margin-top:10px;">
        <thead><tr><th>${T("common.category")}</th><th class="num">${T("cashflow.planned")}</th><th class="num">${T("cashflow.actual")}</th></tr></thead>
        <tbody>
          ${cmp.rows.map((r) => `
            <tr>
              <td>${escapeHtml(r.category)}</td>
              <td class="num">${fmtMoney(r.planned)}</td>
              <td class="num ${r.actual >= r.planned ? "amt-pos" : "amt-neg"}">${fmtMoney(r.actual)}</td>
            </tr>`).join("")}
        </tbody>
      </table>
      <p style="font-size:12px; color:${variance >= 0 ? "var(--accent)" : "var(--danger)"}; margin-top:10px;">
        ${variance >= 0 ? T("cashflow.aheadBy", { amount: fmtMoney(Math.abs(variance)) }) : T("cashflow.behindBy", { amount: fmtMoney(Math.abs(variance)) })}
      </p>
    </div>

    <div class="card">
      <h2>Budget line items — ${fmtMonth(selectedMonth)}</h2>
      ${renderBudgetTable(selectedMonth)}
      <button class="btn secondary small" id="add-budget-btn" style="margin-top:10px;">${T("cashflow.addBudgetItem")}</button>
    </div>
  `;

  container.querySelectorAll("#month-tabs button").forEach((btn) => {
    btn.addEventListener("click", () => { selectedMonth = btn.dataset.month; renderCashFlow(container); });
  });
  container.querySelector("#add-budget-btn").addEventListener("click", () => openBudgetEditor(null, () => renderCashFlow(container)));
  bindBudgetRowActions(container);
}

function renderBudgetTable(monthKey) {
  const items = db.data.budget.filter((b) => b.date.startsWith(monthKey)).sort((a, b) => a.date.localeCompare(b.date));
  if (!items.length) return `<div class="empty-state">${T("cashflow.noPlanned")}</div>`;
  return `<table>
    <tbody>
      ${items.map((b) => `
        <tr>
          <td>${fmtDate(b.date)}<br><span style="color:var(--text-dim); font-size:11px;">${escapeHtml(b.category)}${b.note ? " · " + escapeHtml(b.note) : ""}</span></td>
          <td class="num ${b.amount >= 0 ? "amt-pos" : "amt-neg"}">${fmtMoney(b.amount)}</td>
          <td class="row-actions" style="justify-content:flex-end;">
            <button class="mini-btn" data-edit-budget="${b.id}">${T("common.edit")}</button>
            <button class="mini-btn danger" data-delete-budget="${b.id}">${T("common.del")}</button>
          </td>
        </tr>`).join("")}
    </tbody>
  </table>`;
}

function bindBudgetRowActions(container) {
  container.querySelectorAll("[data-edit-budget]").forEach((btn) => {
    btn.addEventListener("click", () => openBudgetEditor(btn.dataset.editBudget, () => renderCashFlow(container)));
  });
  container.querySelectorAll("[data-delete-budget]").forEach((btn) => {
    btn.addEventListener("click", () => {
      confirmAction(T("cashflow.confirmDelete"), () => {
        db.deleteBudgetItem(btn.dataset.deleteBudget);
        renderCashFlow(container);
      });
    });
  });
}

function openBudgetEditor(id, onDone) {
  const item = id ? db.data.budget.find((b) => b.id === id) : null;
  const isIncome = item ? item.amount >= 0 : false;
  const form = document.createElement("div");
  const typeSelect = selectInput([{ value: "expense", label: T("common.expense") }, { value: "income", label: T("common.income") }], { value: isIncome ? "income" : "expense" });
  const amountInput = numberInput({ value: item ? Math.abs(item.amount) : "" });
  const dateEl = dateInput({ value: item?.date || selectedMonth + "-01" });
  const { wrap: categoryWrap, input: categoryInput, refresh: refreshCategories } = categoryField(T("common.category"), isIncome ? "income" : "expense", item?.category || "");
  const noteInputEl = textInput({ value: item?.note || "" });
  typeSelect.addEventListener("change", () => refreshCategories(typeSelect.value));

  form.appendChild(field(T("common.type"), typeSelect));
  form.appendChild(field(T("common.amount"), amountInput));
  form.appendChild(field(T("common.date"), dateEl));
  form.appendChild(categoryWrap);
  form.appendChild(field(T("tx.note"), noteInputEl));

  const saveBtn = document.createElement("button");
  saveBtn.className = "btn";
  saveBtn.textContent = item ? T("common.saveChanges") : T("cashflow.addToBudget");
  saveBtn.addEventListener("click", () => {
    const raw = parseFloat(amountInput.value);
    if (!raw || raw <= 0) { showToast(T("common.needAmount")); return; }
    const amount = typeSelect.value === "expense" ? -Math.abs(raw) : Math.abs(raw);
    const payload = { date: dateEl.value, amount, category: categoryInput.value.trim() || "other", note: noteInputEl.value.trim() };
    if (item) db.updateBudgetItem(item.id, payload);
    else db.addBudgetItem(payload);
    closeSheet();
    onDone();
  });
  form.appendChild(saveBtn);

  openSheet(item ? T("cashflow.editBudgetItem") : T("cashflow.addBudgetItemTitle"), form);
}

function allMonths() {
  const set = new Set([
    ...db.data.budget.map((b) => b.date.slice(0, 7)),
    ...db.data.actuals.map((a) => a.date.slice(0, 7)),
    todayStr().slice(0, 7)
  ]);
  return [...set].sort();
}
