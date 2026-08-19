import { db } from "../db.js";
import { fmtMoney, fmtDate, todayStr, escapeHtml, svgSparkline } from "../utils.js";
import { openSheet, closeSheet, confirmAction, field, numberInput, dateInput, textInput, showToast } from "../ui.js";

export function renderTargets(container) {
  const t = db.data.targets;
  const balance = db.currentBalance();
  const latest = t.checkpoints[t.checkpoints.length - 1];

  container.innerHTML = `
    <div class="page-title">Targets</div>
    <p class="page-sub">Checkpoints of where you wanted to be, tracked over time against where you are.</p>

    <div class="card hero-balance">
      <div class="label">Current cash balance</div>
      <div class="amount">${fmtMoney(balance)}</div>
    </div>

    <div class="card">
      <h2>Targets</h2>
      <table>
        <thead><tr><th>Name</th><th>Due</th><th class="num">Latest checkpoint</th></tr></thead>
        <tbody>
          ${t.defs.map((d, i) => `
            <tr>
              <td>${escapeHtml(d.name)}</td>
              <td>${fmtDate(d.due)}</td>
              <td class="num">${latest ? fmtMoney(latest["target" + (i + 1)]) : "—"}</td>
            </tr>`).join("")}
        </tbody>
      </table>
      <button class="btn secondary small" id="edit-defs" style="margin-top:10px;">Edit target due dates</button>
    </div>

    <div class="card">
      <h2>Progress over time</h2>
      ${t.checkpoints.length > 1 ? t.defs.map((d, i) => `
        <div style="margin-bottom:14px;">
          <div style="font-size:12px; color:var(--text-dim); margin-bottom:4px;">${escapeHtml(d.name)}</div>
          ${svgSparkline(t.checkpoints.map((c) => ({ value: c["target" + (i + 1)] || 0 })), { height: 44 })}
        </div>
      `).join("") : `<div class="empty-state">Log at least two checkpoints to see a trend.</div>`}
    </div>

    <div class="card">
      <h2>Checkpoint history</h2>
      ${t.checkpoints.length ? `
      <table>
        <thead><tr><th>Date</th><th class="num">T1</th><th class="num">T2</th><th class="num">T3</th><th class="num">T4</th><th></th></tr></thead>
        <tbody>
          ${t.checkpoints.map((c, i) => `
            <tr>
              <td>${fmtDate(c.date)}</td>
              <td class="num">${c.target1 != null ? fmtMoney(c.target1) : "—"}</td>
              <td class="num">${c.target2 != null ? fmtMoney(c.target2) : "—"}</td>
              <td class="num">${c.target3 != null ? fmtMoney(c.target3) : "—"}</td>
              <td class="num">${c.target4 != null ? fmtMoney(c.target4) : "—"}</td>
              <td><button class="mini-btn danger" data-del-checkpoint="${i}">Del</button></td>
            </tr>`).join("")}
        </tbody>
      </table>` : `<div class="empty-state">No checkpoints logged yet.</div>`}
      <button class="btn secondary small" id="add-checkpoint" style="margin-top:10px;">+ Add checkpoint</button>
    </div>
  `;

  container.querySelector("#edit-defs").addEventListener("click", () => openDefsEditor(() => renderTargets(container)));
  container.querySelector("#add-checkpoint").addEventListener("click", () => openCheckpointEditor(() => renderTargets(container)));
  container.querySelectorAll("[data-del-checkpoint]").forEach((btn) => {
    btn.addEventListener("click", () => {
      confirmAction("Remove this checkpoint?", () => {
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
    form.appendChild(field("Name", nameInput));
    form.appendChild(field("Due date", dueInput));
    return { nameInput, dueInput, original: d.name };
  });
  const btn = document.createElement("button");
  btn.className = "btn";
  btn.textContent = "Save";
  btn.addEventListener("click", () => {
    inputs.forEach(({ nameInput, dueInput, original }) => {
      db.updateTargetDef(original, { name: nameInput.value.trim(), due: dueInput.value });
    });
    closeSheet();
    onDone();
  });
  form.appendChild(btn);
  openSheet("Edit targets", form);
}

function openCheckpointEditor(onDone) {
  const form = document.createElement("div");
  const dateEl = dateInput({ value: todayStr() });
  const t1 = numberInput({ placeholder: "Target 1 amount" });
  const t2 = numberInput({ placeholder: "Target 2 amount" });
  const t3 = numberInput({ placeholder: "Target 3 amount" });
  const t4 = numberInput({ placeholder: "Target 4 amount" });
  form.appendChild(field("Date", dateEl));
  form.appendChild(field("Target 1", t1));
  form.appendChild(field("Target 2", t2));
  form.appendChild(field("Target 3", t3));
  form.appendChild(field("Target 4", t4));
  const btn = document.createElement("button");
  btn.className = "btn";
  btn.textContent = "Add checkpoint";
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
    showToast("Checkpoint added");
  });
  form.appendChild(btn);
  openSheet("Add checkpoint", form);
}
