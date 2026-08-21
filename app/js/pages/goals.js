import { db } from "../db.js";
import { fmtMoney, escapeHtml } from "../utils.js";
import { openSheet, closeSheet, confirmAction, field, numberInput, textInput, showToast } from "../ui.js";

const TABS = [
  { key: "marriage", label: "Marriage" },
  { key: "home", label: "Home" },
  { key: "umrah", label: "Umrah" }
];

export function renderGoals(container, subroute) {
  const active = TABS.some((t) => t.key === subroute) ? subroute : "marriage";

  container.innerHTML = `
    <div class="page-title">Goals</div>
    <p class="page-sub">The big three you're planning toward.</p>
    <div class="tabs" id="goal-tabs">
      ${TABS.map((t) => `<button class="${t.key === active ? "active" : ""}" data-tab="${t.key}">${t.label}</button>`).join("")}
    </div>
    <div id="goal-body"></div>
  `;

  container.querySelectorAll("#goal-tabs button").forEach((btn) => {
    btn.addEventListener("click", () => { window.location.hash = `#goals/${btn.dataset.tab}`; });
  });

  const body = container.querySelector("#goal-body");
  if (active === "marriage") renderMarriage(body, container);
  else if (active === "home") renderHome(body, container);
  else renderUmrah(body, container);
}

// ---------------- Marriage ----------------
function renderMarriage(body, container) {
  const g = db.data.goals.marriage;
  const monthlyUZS = g.rows.reduce((s, r) => s + r.costUZS, 0);
  const annualUZS = monthlyUZS * 12;
  const reserveAnnualUZS = g.reserveAnnualUSD * g.fxRate;
  const targetMonthlyUZS = monthlyUZS + reserveAnnualUZS / 12;
  const pct = reserveAnnualUZS > 0 ? Math.min(100, Math.round((g.savedSoFar / reserveAnnualUZS) * 100)) : 0;

  body.innerHTML = `
    <div class="card">
      <h2>Reserve fund progress</h2>
      <div class="progress-bar"><div class="fill" style="width:${pct}%"></div></div>
      <p style="font-size:12px; color:var(--text-dim); margin-top:8px;">${fmtMoney(g.savedSoFar)} saved of ${fmtMoney(reserveAnnualUZS)} target (${pct}%)</p>
      <button class="btn secondary small" id="edit-saved" style="margin-top:8px;">Update saved amount</button>
    </div>

    <div class="grid-2">
      <div class="stat"><div class="label">Monthly cost</div><div class="value">${fmtMoney(monthlyUZS)}</div></div>
      <div class="stat"><div class="label">Annual cost</div><div class="value">${fmtMoney(annualUZS)}</div></div>
      <div class="stat"><div class="label">Reserve target</div><div class="value">${fmtMoney(reserveAnnualUZS)}</div></div>
      <div class="stat"><div class="label">Target monthly income</div><div class="value">${fmtMoney(targetMonthlyUZS)}</div></div>
    </div>

    <div class="card">
      <h2>Budget breakdown</h2>
      <table>
        <tbody>
          ${g.rows.map((r) => `
            <tr>
              <td>${escapeHtml(r.element)}<br><span style="color:var(--text-dim); font-size:11px;">${escapeHtml(r.type)}</span></td>
              <td class="num">${fmtMoney(r.costUZS)}</td>
              <td class="row-actions" style="justify-content:flex-end;">
                <button class="mini-btn" data-edit-row="${r.id}">Edit</button>
                <button class="mini-btn danger" data-del-row="${r.id}">Del</button>
              </td>
            </tr>`).join("")}
        </tbody>
      </table>
      <button class="btn secondary small" id="add-row" style="margin-top:10px;">+ Add line item</button>
    </div>

    <div class="card">
      <h2>Settings</h2>
      <div class="field"><label>FX rate (UZS per USD)</label><input type="number" id="fx-rate" value="${g.fxRate}"></div>
      <div class="field"><label>Reserve target (USD)</label><input type="number" id="reserve-usd" value="${g.reserveAnnualUSD}"></div>
      <button class="btn secondary small" id="save-settings">Save settings</button>
    </div>
  `;

  body.querySelector("#edit-saved").addEventListener("click", () => editSavedAmount("marriage", g.savedSoFar, () => renderGoals(container, "marriage")));
  body.querySelector("#add-row").addEventListener("click", () => editMarriageRow(null, () => renderGoals(container, "marriage")));
  body.querySelectorAll("[data-edit-row]").forEach((btn) => {
    btn.addEventListener("click", () => editMarriageRow(btn.dataset.editRow, () => renderGoals(container, "marriage")));
  });
  body.querySelectorAll("[data-del-row]").forEach((btn) => {
    btn.addEventListener("click", () => confirmAction("Remove this line item?", () => { db.deleteMarriageRow(btn.dataset.delRow); renderGoals(container, "marriage"); }));
  });
  body.querySelector("#save-settings").addEventListener("click", () => {
    const fx = parseFloat(body.querySelector("#fx-rate").value) || g.fxRate;
    const res = parseFloat(body.querySelector("#reserve-usd").value) || 0;
    db.updateGoalField("marriage", { fxRate: fx, reserveAnnualUSD: res });
    showToast("Saved");
    renderGoals(container, "marriage");
  });
}

function editMarriageRow(id, onDone) {
  const g = db.data.goals.marriage;
  const row = id ? g.rows.find((r) => r.id === id) : null;
  const form = document.createElement("div");
  const typeInput = textInput({ value: row?.type || "Expense" });
  const elementInput = textInput({ value: row?.element || "" });
  const costInput = numberInput({ value: row?.costUZS ?? "" });
  form.appendChild(field("Type", typeInput));
  form.appendChild(field("Description", elementInput));
  form.appendChild(field("Monthly cost (UZS)", costInput));
  const btn = document.createElement("button");
  btn.className = "btn";
  btn.textContent = row ? "Save" : "Add";
  btn.addEventListener("click", () => {
    if (!elementInput.value.trim()) { showToast("Enter a description"); return; }
    const costUZS = parseFloat(costInput.value) || 0;
    const payload = { type: typeInput.value.trim() || "Expense", element: elementInput.value.trim(), units: 1, costUZS, costUSD: costUZS / g.fxRate };
    if (row) db.updateMarriageRow(row.id, payload);
    else db.addMarriageRow(payload);
    closeSheet();
    onDone();
  });
  form.appendChild(btn);
  openSheet(row ? "Edit line item" : "Add line item", form);
}

// ---------------- Home ----------------
function renderHome(body, container) {
  const g = db.data.goals.home;
  const pct = (target) => (target > 0 ? Math.min(100, Math.round((g.savedSoFar / target) * 100)) : 0);

  const cards = g.variants.map((v, i) => {
    const totalPrice = v.sqm * v.pricePerSqmMlnUZS * 1_000_000;
    const initial = v.initialPct * totalPrice;
    const monthlyPayment = ((1 - v.initialPct) * totalPrice) / v.months * (1 + v.markupPct);
    const p = pct(initial);
    return `
      <div class="card">
        <h2>${escapeHtml(v.name)}</h2>
        <div class="grid-2">
          <div class="stat"><div class="label">Total price</div><div class="value">${fmtMoney(totalPrice)}</div></div>
          <div class="stat"><div class="label">Initial payment (${Math.round(v.initialPct * 100)}%)</div><div class="value">${fmtMoney(initial)}</div></div>
          <div class="stat"><div class="label">Monthly installment</div><div class="value">${fmtMoney(monthlyPayment)}</div></div>
          <div class="stat"><div class="label">Over</div><div class="value">${v.months} mo</div></div>
        </div>
        <div class="progress-bar" style="margin-top:12px;"><div class="fill" style="width:${p}%"></div></div>
        <p style="font-size:12px; color:var(--text-dim); margin-top:8px;">${p}% of initial payment saved</p>
        <button class="btn secondary small" data-edit-variant="${i}" style="margin-top:10px;">Edit variant</button>
      </div>
    `;
  }).join("");

  body.innerHTML = `
    <div class="card">
      <h2>Saved so far</h2>
      <div class="stat" style="border:none; padding:0;"><div class="value">${fmtMoney(g.savedSoFar)}</div></div>
      <button class="btn secondary small" id="edit-saved" style="margin-top:10px;">Update saved amount</button>
    </div>
    ${cards}
  `;

  body.querySelector("#edit-saved").addEventListener("click", () => editSavedAmount("home", g.savedSoFar, () => renderGoals(container, "home")));
  body.querySelectorAll("[data-edit-variant]").forEach((btn) => {
    btn.addEventListener("click", () => editHomeVariant(Number(btn.dataset.editVariant), () => renderGoals(container, "home")));
  });
}

function editHomeVariant(index, onDone) {
  const v = db.data.goals.home.variants[index];
  const form = document.createElement("div");
  const nameInput = textInput({ value: v.name });
  const sqmInput = numberInput({ value: v.sqm });
  const priceInput = numberInput({ value: v.pricePerSqmMlnUZS });
  const initialInput = numberInput({ value: Math.round(v.initialPct * 100) });
  const markupInput = numberInput({ value: Math.round(v.markupPct * 100) });
  const monthsInput = numberInput({ value: v.months });
  form.appendChild(field("Name", nameInput));
  form.appendChild(field("Square meters", sqmInput));
  form.appendChild(field("Price per sqm (million UZS)", priceInput));
  form.appendChild(field("Initial payment %", initialInput));
  form.appendChild(field("Markup %", markupInput));
  form.appendChild(field("Installment months", monthsInput));
  const btn = document.createElement("button");
  btn.className = "btn";
  btn.textContent = "Save";
  btn.addEventListener("click", () => {
    db.updateHomeVariant(index, {
      name: nameInput.value.trim(),
      sqm: parseFloat(sqmInput.value) || 0,
      pricePerSqmMlnUZS: parseFloat(priceInput.value) || 0,
      initialPct: (parseFloat(initialInput.value) || 0) / 100,
      markupPct: (parseFloat(markupInput.value) || 0) / 100,
      months: parseInt(monthsInput.value) || 1
    });
    closeSheet();
    onDone();
  });
  form.appendChild(btn);
  openSheet("Edit variant", form);
}

// ---------------- Umrah ----------------
function renderUmrah(body, container) {
  const g = db.data.goals.umrah;
  const totalUSD = g.amountUSD * g.people + g.bufferUSD;
  const totalUZS = totalUSD * g.fxRate;
  const pct = totalUZS > 0 ? Math.min(100, Math.round((g.savedSoFar / totalUZS) * 100)) : 0;

  body.innerHTML = `
    <div class="card">
      <h2>Progress</h2>
      <div class="progress-bar"><div class="fill" style="width:${pct}%"></div></div>
      <p style="font-size:12px; color:var(--text-dim); margin-top:8px;">${fmtMoney(g.savedSoFar)} saved of ${fmtMoney(totalUZS)} (${pct}%)</p>
      <button class="btn secondary small" id="edit-saved" style="margin-top:8px;">Update saved amount</button>
    </div>

    <div class="grid-2">
      <div class="stat"><div class="label">Per person</div><div class="value">$${g.amountUSD}</div></div>
      <div class="stat"><div class="label">People</div><div class="value">${g.people}</div></div>
      <div class="stat"><div class="label">Buffer</div><div class="value">$${g.bufferUSD}</div></div>
      <div class="stat"><div class="label">Total</div><div class="value">${fmtMoney(totalUZS)}</div></div>
    </div>

    <div class="card">
      <h2>Settings</h2>
      <div class="field"><label>Amount per person (USD)</label><input type="number" id="amt" value="${g.amountUSD}"></div>
      <div class="field"><label>Number of people</label><input type="number" id="people" value="${g.people}"></div>
      <div class="field"><label>Buffer (USD)</label><input type="number" id="buffer" value="${g.bufferUSD}"></div>
      <div class="field"><label>FX rate (UZS per USD)</label><input type="number" id="fx" value="${g.fxRate}"></div>
      <button class="btn secondary small" id="save-settings">Save settings</button>
    </div>
  `;

  body.querySelector("#edit-saved").addEventListener("click", () => editSavedAmount("umrah", g.savedSoFar, () => renderGoals(container, "umrah")));
  body.querySelector("#save-settings").addEventListener("click", () => {
    db.updateGoalField("umrah", {
      amountUSD: parseFloat(body.querySelector("#amt").value) || 0,
      people: parseInt(body.querySelector("#people").value) || 1,
      bufferUSD: parseFloat(body.querySelector("#buffer").value) || 0,
      fxRate: parseFloat(body.querySelector("#fx").value) || g.fxRate
    });
    showToast("Saved");
    renderGoals(container, "umrah");
  });
}

// ---------------- shared ----------------
function editSavedAmount(goalKey, current, onDone) {
  const form = document.createElement("div");
  const input = numberInput({ value: current });
  form.appendChild(field("Amount saved so far (UZS)", input));
  const btn = document.createElement("button");
  btn.className = "btn";
  btn.textContent = "Save";
  btn.addEventListener("click", () => {
    db.updateGoalField(goalKey, { savedSoFar: parseFloat(input.value) || 0 });
    closeSheet();
    onDone();
  });
  form.appendChild(btn);
  openSheet("Update saved amount", form);
}
