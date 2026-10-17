import { db } from "../db.js";
import { t as T } from "../i18n.js";
import { fmtMoney, fmtDate, todayStr, escapeHtml, svgSparkline } from "../utils.js";
import { openSheet, closeSheet, confirmAction, field, numberInput, dateInput, textInput, showToast } from "../ui.js";

export function renderTargets(container) {
  const t = db.data.targets;
  const balance = db.currentBalance();
  const latest = t.checkpoints[t.checkpoints.length - 1];

  container.innerHTML = `
    <div class="page-title">${T("targets.title")}</div>
    <p class="page-sub">${T("targets.sub")}</p>

    <div class="card hero-balance">
      <div class="label">${T("targets.currentBalance")}</div>
      <div class="amount">${fmtMoney(balance)}</div>
    </div>

    <div class="card">
      <h2>${T("targets.title")}</h2>
      <table>
        <thead><tr><th>${T("common.name")}</th><th>${T("targets.due")}</th><th class="num">${T("targets.latestCheckpoint")}</th></tr></thead>
        <tbody>
          ${t.defs.map((d, i) => `
            <tr>
              <td>${escapeHtml(d.name)}</td>
              <td>${fmtDate(d.due)}</td>
              <td class="num">${latest ? fmtMoney(latest["target" + (i + 1)]) : "—"}</td>
            </tr>`).join("")}
        </tbody>
      </table>
      <button class="btn secondary small" id="edit-defs" style="margin-top:10px;">${T("targets.editDueDates")}</button>
    </div>

    <div class="card">
      <h2>${T("targets.progressOverTime")}</h2>
      ${t.checkpoints.length > 1 ? t.defs.map((d, i) => `
        <div style="margin-bottom:14px;">
          <div style="font-size:12px; color:var(--text-dim); margin-bottom:4px;">${escapeHtml(d.name)}</div>
          ${svgSparkline(t.checkpoints.map((c) => ({ value: c["target" + (i + 1)] || 0 })), { height: 44 })}
        </div>
      `).join("") : `<div class="empty-state">${T("targets.needTwoCheckpoints")}</div>`}
    </div>

    <div class="card">
      <h2>${T("targets.checkpointHistory")}</h2>
      ${t.checkpoints.length ? `
      <table>
        <thead><tr><th>${T("common.date")}</th><th class="num">T1</th><th class="num">T2</th><th class="num">T3</th><th class="num">T4</th><th></th></tr></thead>
        <tbody>
          ${t.checkpoints.map((c, i) => `
            <tr>
              <td>${fmtDate(c.date)}</td>
              <td class="num">${c.target1 != null ? fmtMoney(c.target1) : "—"}</td>
              <td class="num">${c.target2 != null ? fmtMoney(c.target2) : "—"}</td>
              <td class="num">${c.target3 != null ? fmtMoney(c.target3) : "—"}</td>
              <td class="num">${c.target4 != null ? fmtMoney(c.target4) : "—"}</td>
              <td><button class="mini-btn danger" data-del-checkpoint="${i}">${T("common.del")}</button></td>
            </tr>`).join("")}
        </tbody>
      </table>` : `<div class="empty-state">${T("targets.noCheckpoints")}</div>`}
      <button class="btn secondary small" id="add-checkpoint" style="margin-top:10px;">+ Add checkpoint</button>
    </div>
  `;

  container.querySelector("#edit-defs").addEventListener("click", () => openDefsEditor(() => renderTargets(container)));
  container.querySelector("#add-checkpoint").addEventListener("click", () => openCheckpointEditor(() => renderTargets(container)));
  container.querySelectorAll("[data-del-checkpoint]").forEach((btn) => {
    btn.addEventListener("click", () => {
      confirmAction(T("targets.confirmRemoveCheckpoint"), () => {
        db.data.targets.checkpoints.splice(Number(btn.dataset.delCheckpoint), 1);
        db.save();
        renderTargets(container);
      });
    });
  });
}

function openDefsEditor(onDone) {
  const defs = db.data.targets.defs;
  const form = document.createElement("div");
  const inputs = defs.map((d) => {
    const nameInput = textInput({ value: d.name });
    const dueInput = dateInput({ value: d.due });
    form.appendChild(field(T("common.name"), nameInput));
    form.appendChild(field(T("targets.dueDate"), dueInput));
    return { nameInput, dueInput, original: d.name };
  });
  const btn = document.createElement("button");
  btn.className = "btn";
  btn.textContent = T("common.save");
  btn.addEventListener("click", () => {
    inputs.forEach(({ nameInput, dueInput, original }) => {
      db.updateTargetDef(original, { name: nameInput.value.trim(), due: dueInput.value });
    });
    closeSheet();
    onDone();
  });
  form.appendChild(btn);
  openSheet(T("targets.editTargets"), form);
}

function openCheckpointEditor(onDone) {
  const form = document.createElement("div");
  const dateEl = dateInput({ value: todayStr() });
  const t1 = numberInput({ placeholder: T("targets.amountPlaceholder", { n: 1 }) });
  const t2 = numberInput({ placeholder: T("targets.amountPlaceholder", { n: 2 }) });
  const t3 = numberInput({ placeholder: T("targets.amountPlaceholder", { n: 3 }) });
  const t4 = numberInput({ placeholder: T("targets.amountPlaceholder", { n: 4 }) });
  form.appendChild(field(T("common.date"), dateEl));
  form.appendChild(field(T("targets.targetN", { n: 1 }), t1));
  form.appendChild(field(T("targets.targetN", { n: 2 }), t2));
  form.appendChild(field(T("targets.targetN", { n: 3 }), t3));
  form.appendChild(field(T("targets.targetN", { n: 4 }), t4));
  const btn = document.createElement("button");
  btn.className = "btn";
  btn.textContent = T("targets.addCheckpoint");
  btn.addEventListener("click", () => {
    db.addTargetCheckpoint({
      date: dateEl.value || todayStr(),
      target1: t1.value ? parseFloat(t1.value) : null,
      target2: t2.value ? parseFloat(t2.value) : null,
      target3: t3.value ? parseFloat(t3.value) : null,
      target4: t4.value ? parseFloat(t4.value) : null
    });
    closeSheet();
    onDone();
    showToast(T("targets.checkpointAdded"));
  });
  form.appendChild(btn);
  openSheet(T("targets.addCheckpoint"), form);
}
