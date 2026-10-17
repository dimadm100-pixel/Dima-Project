import { db } from "../db.js";
import { t as T } from "../i18n.js";
import { fmtMoney, fmtDate, escapeHtml } from "../utils.js";
import { showToast } from "../ui.js";

let filters = { query: "", category: "", from: "", to: "", kind: "all", source: "actuals" };

export function renderSearch(container) {
  const results = db.searchTransactions(filters);
  const total = results.reduce((s, t) => s + t.amount, 0);
  const income = results.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const expense = results.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
  const categories = db.allCategories();

  container.innerHTML = `
    <div class="page-title">${T("search.title")}</div>
    <p class="page-sub">${T("search.sub")}</p>

    <div class="card">
      <div class="field">
        <input type="search" id="q" placeholder="${T("search.placeholder")}" value="${escapeHtml(filters.query)}">
      </div>
      <div class="segmented" style="margin-bottom:12px;">
        <button data-source="actuals" class="${filters.source === "actuals" ? "active" : ""}">${T("search.actual")}</button>
        <button data-source="budget" class="${filters.source === "budget" ? "active" : ""}">${T("search.budget")}</button>
      </div>
      <div class="segmented" style="margin-bottom:12px;">
        <button data-kind="all" class="${filters.kind === "all" ? "active" : ""}">${T("search.all")}</button>
        <button data-kind="income" class="${filters.kind === "income" ? "active" : ""}">${T("common.income")}</button>
        <button data-kind="expense" class="${filters.kind === "expense" ? "active" : ""}">${T("common.expense")}</button>
      </div>
      <div class="field-row">
        <div class="field"><label>${T("common.from")}</label><input type="date" id="from" value="${filters.from}"></div>
        <div class="field"><label>${T("common.to")}</label><input type="date" id="to" value="${filters.to}"></div>
      </div>
      <div class="field">
        <label>${T("common.category")}</label>
        <select id="category">
          <option value="">${T("search.allCategories")}</option>
          ${categories.map((c) => `<option value="${escapeHtml(c)}" ${c === filters.category ? "selected" : ""}>${escapeHtml(c)}</option>`).join("")}
        </select>
      </div>
      <button class="btn secondary small" id="reset">${T("search.resetFilters")}</button>
    </div>

    <div class="grid-3">
      <div class="stat"><div class="label">${T("search.matches")}</div><div class="value" style="font-size:16px;">${results.length}</div></div>
      <div class="stat"><div class="label">${T("search.in")}</div><div class="value pos" style="font-size:16px;">${fmtMoney(income)}</div></div>
      <div class="stat"><div class="label">${T("search.out")}</div><div class="value neg" style="font-size:16px;">${fmtMoney(expense)}</div></div>
    </div>

    <div class="card">
      <h2>${T("search.results")} <span style="font-weight:400;color:var(--text-dim);font-size:12px;">${T("search.net", { amount: fmtMoney(total) })}</span></h2>
      ${results.length ? `
      <table>
        <tbody>
          ${results.slice(0, 300).map((t) => `
            <tr>
              <td>${fmtDate(t.date)}<br><span style="color:var(--text-dim); font-size:11px;">${escapeHtml(t.category)}${t.note ? " · " + escapeHtml(t.note) : ""}</span></td>
              <td class="num ${t.amount >= 0 ? "amt-pos" : "amt-neg"}">${fmtMoney(t.amount)}</td>
            </tr>`).join("")}
        </tbody>
      </table>
      ${results.length > 300 ? `<p style="font-size:11px; color:var(--text-dim); margin-top:8px;">${T("search.showingFirst", { n: results.length })}</p>` : ""}
      <button class="btn secondary small" id="export-csv" style="margin-top:12px;">${T("search.exportCsv")}</button>
      ` : `<div class="empty-state">${T("search.noMatches")}</div>`}
    </div>
  `;

  const rerender = () => renderSearch(container);

  const q = container.querySelector("#q");
  let debounce;
  q.addEventListener("input", () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      filters.query = q.value;
      rerender();
      const box = document.getElementById("q");
      if (box) { box.focus(); box.setSelectionRange(box.value.length, box.value.length); }
    }, 250);
  });

  container.querySelectorAll("[data-source]").forEach((b) => {
    b.addEventListener("click", () => { filters.source = b.dataset.source; rerender(); });
  });
  container.querySelectorAll("[data-kind]").forEach((b) => {
    b.addEventListener("click", () => { filters.kind = b.dataset.kind; rerender(); });
  });
  container.querySelector("#from").addEventListener("change", (e) => { filters.from = e.target.value; rerender(); });
  container.querySelector("#to").addEventListener("change", (e) => { filters.to = e.target.value; rerender(); });
  container.querySelector("#category").addEventListener("change", (e) => { filters.category = e.target.value; rerender(); });
  container.querySelector("#reset").addEventListener("click", () => {
    filters = { query: "", category: "", from: "", to: "", kind: "all", source: filters.source };
    rerender();
  });

  const exportBtn = container.querySelector("#export-csv");
  if (exportBtn) exportBtn.addEventListener("click", () => exportCSV(results));
}

function exportCSV(rows) {
  const header = "date,category,amount,note\n";
  const body = rows.map((t) => {
    const note = (t.note || "").replace(/"/g, '""');
    const cat = (t.category || "").replace(/"/g, '""');
    return `${t.date},"${cat}",${t.amount},"${note}"`;
  }).join("\n");
  const blob = new Blob([header + body], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `transactions-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  showToast(T("search.csvExported"));
}
