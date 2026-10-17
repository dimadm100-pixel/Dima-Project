import { db } from "../db.js";
import { t as T } from "../i18n.js";
import { fmtMoney, escapeHtml } from "../utils.js";
import { openSheet, closeSheet, confirmAction, field, numberInput, textInput, showToast } from "../ui.js";
import { effectiveRate, fxState } from "../fx.js";

const TABS = [
  { key: "marriage", label: "goals.marriage" },
  { key: "home", label: "goals.home" },
  { key: "umrah", label: "goals.umrah" }
];

export function renderGoals(container, subroute) {
  const active = TABS.some((t) => t.key === subroute) ? subroute : "marriage";

  container.innerHTML = `
    <div class="page-title">${T("nav.goals")}</div>
    <p class="page-sub">${T("goals.sub")}</p>
    <div class="tabs" id="goal-tabs">
      ${TABS.map((tab) => `<button class="${tab.key === active ? "active" : ""}" data-tab="${tab.key}">${T(tab.label)}</button>`).join("")}
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
  const rate = effectiveRate(g.fxRate);
  const reserveAnnualUZS = g.reserveAnnualUSD * rate;
  const targetMonthlyUZS = monthlyUZS + reserveAnnualUZS / 12;
  const usingLive = fxState().useLiveForGoals && Number.isFinite(fxState().rates?.USD?.rate);
  const pct = reserveAnnualUZS > 0 ? Math.min(100, Math.round((g.savedSoFar / reserveAnnualUZS) * 100)) : 0;

  body.innerHTML = `
    <div class="card">
      <h2>${T("goals.reserveProgress")}</h2>
      <div class="progress-bar"><div class="fill" style="width:${pct}%"></div></div>
      <p style="font-size:12px; color:var(--text-dim); margin-top:8px;">${T("goals.savedOfTarget", { saved: fmtMoney(g.savedSoFar), target: fmtMoney(reserveAnnualUZS), pct })}</p>
      <p style="font-size:11px; color:${usingLive ? "var(--accent-2)" : "var(--text-dim)"}; margin-top:4px;">
        ${T("goals.atRate", { usd: g.reserveAnnualUSD.toLocaleString("en-US"), rate: Math.round(rate).toLocaleString("en-US") })}
        ${usingLive ? "· " + T("goals.liveRate") : "· " + T("goals.fixedRate")}
      </p>
      <button class="btn secondary small" id="edit-saved" style="margin-top:8px;">${T("goals.updateSaved")}</button>
    </div>

    <div class="grid-2">
      <div class="stat"><div class="label">${T("goals.monthlyCost")}</div><div class="value">${fmtMoney(monthlyUZS)}</div></div>
      <div class="stat"><div class="label">${T("goals.annualCost")}</div><div class="value">${fmtMoney(annualUZS)}</div></div>
      <div class="stat"><div class="label">${T("goals.reserveTarget")}</div><div class="value">${fmtMoney(reserveAnnualUZS)}</div></div>
      <div class="stat"><div class="label">${T("goals.targetMonthlyIncome")}</div><div class="value">${fmtMoney(targetMonthlyUZS)}</div></div>
    </div>

    <div class="card">
      <h2>${T("goals.budgetBreakdown")}</h2>
      <table>
        <tbody>
          ${g.rows.map((r) => `
            <tr>
              <td>${escapeHtml(r.element)}<br><span style="color:var(--text-dim); font-size:11px;">${escapeHtml(r.type)}</span></td>
              <td class="num">${fmtMoney(r.costUZS)}</td>
              <td class="row-actions" style="justify-content:flex-end;">
                <button class="mini-btn" data-edit-row="${r.id}">${T("common.edit")}</button>
                <button class="mini-btn danger" data-del-row="${r.id}">${T("common.del")}</button>
              </td>
            </tr>`).join("")}
        </tbody>
      </table>
      <button class="btn secondary small" id="add-row" style="margin-top:10px;">+ Add line item</button>
    </div>

    <div class="card">
      <h2>${T("nav.settings")}</h2>
      <div class="field"><label>${T("goals.fxRate")}</label><input type="number" id="fx-rate" value="${g.fxRate}"></div>
      <div class="field"><label>${T("goals.reserveTargetUsd")}</label><input type="number" id="reserve-usd" value="${g.reserveAnnualUSD}"></div>
      <button class="btn secondary small" id="save-settings">${T("goals.saveSettings")}</button>
    </div>
  `;

  body.querySelector("#edit-saved").addEventListener("click", () => editSavedAmount("marriage", g.savedSoFar, () => renderGoals(container, "marriage")));
  body.querySelector("#add-row").addEventListener("click", () => editMarriageRow(null, () => renderGoals(container, "marriage")));
  body.querySelectorAll("[data-edit-row]").forEach((btn) => {
    btn.addEventListener("click", () => editMarriageRow(btn.dataset.editRow, () => renderGoals(container, "marriage")));
  });
  body.querySelectorAll("[data-del-row]").forEach((btn) => {
    btn.addEventListener("click", () => confirmAction(T("goals.confirmRemoveRow"), () => { db.deleteMarriageRow(btn.dataset.delRow); renderGoals(container, "marriage"); }));
  });
  body.querySelector("#save-settings").addEventListener("click", () => {
    const fx = parseFloat(body.querySelector("#fx-rate").value) || g.fxRate;
    const res = parseFloat(body.querySelector("#reserve-usd").value) || 0;
    db.updateGoalField("marriage", { fxRate: fx, reserveAnnualUSD: res });
    showToast(T("common.saved"));
    renderGoals(container, "marriage");
  });
}

function editMarriageRow(id, onDone) {
  const g = db.data.goals.marriage;
  const row = id ? g.rows.find((r) => r.id === id) : null;
  const form = document.createElement("div");
  const typeInput = textInput({ value: row?.type || T("common.expense") });
  const elementInput = textInput({ value: row?.element || "" });
  const costInput = numberInput({ value: row?.costUZS ?? "" });
  form.appendChild(field(T("common.type"), typeInput));
  form.appendChild(field(T("goals.description"), elementInput));
  form.appendChild(field(T("goals.monthlyCostAmount"), costInput));
  const btn = document.createElement("button");
  btn.className = "btn";
  btn.textContent = row ? T("common.save") : T("common.add");
  btn.addEventListener("click", () => {
    if (!elementInput.value.trim()) { showToast(T("goals.needDescription")); return; }
    const costUZS = parseFloat(costInput.value) || 0;
    const payload = { type: typeInput.value.trim() || T("common.expense"), element: elementInput.value.trim(), units: 1, costUZS, costUSD: costUZS / g.fxRate };
    if (row) db.updateMarriageRow(row.id, payload);
    else db.addMarriageRow(payload);
    closeSheet();
    onDone();
  });
  form.appendChild(btn);
  openSheet(row ? T("goals.editRow") : T("goals.addRow"), form);
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
          <div class="stat"><div class="label">${T("goals.totalPrice")}</div><div class="value">${fmtMoney(totalPrice)}</div></div>
          <div class="stat"><div class="label">${T("goals.initialPayment", { pct: Math.round(v.initialPct * 100) })}</div><div class="value">${fmtMoney(initial)}</div></div>
          <div class="stat"><div class="label">${T("goals.monthlyInstallment")}</div><div class="value">${fmtMoney(monthlyPayment)}</div></div>
          <div class="stat"><div class="label">${T("goals.over")}</div><div class="value">${T("goals.months", { n: v.months })}</div></div>
        </div>
        <div class="progress-bar" style="margin-top:12px;"><div class="fill" style="width:${p}%"></div></div>
        <p style="font-size:12px; color:var(--text-dim); margin-top:8px;">${T("goals.pctOfInitialSaved", { pct: p })}</p>
        <button class="btn secondary small" data-edit-variant="${i}" style="margin-top:10px;">${T("goals.editVariant")}</button>
      </div>
    `;
  }).join("");

  body.innerHTML = `
    <div class="card">
      <h2>${T("goals.savedSoFar")}</h2>
      <div class="stat" style="border:none; padding:0;"><div class="value">${fmtMoney(g.savedSoFar)}</div></div>
      <button class="btn secondary small" id="edit-saved" style="margin-top:10px;">${T("goals.updateSaved")}</button>
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
  form.appendChild(field(T("common.name"), nameInput));
  form.appendChild(field(T("goals.sqm"), sqmInput));
  form.appendChild(field(T("goals.pricePerSqm"), priceInput));
  form.appendChild(field(T("goals.initialPct"), initialInput));
  form.appendChild(field(T("goals.markupPct"), markupInput));
  form.appendChild(field(T("goals.installmentMonths"), monthsInput));
  const btn = document.createElement("button");
  btn.className = "btn";
  btn.textContent = T("common.save");
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
  openSheet(T("goals.editVariant"), form);
}

// ---------------- Umrah ----------------
function renderUmrah(body, container) {
  const g = db.data.goals.umrah;
  const totalUSD = g.amountUSD * g.people + g.bufferUSD;
  const umrahRate = effectiveRate(g.fxRate);
  const totalUZS = totalUSD * umrahRate;
  const pct = totalUZS > 0 ? Math.min(100, Math.round((g.savedSoFar / totalUZS) * 100)) : 0;

  body.innerHTML = `
    <div class="card">
      <h2>${T("goals.progress")}</h2>
      <div class="progress-bar"><div class="fill" style="width:${pct}%"></div></div>
      <p style="font-size:12px; color:var(--text-dim); margin-top:8px;">${T("goals.savedOf", { saved: fmtMoney(g.savedSoFar), total: fmtMoney(totalUZS), pct })}</p>
      <button class="btn secondary small" id="edit-saved" style="margin-top:8px;">${T("goals.updateSaved")}</button>
    </div>

    <div class="grid-2">
      <div class="stat"><div class="label">${T("goals.perPerson")}</div><div class="value">$${g.amountUSD}</div></div>
      <div class="stat"><div class="label">${T("goals.people")}</div><div class="value">${g.people}</div></div>
      <div class="stat"><div class="label">${T("goals.buffer")}</div><div class="value">$${g.bufferUSD}</div></div>
      <div class="stat"><div class="label">${T("common.total")}</div><div class="value">${fmtMoney(totalUZS)}</div></div>
    </div>

    <div class="card">
      <h2>${T("nav.settings")}</h2>
      <div class="field"><label>${T("goals.amountPerPerson")}</label><input type="number" id="amt" value="${g.amountUSD}"></div>
      <div class="field"><label>${T("goals.numberOfPeople")}</label><input type="number" id="people" value="${g.people}"></div>
      <div class="field"><label>${T("goals.bufferUsd")}</label><input type="number" id="buffer" value="${g.bufferUSD}"></div>
      <div class="field"><label>${T("goals.fxRate")}</label><input type="number" id="fx" value="${g.fxRate}"></div>
      <button class="btn secondary small" id="save-settings">${T("goals.saveSettings")}</button>
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
    showToast(T("common.saved"));
    renderGoals(container, "umrah");
  });
}

// ---------------- shared ----------------
function editSavedAmount(goalKey, current, onDone) {
  const form = document.createElement("div");
  const input = numberInput({ value: current });
  form.appendChild(field(T("goals.amountSaved"), input));
  const btn = document.createElement("button");
  btn.className = "btn";
  btn.textContent = T("common.save");
  btn.addEventListener("click", () => {
    db.updateGoalField(goalKey, { savedSoFar: parseFloat(input.value) || 0 });
    closeSheet();
    onDone();
  });
  form.appendChild(btn);
  openSheet(T("goals.updateSaved"), form);
}
