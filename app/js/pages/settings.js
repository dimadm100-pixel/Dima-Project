import { db } from "../db.js";
import { fmtDate, fmtMoney, escapeHtml } from "../utils.js";
import { openSheet, closeSheet, confirmAction, field, numberInput, dateInput, textInput, selectInput, categoryField, showToast } from "../ui.js";
import { getApiKey, setApiKey, hasApiKey, getModel, setModel, MODELS } from "../ai.js";
import { addMonths as addMonthKey } from "../utils.js";

function openRecurringEditor(id, onDone) {
  const rec = id ? db.data.recurring.find((r) => r.id === id) : null;
  const isIncome = rec ? rec.amount >= 0 : false;
  const form = document.createElement("div");

  const typeSelect = selectInput(
    [{ value: "expense", label: "Expense" }, { value: "income", label: "Income" }],
    { value: isIncome ? "income" : "expense" }
  );
  const nameInput = textInput({ value: rec?.name || "", placeholder: "e.g. Rent" });
  const amountInput = numberInput({ value: rec ? Math.abs(rec.amount) : "", placeholder: "0" });
  const { wrap: catWrap, input: catInput, refresh } = categoryField("Category", isIncome ? "income" : "expense", rec?.category || "");
  const dayInput = numberInput({ value: rec?.dayOfMonth ?? 1, min: "1", max: "28" });
  typeSelect.addEventListener("change", () => refresh(typeSelect.value));

  form.appendChild(field("Type", typeSelect));
  form.appendChild(field("Name", nameInput));
  form.appendChild(field("Amount (UZS)", amountInput));
  form.appendChild(catWrap);
  form.appendChild(field("Day of month (1–28)", dayInput));

  const save = document.createElement("button");
  save.className = "btn";
  save.textContent = rec ? "Save" : "Add recurring";
  save.addEventListener("click", () => {
    const raw = parseFloat(amountInput.value);
    if (!raw || raw <= 0) { showToast("Enter an amount greater than 0"); return; }
    const category = catInput.value.trim().toLowerCase();
    if (!category) { showToast("Enter a category"); return; }
    const payload = {
      name: nameInput.value.trim() || category,
      category,
      amount: typeSelect.value === "expense" ? -Math.abs(raw) : Math.abs(raw),
      dayOfMonth: parseInt(dayInput.value) || 1
    };
    if (rec) db.updateRecurring(rec.id, payload);
    else db.addRecurring(payload);
    closeSheet();
    onDone();
  });
  form.appendChild(save);

  openSheet(rec ? "Edit recurring" : "Add recurring", form);
}

export function renderSettings(container) {
  container.innerHTML = `
    <div class="page-title">Settings</div>
    <p class="page-sub">Your data lives only on this device. Back it up regularly.</p>

    <div class="card">
      <h2>Opening balance</h2>
      <p style="color:var(--text-dim); font-size:12px; margin-top:-6px;">The starting point your Cash Position is built from.</p>
      <button class="btn secondary small" id="edit-opening">Edit opening balance</button>
    </div>

    <div class="card">
      <h2>Recurring transactions</h2>
      <p style="color:var(--text-dim); font-size:12px; margin-top:-6px;">Things you pay or earn every month. Set them once and generate them into your budget instead of typing them.</p>
      ${db.data.recurring.length ? `
      <table>
        <tbody>
          ${db.data.recurring.map((r) => `
            <tr>
              <td>${escapeHtml(r.name)}<br><span style="color:var(--text-dim); font-size:11px;">${escapeHtml(r.category)} · day ${r.dayOfMonth}${r.active ? "" : " · paused"}</span></td>
              <td class="num ${r.amount >= 0 ? "amt-pos" : "amt-neg"}">${fmtMoney(r.amount)}</td>
              <td class="row-actions" style="justify-content:flex-end;">
                <button class="mini-btn" data-edit-rec="${r.id}">Edit</button>
                <button class="mini-btn danger" data-del-rec="${r.id}">Del</button>
              </td>
            </tr>`).join("")}
        </tbody>
      </table>` : `<div class="empty-state">Nothing recurring set up yet.</div>`}
      <button class="btn secondary small" id="add-recurring" style="margin-top:10px;">+ Add recurring</button>
      ${db.data.recurring.length ? `<button class="btn secondary small" id="gen-recurring" style="margin-top:10px;">Generate into budget (12 months)</button>` : ""}
    </div>

    <div class="card">
      <h2>AI features</h2>
      <p style="color:var(--text-dim); font-size:13px; margin-top:-6px;">
        The Insights page and the Assistant use Claude. Everything else in the app works without this.
      </p>
      <div class="field">
        <label>Anthropic API key</label>
        <input type="password" id="api-key" placeholder="sk-ant-..." value="${escapeHtml(getApiKey())}" autocomplete="off">
      </div>
      <div class="field">
        <label>Model</label>
        <select id="ai-model">
          ${MODELS.map((m) => `<option value="${m.id}" ${m.id === getModel() ? "selected" : ""}>${escapeHtml(m.label)} — ${escapeHtml(m.note)}</option>`).join("")}
        </select>
      </div>
      <button class="btn secondary small" id="save-ai">Save</button>
      <div class="divider"></div>
      <p style="color:var(--text-dim); font-size:11px; line-height:1.5;">
        Get a key at <strong>console.anthropic.com</strong> → API keys. It needs credit on the account; expect a few cents per analysis.<br><br>
        <strong>Be aware:</strong> the key is stored on this device only and is never committed to your repo — but it is used directly from the browser, so anyone with access to your unlocked phone could read it. Using AI features also sends your financial figures to Anthropic's API. Leave the key blank if you'd rather not.
        ${hasApiKey() ? `<br><br><span style="color:var(--accent);">Key is set — AI features are on.</span>` : ""}
      </p>
    </div>

    <div class="card">
      <h2>Backup</h2>
      <p style="color:var(--text-dim); font-size:13px;">Export your data to a file you can keep safe, and re-import it any time (e.g. after reinstalling, or to move to a new phone).</p>
      <button class="btn" id="export-btn">Export data (.json)</button>
      <div style="height:10px;"></div>
      <label class="btn secondary" style="display:block; text-align:center; cursor:pointer;">
        Import data (.json)
        <input type="file" id="import-input" accept="application/json" style="display:none;">
      </label>
    </div>

    <div class="card">
      <h2>Danger zone</h2>
      <button class="btn danger" id="reset-btn">Reset all data</button>
    </div>

    <p style="text-align:center; color:var(--text-dim); font-size:11px; margin-top:20px;">Dilmurod Finance Tracker · installed as a PWA · works offline</p>
  `;

  container.querySelector("#save-ai").addEventListener("click", () => {
    setApiKey(container.querySelector("#api-key").value);
    setModel(container.querySelector("#ai-model").value);
    showToast(hasApiKey() ? "AI features enabled" : "API key cleared");
    renderSettings(container);
  });

  container.querySelector("#add-recurring").addEventListener("click", () => openRecurringEditor(null, () => renderSettings(container)));
  container.querySelectorAll("[data-edit-rec]").forEach((b) => {
    b.addEventListener("click", () => openRecurringEditor(b.dataset.editRec, () => renderSettings(container)));
  });
  container.querySelectorAll("[data-del-rec]").forEach((b) => {
    b.addEventListener("click", () => confirmAction("Remove this recurring item?", () => {
      db.deleteRecurring(b.dataset.delRec);
      renderSettings(container);
    }));
  });
  const genBtn = container.querySelector("#gen-recurring");
  if (genBtn) genBtn.addEventListener("click", () => {
    const start = new Date().toISOString().slice(0, 7);
    const months = [];
    let mk = start;
    for (let i = 0; i < 12; i++) { months.push(mk); mk = addMonthKey(mk); }
    const added = db.generateRecurringBudget(months);
    showToast(added ? `Added ${added} budget entries` : "Already up to date");
    renderSettings(container);
  });

  container.querySelector("#edit-opening").addEventListener("click", () => {
    const form = document.createElement("div");
    const amtInput = numberInput({ value: db.data.meta.openingBalance });
    const dateEl = dateInput({ value: db.data.meta.openingDate });
    form.appendChild(field("Opening balance (UZS)", amtInput));
    form.appendChild(field("Opening date", dateEl));
    const btn = document.createElement("button");
    btn.className = "btn";
    btn.textContent = "Save";
    btn.addEventListener("click", () => {
      db.setOpeningBalance(parseFloat(amtInput.value) || 0, dateEl.value);
      closeSheet();
      showToast("Opening balance updated");
      renderSettings(container);
    });
    form.appendChild(btn);
    openSheet("Opening balance", form);
  });

  container.querySelector("#export-btn").addEventListener("click", () => {
    const json = db.exportJSON();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `finance-backup-${fmtDate(new Date().toISOString().slice(0, 10)).replace(/ /g, "-")}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast("Exported");
  });

  container.querySelector("#import-input").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      confirmAction("Importing will replace all current data on this device. Continue?", () => {
        try {
          db.importJSON(reader.result);
          showToast("Data imported");
          window.location.hash = "#dashboard";
        } catch (err) {
          showToast("Could not read that file");
        }
      });
    };
    reader.readAsText(file);
    e.target.value = "";
  });

  container.querySelector("#reset-btn").addEventListener("click", () => {
    confirmAction("This wipes all your logged transactions and restores the original seed data. Continue?", () => {
      db.resetToSeed();
      showToast("Reset complete");
      window.location.hash = "#dashboard";
    });
  });
}
