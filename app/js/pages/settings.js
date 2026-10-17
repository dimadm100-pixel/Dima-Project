import { db } from "../db.js";
import { fmtDate, fmtMoney, escapeHtml } from "../utils.js";
import { openSheet, closeSheet, confirmAction, field, numberInput, dateInput, textInput, selectInput, categoryField, showToast } from "../ui.js";
import { getApiKey, setApiKey, hasApiKey, getModel, setModel, MODELS } from "../ai.js";
import { addMonths as addMonthKey } from "../utils.js";
import { openOpeningEditor } from "./cashPosition.js";
import { t as T, LANGS, getLang, setLang } from "../i18n.js";

function openRecurringEditor(id, onDone) {
  const rec = id ? db.data.recurring.find((r) => r.id === id) : null;
  const isIncome = rec ? rec.amount >= 0 : false;
  const form = document.createElement("div");

  const typeSelect = selectInput(
    [{ value: "expense", label: T("common.expense") }, { value: "income", label: T("common.income") }],
    { value: isIncome ? "income" : "expense" }
  );
  const nameInput = textInput({ value: rec?.name || "", placeholder: T("settings.recurringNamePlaceholder") });
  const amountInput = numberInput({ value: rec ? Math.abs(rec.amount) : "", placeholder: "0" });
  const { wrap: catWrap, input: catInput, refresh } = categoryField(T("common.category"), isIncome ? "income" : "expense", rec?.category || "");
  const dayInput = numberInput({ value: rec?.dayOfMonth ?? 1, min: "1", max: "28" });
  typeSelect.addEventListener("change", () => refresh(typeSelect.value));

  form.appendChild(field(T("common.type"), typeSelect));
  form.appendChild(field(T("common.name"), nameInput));
  form.appendChild(field(T("common.amount"), amountInput));
  form.appendChild(catWrap);
  form.appendChild(field(T("settings.dayOfMonth"), dayInput));

  const save = document.createElement("button");
  save.className = "btn";
  save.textContent = rec ? T("common.save") : T("settings.addRecurringShort");
  save.addEventListener("click", () => {
    const raw = parseFloat(amountInput.value);
    if (!raw || raw <= 0) { showToast(T("common.needAmount")); return; }
    const category = catInput.value.trim().toLowerCase();
    if (!category) { showToast(T("common.needCategory")); return; }
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

  openSheet(rec ? T("settings.editRecurring") : T("settings.addRecurringShort"), form);
}

export function renderSettings(container) {
  container.innerHTML = `
    <div class="page-title">${T("settings.title")}</div>
    <p class="page-sub">${T("settings.sub")}</p>

    <div class="card">
      <h2>${T("settings.languageTitle")}</h2>
      <p style="color:var(--text-dim); font-size:12px; margin-top:-6px;">${T("settings.languageHint")}</p>
      <div class="segmented" style="margin-top:12px;">
        ${LANGS.map((l) => `<button data-set-lang="${l.code}" class="${l.code === getLang() ? "active" : ""}">${l.label}</button>`).join("")}
      </div>
    </div>

    <div class="card">
      <h2>${T("settings.openingTitle")}</h2>
      <p style="color:var(--text-dim); font-size:12px; margin-top:-6px;">${T("settings.openingHint")}</p>
      <div class="stat" style="border:none; padding:0; margin-bottom:12px;">
        <div class="value">${fmtMoney(db.openingBalance())}</div>
        <div class="sub">${T("settings.asOf", { date: fmtDate(db.data.meta.openingDate) })}</div>
      </div>
      <button class="btn secondary small" id="edit-opening">${T("settings.editOpening")}</button>
    </div>

    <div class="card">
      <h2>${T("settings.recurringTitle")}</h2>
      <p style="color:var(--text-dim); font-size:12px; margin-top:-6px;">${T("settings.recurringHint")}</p>
      ${db.data.recurring.length ? `
      <table>
        <tbody>
          ${db.data.recurring.map((r) => `
            <tr>
              <td>${escapeHtml(r.name)}<br><span style="color:var(--text-dim); font-size:11px;">${escapeHtml(r.category)} · ${T("settings.dayOfMonthShort", { day: r.dayOfMonth })}${r.active ? "" : " · " + T("settings.paused")}</span></td>
              <td class="num ${r.amount >= 0 ? "amt-pos" : "amt-neg"}">${fmtMoney(r.amount)}</td>
              <td class="row-actions" style="justify-content:flex-end;">
                <button class="mini-btn" data-edit-rec="${r.id}">${T("common.edit")}</button>
                <button class="mini-btn danger" data-del-rec="${r.id}">${T("common.del")}</button>
              </td>
            </tr>`).join("")}
        </tbody>
      </table>` : `<div class="empty-state">${T("settings.noRecurring")}</div>`}
      <button class="btn secondary small" id="add-recurring" style="margin-top:10px;">${T("settings.addRecurring")}</button>
      ${db.data.recurring.length ? `<button class="btn secondary small" id="gen-recurring" style="margin-top:10px;">${T("settings.generate12")}</button>` : ""}
    </div>

    <div class="card">
      <h2>${T("settings.aiTitle")}</h2>
      <p style="color:var(--text-dim); font-size:13px; margin-top:-6px;">
        ${T("settings.aiHint")}
      </p>
      <div class="field">
        <label>${T("settings.apiKey")}</label>
        <input type="password" id="api-key" placeholder="sk-ant-..." value="${escapeHtml(getApiKey())}" autocomplete="off">
      </div>
      <div class="field">
        <label>${T("settings.model")}</label>
        <select id="ai-model">
          ${MODELS.map((m) => `<option value="${m.id}" ${m.id === getModel() ? "selected" : ""}>${escapeHtml(m.label)} — ${escapeHtml(T(m.note))}</option>`).join("")}
        </select>
      </div>
      <button class="btn secondary small" id="save-ai">${T("common.save")}</button>
      <div class="divider"></div>
      <p style="color:var(--text-dim); font-size:11px; line-height:1.5;">
        ${T("settings.aiKeyHelp")}<br><br>
        ${T("settings.aiWarning")}
        ${hasApiKey() ? `<br><br><span style="color:var(--accent);">${T("settings.aiOn")}</span>` : ""}
      </p>
    </div>

    <div class="card">
      <h2>${T("settings.backupTitle")}</h2>
      <p style="color:var(--text-dim); font-size:13px;">${T("settings.backupHint")}</p>
      <button class="btn" id="export-btn">${T("settings.export")}</button>
      <div style="height:10px;"></div>
      <label class="btn secondary" style="display:block; text-align:center; cursor:pointer;">
        ${T("settings.import")}
        <input type="file" id="import-input" accept="application/json" style="display:none;">
      </label>
    </div>

    <div class="card">
      <h2>${T("settings.dangerTitle")}</h2>
      <button class="btn danger" id="reset-btn">${T("settings.reset")}</button>
    </div>

    <p style="text-align:center; color:var(--text-dim); font-size:11px; margin-top:20px;">${T("settings.footer")}</p>
  `;

  // Changing the language redraws the whole app, this page included, so
  // there is nothing to re-render here afterwards.
  container.querySelectorAll("[data-set-lang]").forEach((btn) => {
    btn.addEventListener("click", () => setLang(btn.dataset.setLang));
  });

  container.querySelector("#save-ai").addEventListener("click", () => {
    setApiKey(container.querySelector("#api-key").value);
    setModel(container.querySelector("#ai-model").value);
    showToast(hasApiKey() ? T("settings.aiEnabled") : T("settings.aiCleared"));
    renderSettings(container);
  });

  container.querySelector("#add-recurring").addEventListener("click", () => openRecurringEditor(null, () => renderSettings(container)));
  container.querySelectorAll("[data-edit-rec]").forEach((b) => {
    b.addEventListener("click", () => openRecurringEditor(b.dataset.editRec, () => renderSettings(container)));
  });
  container.querySelectorAll("[data-del-rec]").forEach((b) => {
    b.addEventListener("click", () => confirmAction(T("settings.confirmRemoveRecurring"), () => {
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
    showToast(added ? T("settings.addedEntries", { n: added }) : T("settings.upToDate"));
    renderSettings(container);
  });

  // Same editor the opening row in Cash Position opens, so there is one place
  // the starting figure is set and no way for the two screens to disagree.
  container.querySelector("#edit-opening").addEventListener("click", () => {
    openOpeningEditor(() => renderSettings(container));
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
    showToast(T("settings.exported"));
  });

  container.querySelector("#import-input").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      confirmAction(T("settings.confirmImport"), () => {
        try {
          db.importJSON(reader.result);
          showToast(T("settings.imported"));
          window.location.hash = "#dashboard";
        } catch (err) {
          showToast(T("settings.badFile"));
        }
      });
    };
    reader.readAsText(file);
    e.target.value = "";
  });

  container.querySelector("#reset-btn").addEventListener("click", () => {
    confirmAction(T("settings.confirmReset"), () => {
      db.resetToSeed();
      showToast(T("settings.resetDone"));
      window.location.hash = "#dashboard";
    });
  });
}
