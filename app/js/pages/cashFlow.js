import { db } from "../db.js";
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
    <div class="page-title">Cash Flow</div>
    <p class="page-sub">The budget — what you planned to earn and spend, vs what actually happened.</p>

    <div class="card">
      <h2>Accumulated cash — budgeted vs actual</h2>
      ${svgDualLine(budgetTrajectory, actualTrajectory)}
      <div class="legend">
        <div class="legend-item"><span class="legend-dot" style="background:var(--accent-2);"></span>Budgeted (full plan)</div>
        <div class="legend-item"><span class="legend-dot" style="background:var(--accent);"></span>Actual (so far)</div>
        ${lowestPoint.balance < 0 ? `<div class="legend-item"><span class="legend-dot" style="background:var(--danger);"></span>Zero line</div>` : ""}
      </div>
      ${holes.length ? `
        <div class="divider"></div>
        ${holes.map((h) => `
          <div style="margin-bottom:10px;">
            <span class="badge danger">cash hole</span>
            <div style="font-size:13px; margin-top:6px;">
              Balance goes negative from <strong>${fmtDate(h.start)}</strong> to <strong>${fmtDate(h.end)}</strong> —
              lowest point <strong style="color:var(--danger);">${fmtMoney(h.lowest)}</strong> on ${fmtDate(h.lowestDate)}.
            </div>
          </div>
        `).join("")}
      ` : `
        <p style="font-size:12px; color:var(--text-dim); margin-top:12px;">Lowest projected point: ${fmtMoney(lowestPoint.balance)} on ${fmtDate(lowestPoint.date)} — no cash holes in your current budget.</p>
      `}
    </div>

    <div class="tabs" id="month-tabs">
      ${months.map((m) => `<button class="${m === selectedMonth ? "active" : ""}" data-month="${m}">${fmtMonth(m)}</button>`).join("")}
    </div>

    <div class="grid-2">
      <div class="stat">
        <div class="label">Planned net</div>
        <div class="value ${cmp.plannedTotal >= 0 ? "pos" : "neg"}">${fmtMoney(cmp.plannedTotal)}</div>
      </div>
      <div class="stat">
        <div class="label">Actual net</div>
        <div class="value ${cmp.actualTotal >= 0 ? "pos" : "neg"}">${fmtMoney(cmp.actualTotal)}</div>
      </div>
    </div>

    <div class="card">
      <h2>Variance by category <span style="font-weight:400;color:var(--text-dim);font-size:12px;">(actual − planned)</span></h2>
      ${cmp.rows.length ? svgBars(barItems, { height: 130 }) : `<div class="empty-state">No budget or actuals for this month yet.</div>`}
      <table style="margin-top:10px;">
        <thead><tr><th>Category</th><th class="num">Planned</th><th class="num">Actual</th></tr></thead>
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
        ${variance >= 0 ? "Ahead of plan by " : "Behind plan by "}${fmtMoney(Math.abs(variance))}
      </p>
    </div>

    <div class="card">
      <h2>Budget line items — ${fmtMonth(selectedMonth)}</h2>
      ${renderBudgetTable(selectedMonth)}
      <button class="btn secondary small" id="add-budget-btn" style="margin-top:10px;">+ Add budget item</button>
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
  if (!items.length) return `<div class="empty-state">No planned items for this month.</div>`;
  return `<table>
    <tbody>
      ${items.map((b) => `
        <tr>
          <td>${fmtDate(b.date)}<br><span style="color:var(--text-dim); font-size:11px;">${escapeHtml(b.category)}${b.note ? " · " + escapeHtml(b.note) : ""}</span></td>
          <td class="num ${b.amount >= 0 ? "amt-pos" : "amt-neg"}">${fmtMoney(b.amount)}</td>
          <td class="row-actions" style="justify-content:flex-end;">
            <button class="mini-btn" data-edit-budget="${b.id}">Edit</button>
            <button class="mini-btn danger" data-delete-budget="${b.id}">Del</button>
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
      confirmAction("Delete this budget item?", () => {
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
  const typeSelect = selectInput([{ value: "expense", label: "Expense" }, { value: "income", label: "Income" }], { value: isIncome ? "income" : "expense" });
  const amountInput = numberInput({ value: item ? Math.abs(item.amount) : "" });
  const dateEl = dateInput({ value: item?.date || selectedMonth + "-01" });
  const { wrap: categoryWrap, input: categoryInput, refresh: refreshCategories } = categoryField("Category", isIncome ? "income" : "expense", item?.category || "");
  const noteInputEl = textInput({ value: item?.note || "" });
  typeSelect.addEventListener("change", () => refreshCategories(typeSelect.value));

  form.appendChild(field("Type", typeSelect));
  form.appendChild(field("Amount (UZS)", amountInput));
  form.appendChild(field("Date", dateEl));
  form.appendChild(categoryWrap);
  form.appendChild(field("Note (optional)", noteInputEl));

  const saveBtn = document.createElement("button");
  saveBtn.className = "btn";
  saveBtn.textContent = item ? "Save changes" : "Add to budget";
  saveBtn.addEventListener("click", () => {
    const raw = parseFloat(amountInput.value);
    if (!raw || raw <= 0) { showToast("Enter an amount greater than 0"); return; }
    const amount = typeSelect.value === "expense" ? -Math.abs(raw) : Math.abs(raw);
    const payload = { date: dateEl.value, amount, category: categoryInput.value.trim() || "other", note: noteInputEl.value.trim() };
    if (item) db.updateBudgetItem(item.id, payload);
    else db.addBudgetItem(payload);
    closeSheet();
    onDone();
  });
  form.appendChild(saveBtn);

  openSheet(item ? "Edit budget item" : "Add budget item", form);
}

function allMonths() {
  const set = new Set([
    ...db.data.budget.map((b) => b.date.slice(0, 7)),
    ...db.data.actuals.map((a) => a.date.slice(0, 7)),
    todayStr().slice(0, 7)
  ]);
  return [...set].sort();
}
