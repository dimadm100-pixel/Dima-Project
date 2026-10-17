import { db } from "../db.js";
import { t as T } from "../i18n.js";
import {
  buildBudgetPlan, findLeaks, goalStatus, requiredMonthly,
  detectRecurring, averageMonthlySurplus
} from "../planner.js";
import { fmtMoney, fmtMoneyShort, fmtMonth, fmtDate, todayStr, addMonths, escapeHtml, el } from "../utils.js";
import { openSheet, closeSheet, showToast } from "../ui.js";

const TABS = [
  { key: "budget", label: "planner.tabBudget" },
  { key: "leaks", label: "planner.tabLeaks" },
  { key: "goals", label: "nav.goals" },
  { key: "bills", label: "planner.tabBills" }
];

let activeTab = "budget";
let cuts = {}; // category -> percent to trim, for the what-if sliders

export function renderPlanner(container) {
  container.innerHTML = `
    <div class="page-title">${T("nav.planner")}</div>
    <p class="page-sub">${T("planner.sub")}</p>
    <div class="tabs" id="planner-tabs">
      ${TABS.map((t) => `<button class="${t.key === activeTab ? "active" : ""}" data-tab="${t.key}">${T(t.label)}</button>`).join("")}
    </div>
    <div id="planner-body"></div>
  `;

  container.querySelectorAll("#planner-tabs button").forEach((b) => {
    b.addEventListener("click", () => { activeTab = b.dataset.tab; renderPlanner(container); });
  });

  const body = container.querySelector("#planner-body");
  if (activeTab === "budget") renderBudgetTab(body, container);
  else if (activeTab === "leaks") renderLeaksTab(body, container);
  else if (activeTab === "goals") renderGoalsTab(body, container);
  else renderBillsTab(body, container);
}

// ------------------------------------------------------------ build budget

// Edits the user makes to the learned amounts, kept while the page is open.
let overrides = {};

function renderBudgetTab(body, container) {
  const defaultStart = addMonths(todayStr().slice(0, 7), 1);
  const patterns = buildBudgetPlan({ startMonth: defaultStart, monthCount: 1 }).patterns;

  if (!patterns.length) {
    body.innerHTML = `<div class="card"><div class="empty-state">
      Nothing to learn from yet. Log a few weeks of real spending, or add recurring items in Settings, and this can build you a budget.
    </div></div>`;
    return;
  }

  const valueFor = (p) => {
    const o = overrides[p.category];
    return o && o.monthlyTotal !== undefined ? o.monthlyTotal : Math.round(p.monthlyTotal);
  };
  const dayFor = (p) => {
    const o = overrides[p.category];
    return o && o.typicalDay !== undefined ? o.typicalDay : p.typicalDay;
  };
  const enabledFor = (p) => !(overrides[p.category] && overrides[p.category].enabled === false);

  body.innerHTML = `
    <div class="card">
      <h2>${T("planner.monthlyPlan")}</h2>
      <p style="color:var(--text-dim); font-size:12px; margin-top:-6px;">
        Starting figures are your median month — the middle one, so a single odd month doesn't skew things.
        ${T("planner.changeHint")}
      </p>
      <div id="pattern-rows">
        ${patterns.map((p) => `
          <div class="pattern-row" data-cat="${escapeHtml(p.category)}" style="padding:10px 0; border-bottom:1px solid var(--border); ${enabledFor(p) ? "" : "opacity:0.4;"}">
            <div style="display:flex; align-items:center; gap:10px; margin-bottom:8px;">
              <input type="checkbox" data-enabled="${escapeHtml(p.category)}" ${enabledFor(p) ? "checked" : ""}>
              <span style="font-size:14px; font-weight:600; flex:1;">${escapeHtml(p.category)}</span>
              <span style="font-size:11px; color:var(--text-dim);">${p.perMonthCount > 3 ? "spread weekly" : "one entry"}</span>
            </div>
            <div style="display:flex; gap:8px;">
              <div style="flex:2;">
                <label style="font-size:11px; color:var(--text-dim);">${T("planner.amountPerMonth")}</label>
                <input type="number" data-amount="${escapeHtml(p.category)}" value="${valueFor(p)}" step="10000">
              </div>
              <div style="flex:1;">
                <label style="font-size:11px; color:var(--text-dim);">Day</label>
                <input type="number" data-day="${escapeHtml(p.category)}" value="${dayFor(p)}" min="1" max="28" ${p.perMonthCount > 3 ? "disabled" : ""}>
              </div>
            </div>
          </div>`).join("")}
      </div>
      <div style="display:flex; justify-content:space-between; align-items:center; margin-top:14px;">
        <span style="font-size:13px; color:var(--text-dim);">${T("planner.netPerMonth")}</span>
        <strong id="net-preview" style="font-size:16px;"></strong>
      </div>
      <button class="btn secondary small" id="reset-overrides" style="margin-top:12px;">${T("planner.resetOverrides")}</button>
    </div>

    <div class="card">
      <h2>${T("planner.generate")}</h2>
      <div class="field-row">
        <div class="field"><label>${T("planner.startMonth")}</label><input type="month" id="start-month" value="${defaultStart}"></div>
        <div class="field"><label>${T("planner.howManyMonths")}</label><input type="number" id="month-count" value="12" min="1" max="36"></div>
      </div>
      <label style="display:flex; gap:10px; align-items:flex-start; font-size:13px; color:var(--text-dim); margin-bottom:14px;">
        <input type="checkbox" id="replace-existing" style="width:auto; margin-top:2px;">
        <span>${T("planner.replaceExisting")}</span>
      </label>
      <button class="btn" id="preview-budget">${T("planner.previewBudget")}</button>
    </div>
  `;

  const updateNet = () => {
    let net = 0;
    for (const p of patterns) {
      if (!enabledFor(p)) continue;
      net += Number(valueFor(p)) || 0;
    }
    const slot = body.querySelector("#net-preview");
    slot.textContent = fmtMoney(net);
    slot.style.color = net >= 0 ? "var(--accent)" : "var(--danger)";
  };

  const ensure = (cat) => (overrides[cat] = overrides[cat] || {});

  body.querySelectorAll("[data-amount]").forEach((input) => {
    input.addEventListener("input", () => {
      ensure(input.dataset.amount).monthlyTotal = Number(input.value) || 0;
      updateNet();
    });
  });
  body.querySelectorAll("[data-day]").forEach((input) => {
    input.addEventListener("input", () => {
      ensure(input.dataset.day).typicalDay = Math.min(28, Math.max(1, Number(input.value) || 1));
    });
  });
  body.querySelectorAll("[data-enabled]").forEach((box) => {
    box.addEventListener("change", () => {
      ensure(box.dataset.enabled).enabled = box.checked;
      const row = body.querySelector(`.pattern-row[data-cat="${CSS.escape(box.dataset.enabled)}"]`);
      if (row) row.style.opacity = box.checked ? "" : "0.4";
      updateNet();
    });
  });
  body.querySelector("#reset-overrides").addEventListener("click", () => {
    overrides = {};
    renderPlanner(container);
    showToast(T("planner.resetDone"));
  });

  updateNet();

  body.querySelector("#preview-budget").addEventListener("click", () => {
    const startMonth = body.querySelector("#start-month").value || defaultStart;
    const monthCount = Math.max(1, Math.min(36, parseInt(body.querySelector("#month-count").value) || 12));
    const replaceExisting = body.querySelector("#replace-existing").checked;
    const plan = buildBudgetPlan({ startMonth, monthCount, replaceExisting, overrides });
    if (!plan.operations.some((o) => o.action === "add_budget")) {
      showToast(T("planner.nothingEnabled"));
      return;
    }
    showProposal(container, {
      title: T("planner.budgetFor", { from: fmtMonth(plan.months[0]), to: fmtMonth(plan.months[plan.months.length - 1]) }),
      summary: summarizePlan(plan),
      operations: plan.operations
    });
  });
}

function summarizePlan(plan) {
  const adds = plan.operations.filter((o) => o.action === "add_budget");
  const dels = plan.operations.filter((o) => o.action === "delete_budget");
  const income = adds.filter((o) => o.amount > 0).reduce((s, o) => s + o.amount, 0);
  const expense = adds.filter((o) => o.amount < 0).reduce((s, o) => s + Math.abs(o.amount), 0);
  const perMonth = plan.months.length;
  const parts = [
    T("planner.entriesAcross", { n: adds.length, months: perMonth }),
    T("planner.incomeIs", { amount: fmtMoney(income) }),
    T("planner.expensesAre", { amount: fmtMoney(expense) }),
    T("planner.netIs", { amount: fmtMoney(income - expense) })
  ];
  if (dels.length) parts.push(T("planner.replacesN", { n: dels.length }));
  return parts.join(" · ");
}

// -------------------------------------------------------------- find leaks

function renderLeaksTab(body, container) {
  const leaks = findLeaks();
  const surplus = averageMonthlySurplus();

  if (!leaks.length) {
    body.innerHTML = `<div class="card"><div class="empty-state">
      ${T("planner.notEnoughHistory")}
    </div></div>`;
    return;
  }

  const totalOpportunity = leaks.reduce((s, l) => s + l.monthlySaving, 0);

  body.innerHTML = `
    <div class="card hero-balance">
      <div class="label">${T("planner.bestMonthLabel")}</div>
      <div class="amount" style="color:var(--accent);">${fmtMoney(totalOpportunity)}</div>
      <div class="sub" style="color:var(--text-dim); font-size:12px;">${T("planner.perMonthPerYear", { year: fmtMoney(totalOpportunity * 12) })}</div>
    </div>

    <div class="card">
      <h2>${T("planner.whereRoom")}</h2>
      <p style="color:var(--text-dim); font-size:12px; margin-top:-6px;">
        ${T("planner.roomHint")}
      </p>
      ${leaks.map((l) => `
        <div style="padding:12px 0; border-bottom:1px solid var(--border);">
          <div style="display:flex; justify-content:space-between; align-items:baseline;">
            <div style="font-size:14px; font-weight:600;">${escapeHtml(l.category)}</div>
            <div style="font-size:14px; font-weight:700; color:var(--accent);">${fmtMoney(l.monthlySaving)}/mo</div>
          </div>
          <div style="font-size:12px; color:var(--text-dim); margin-top:4px;">
            ${T("planner.typicalBest", { typical: fmtMoney(l.typicalMonth), best: fmtMoney(l.goodMonth) })}
            ${l.trend > 0.2 ? ` · <span style="color:var(--warn);">${T("planner.trendingUp", { pct: Math.round(l.trend * 100) })}</span>` : ""}
          </div>
        </div>
      `).join("")}
    </div>

    <div class="card">
      <h2>${T("planner.whatIfCut")}</h2>
      <p style="color:var(--text-dim); font-size:12px; margin-top:-6px;">${T("planner.cutHint")}</p>
      <div id="sliders">
        ${leaks.slice(0, 6).map((l) => `
          <div style="margin-bottom:16px;">
            <div style="display:flex; justify-content:space-between; font-size:13px; margin-bottom:6px;">
              <span>${escapeHtml(l.category)}</span>
              <span id="cut-label-${cssId(l.category)}" style="color:var(--text-dim);">${cuts[l.category] || 0}% · ${fmtMoney((l.typicalMonth * (cuts[l.category] || 0)) / 100)}</span>
            </div>
            <input type="range" min="0" max="50" step="5" value="${cuts[l.category] || 0}"
                   data-cut="${escapeHtml(l.category)}" data-typical="${l.typicalMonth}"
                   style="width:100%;">
          </div>
        `).join("")}
      </div>
      <div class="divider"></div>
      <div id="whatif-result"></div>
    </div>
  `;

  body.querySelectorAll("[data-cut]").forEach((slider) => {
    slider.addEventListener("input", () => {
      const cat = slider.dataset.cut;
      const pct = Number(slider.value);
      cuts[cat] = pct;
      const typical = Number(slider.dataset.typical);
      const label = body.querySelector(`#cut-label-${cssId(cat)}`);
      if (label) label.textContent = `${pct}% · ${fmtMoney((typical * pct) / 100)}`;
      drawWhatIf(body);
    });
  });

  drawWhatIf(body);
}

function drawWhatIf(body) {
  const leaks = findLeaks();
  let freed = 0;
  for (const l of leaks) {
    const pct = cuts[l.category] || 0;
    freed += (l.typicalMonth * pct) / 100;
  }

  const before = goalStatus(0);
  const after = goalStatus(freed);
  const slot = body.querySelector("#whatif-result");
  if (!slot) return;

  slot.innerHTML = `
    <div style="font-size:13px; margin-bottom:10px;">
      ${T("planner.freesUp", { amount: fmtMoney(freed) })}
      ${freed > 0 ? T("planner.aYear", { amount: fmtMoney(freed * 12) }) : ""}
    </div>
    <table>
      <thead><tr><th>${T("planner.goal")}</th><th class="num">${T("planner.now")}</th><th class="num">${T("planner.afterCuts")}</th></tr></thead>
      <tbody>
        ${after.map((g, i) => {
          const b = before[i];
          const improved = g.months !== null && b.months !== null && g.months < b.months;
          return `<tr>
            <td>${escapeHtml(g.label)}${g.done ? ` <span class="badge">${T("planner.done")}</span>` : ""}</td>
            <td class="num" style="font-size:12px; color:var(--text-dim);">${etaText(b)}</td>
            <td class="num" style="font-size:12px; ${improved ? "color:var(--accent); font-weight:700;" : ""}">${etaText(g)}</td>
          </tr>`;
        }).join("")}
      </tbody>
    </table>
  `;
}

function etaText(g) {
  if (g.done) return T("planner.reached");
  if (g.months === null) return T("planner.neverAtRate");
  return `${fmtMonth(g.eta)}`;
}

// ------------------------------------------------------------------- goals

function renderGoalsTab(body, container) {
  const surplus = averageMonthlySurplus();
  const goals = goalStatus(0);
  const defaultTarget = addMonths(todayStr().slice(0, 7), 24);

  body.innerHTML = `
    <div class="card">
      <h2>${T("planner.monthlySurplus")}</h2>
      <div class="stat" style="border:none; padding:0;">
        <div class="value ${surplus >= 0 ? "pos" : "neg"}">${fmtMoney(surplus)}</div>
        <div class="sub">${T("planner.averagedAcross")}</div>
      </div>
    </div>

    ${goals.map((g) => `
      <div class="card">
        <h2>${escapeHtml(g.label)}</h2>
        <div class="progress-bar"><div class="fill" style="width:${g.target > 0 ? Math.min(100, Math.round((g.saved / g.target) * 100)) : 0}%"></div></div>
        <p style="font-size:12px; color:var(--text-dim); margin-top:8px;">
          ${T("planner.savedOfToGo", { saved: fmtMoney(g.saved), target: fmtMoney(g.target), remaining: fmtMoney(g.remaining) })}
        </p>
        <div style="font-size:13px; margin-top:6px;">
          ${g.done ? `<span style="color:var(--accent);">${T("planner.fullyFunded")}</span>`
            : g.months === null
              ? `<span style="color:var(--danger);">${T("planner.noSurplus")}</span>`
              : T("planner.landsAt", { amount: fmtMoney(g.surplus), month: fmtMonth(g.eta), n: g.months })}
        </div>
        ${!g.done ? `
        <div class="divider"></div>
        <div class="field">
          <label>${T("planner.wantItBy")}</label>
          <input type="month" data-goal-target="${g.key}" value="${defaultTarget}">
        </div>
        <div id="req-${g.key}" style="font-size:13px;"></div>` : ""}
      </div>
    `).join("")}
  `;

  body.querySelectorAll("[data-goal-target]").forEach((input) => {
    const update = () => {
      const key = input.dataset.goalTarget;
      const req = requiredMonthly(key, input.value);
      const slot = body.querySelector(`#req-${key}`);
      if (!slot) return;
      if (!req) { slot.innerHTML = `<span style="color:var(--danger);">${T("planner.pickFutureMonth")}</span>`; return; }
      slot.innerHTML = req.gap > 0
        ? T("planner.needGap", { need: fmtMoney(req.requiredPerMonth), gap: fmtMoney(req.gap) })
        : T("planner.needOnTrack", { need: fmtMoney(req.requiredPerMonth), saving: fmtMoney(req.surplus) });
    };
    input.addEventListener("change", update);
    update();
  });
}

// ------------------------------------------------------------------- bills

function renderBillsTab(body, container) {
  const detected = detectRecurring();
  const existing = db.data.recurring;

  body.innerHTML = `
    <div class="card">
      <h2>${T("planner.alreadySetUp")}</h2>
      ${existing.length ? `
        <table><tbody>
          ${existing.map((r) => `
            <tr>
              <td>${escapeHtml(r.name)}<br><span style="color:var(--text-dim); font-size:11px;">${escapeHtml(r.category)} · day ${r.dayOfMonth}</span></td>
              <td class="num ${r.amount >= 0 ? "amt-pos" : "amt-neg"}">${fmtMoney(r.amount)}</td>
            </tr>`).join("")}
        </tbody></table>` : `<div class="empty-state">${T("planner.nothingRecurring")}</div>`}
    </div>

    <div class="card">
      <h2>${T("planner.spotted")}</h2>
      <p style="color:var(--text-dim); font-size:12px; margin-top:-6px;">${T("planner.spottedHint")}</p>
      ${detected.length ? `
        ${detected.map((d) => `
          <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid var(--border);">
            <div>
              <div style="font-size:14px;">${escapeHtml(d.category)}</div>
              <div style="font-size:11px; color:var(--text-dim);">${T("planner.seenIn", { amount: fmtMoney(d.amount), months: d.monthsSeen, day: d.dayOfMonth })}</div>
            </div>
            <button class="mini-btn" data-add-rec='${escapeHtml(JSON.stringify(d))}'>${T("common.add")}</button>
          </div>`).join("")}
        <button class="btn secondary small" id="add-all-rec" style="margin-top:12px;">${T("planner.addAll", { n: detected.length })}</button>
      ` : `<div class="empty-state">${T("planner.nothingNew")}</div>`}
    </div>
  `;

  body.querySelectorAll("[data-add-rec]").forEach((b) => {
    b.addEventListener("click", () => {
      const d = JSON.parse(b.dataset.addRec);
      db.addRecurring({ name: d.category, category: d.category, amount: d.amount, dayOfMonth: d.dayOfMonth });
      showToast(T("common.added"));
      renderPlanner(container);
    });
  });

  const addAll = body.querySelector("#add-all-rec");
  if (addAll) addAll.addEventListener("click", () => {
    for (const d of detected) {
      db.addRecurring({ name: d.category, category: d.category, amount: d.amount, dayOfMonth: d.dayOfMonth });
    }
    showToast(T("planner.addedRecurring", { n: detected.length }));
    renderPlanner(container);
  });
}

// -------------------------------------------------- shared proposal preview

// Same review-then-approve flow the AI assistant uses, so generated plans are
// never written to the user's data without them seeing exactly what changes.
function showProposal(container, { title, summary, operations }) {
  const wrap = el("div");

  wrap.appendChild(el("p", { style: "font-size:13px; color:var(--text-dim); margin-bottom:12px;" }, summary));

  const preview = el("div", { style: "max-height:38vh; overflow-y:auto; border:1px solid var(--border); border-radius:10px; padding:10px; margin-bottom:14px;" });
  const shown = operations.slice(0, 120);
  preview.innerHTML = shown.map((op) => `
    <div style="font-size:12px; padding:3px 0; color:var(--text-dim);">${escapeHtml(describeOp(op))}</div>
  `).join("") + (operations.length > shown.length
    ? `<div style="font-size:11px; padding-top:6px;">${T("planner.andMore", { n: operations.length - shown.length })}</div>` : "");
  wrap.appendChild(preview);

  const row = el("div", { style: "display:flex; gap:10px;" });
  row.appendChild(el("button", { class: "btn secondary", onClick: closeSheet }, T("common.cancel")));
  row.appendChild(el("button", {
    class: "btn",
    onClick: () => {
      const n = db.applyProposal(operations);
      closeSheet();
      showToast(T("planner.appliedChanges", { n }));
      offerUndo(container);
      renderPlanner(container);
    }
  }, T("planner.applyN", { n: operations.length })));
  wrap.appendChild(row);

  openSheet(title, wrap);
}

function offerUndo(container) {
  const bar = el("div", {
    class: "toast",
    style: "top:auto; bottom:calc(150px + env(safe-area-inset-bottom,0px)); display:flex; gap:12px; align-items:center;"
  });
  bar.appendChild(document.createTextNode(T("planner.applied")));
  const undo = el("button", { class: "mini-btn", style: "border-color:var(--accent); color:var(--accent);" }, T("planner.undo"));
  undo.addEventListener("click", () => {
    if (db.undoLastProposal()) {
      showToast(T("planner.reverted"));
      renderPlanner(container);
    }
    bar.remove();
  });
  bar.appendChild(undo);
  document.body.appendChild(bar);
  setTimeout(() => bar.remove(), 12000);
}

function describeOp(op) {
  switch (op.action) {
    case "add_budget":
      return `+ ${fmtDate(op.date)} · ${op.category} · ${fmtMoney(op.amount)}`;
    case "delete_budget": {
      const item = db.data.budget.find((b) => b.id === op.id);
      return item ? `− ${T("op.remove")} ${fmtDate(item.date)} · ${item.category} · ${fmtMoney(item.amount)}` : `− ${T("op.remove")} ${op.id}`;
    }
    default:
      return op.action;
  }
}

function cssId(s) {
  return s.replace(/[^a-z0-9]/gi, "-");
}
