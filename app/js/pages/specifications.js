import { db } from "../db.js";
import { fmtMoney, fmtDate, todayStr, escapeHtml } from "../utils.js";
import { openSheet, closeSheet, confirmAction, field, numberInput, dateInput, textInput, selectInput, showToast } from "../ui.js";

export function renderSpecifications(container) {
  const specs = [...db.data.specifications].sort((a, b) => b.date.localeCompare(a.date));

  container.innerHTML = `
    <div class="page-title">Specifications</div>
    <p class="page-sub">Ad-hoc breakdowns — when you want to see exactly what a category is made of.</p>

    ${specs.length ? specs.map((s) => specCard(s)).join("") : `<div class="card"><div class="empty-state">No breakdowns yet — build one to see exactly what a category is made of, e.g. "Food – August".</div></div>`}

    <button class="btn" id="new-spec">+ New breakdown</button>
  `;

  container.querySelector("#new-spec").addEventListener("click", () => {
    openSpecEditor(null, () => renderSpecifications(container));
  });

  container.querySelectorAll("[data-del-spec]").forEach((btn) => {
    btn.addEventListener("click", () => confirmAction("Delete this breakdown?", () => { db.deleteSpecification(btn.dataset.delSpec); renderSpecifications(container); }));
  });
  container.querySelectorAll("[data-edit-spec]").forEach((btn) => {
    btn.addEventListener("click", () => openSpecEditor(btn.dataset.editSpec, () => renderSpecifications(container)));
  });
}

function specCard(s) {
  const total = s.items.reduce((sum, i) => sum + i.amount, 0);
  return `
    <div class="card">
      <h2>${escapeHtml(s.title)} <span class="badge ${s.kind === "income" ? "" : "warn"}">${s.kind}</span></h2>
      <p style="color:var(--text-dim); font-size:12px; margin:-8px 0 12px;">${fmtDate(s.date)}</p>
      <table>
        <tbody>
          ${s.items.map((i) => `<tr><td>${escapeHtml(i.label)}</td><td class="num">${fmtMoney(i.amount)}</td></tr>`).join("")}
          <tr><td style="font-weight:700;">Total</td><td class="num" style="font-weight:700;">${fmtMoney(total)}</td></tr>
        </tbody>
      </table>
      <div class="row-actions" style="margin-top:10px;">
        <button class="mini-btn" data-edit-spec="${s.id}">Edit</button>
        <button class="mini-btn danger" data-del-spec="${s.id}">Delete</button>
      </div>
    </div>
  `;
}

export function openSpecEditor(id, onDone) {
  const spec = id ? db.data.specifications.find((s) => s.id === id) : null;
  const items = spec ? spec.items.map((i) => ({ ...i })) : [{ label: "", amount: "" }];

  const form = document.createElement("div");
  const titleInput = textInput({ value: spec?.title || "", placeholder: "e.g. Food breakdown" });
  const dateEl = dateInput({ value: spec?.date || todayStr() });
  const kindSelect = selectInput([{ value: "expense", label: "Expense" }, { value: "income", label: "Income" }], { value: spec?.kind || "expense" });
  form.appendChild(field("Title", titleInput));
  form.appendChild(field("Date", dateEl));
  form.appendChild(field("Kind", kindSelect));

  const itemsWrap = document.createElement("div");
  form.appendChild(itemsWrap);

  function renderItems() {
    itemsWrap.innerHTML = "";
    items.forEach((it, idx) => {
      const row = document.createElement("div");
      row.className = "field-row";
      row.style.marginBottom = "10px";
      const labelInput = textInput({ value: it.label, placeholder: "item" });
      const amtInput = numberInput({ value: it.amount, placeholder: "amount" });
      labelInput.addEventListener("input", () => { items[idx].label = labelInput.value; });
      amtInput.addEventListener("input", () => { items[idx].amount = amtInput.value; });
      row.appendChild(labelInput);
      row.appendChild(amtInput);
      const delBtn = document.createElement("button");
      delBtn.className = "mini-btn danger";
      delBtn.textContent = "✕";
      delBtn.type = "button";
      delBtn.addEventListener("click", () => { items.splice(idx, 1); renderItems(); });
      row.appendChild(delBtn);
      itemsWrap.appendChild(row);
    });
  }
  renderItems();

  const addItemBtn = document.createElement("button");
  addItemBtn.className = "btn secondary small";
  addItemBtn.textContent = "+ Add item";
  addItemBtn.type = "button";
  addItemBtn.addEventListener("click", () => { items.push({ label: "", amount: "" }); renderItems(); });
  form.appendChild(addItemBtn);

  const saveBtn = document.createElement("button");
  saveBtn.className = "btn";
  saveBtn.style.marginTop = "14px";
  saveBtn.textContent = spec ? "Save changes" : "Save breakdown";
  saveBtn.addEventListener("click", () => {
    if (!titleInput.value.trim()) { showToast("Enter a title"); return; }
    const cleanItems = items.filter((i) => i.label.trim()).map((i) => ({ label: i.label.trim(), amount: parseFloat(i.amount) || 0 }));
    const payload = { title: titleInput.value.trim(), date: dateEl.value, kind: kindSelect.value, items: cleanItems };
    if (spec) db.updateSpecification(spec.id, payload);
    else db.addSpecification(payload);
    closeSheet();
    onDone();
  });
  form.appendChild(saveBtn);

  openSheet(spec ? "Edit breakdown" : "New breakdown", form);
}
