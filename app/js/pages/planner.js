import { db } from "../db.js";
import {
  buildBudgetPlan, findLeaks, goalStatus, requiredMonthly,
  detectRecurring, averageMonthlySurplus
} from "../planner.js";
import { fmtMoney, fmtMoneyShort, fmtMonth, fmtDate, todayStr, addMonths, escapeHtml, el } from "../utils.js";
import { openSheet, closeSheet, showToast } from "../ui.js";

const TABS = [
  { key: "budget", label: "Build budget" },
  { key: "leaks", label: "Find leaks" },
  { key: "goals", label: "Goals" },
  { key: "bills", label: "Bills" }
];

let activeTab = "budget";
let cuts = {}; // category -> percent to trim, for the what-if sliders

export function renderPlanner(container) {
  container.innerHTML = `
    <div class="page-title">Planner</div>
    <p class="page-sub">Works out your numbers exactly. No account, no cost, works offline.</p>
    <div class="tabs" id="planner-tabs">
      ${TABS.map((t) => `<button class="${t.key === activeTab ? "active" : ""}" data-tab="${t.key}">${t.label}</button>`).join("")}
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

function renderBudgetTab(body, container) {
  const defaultStart = addMonths(todayStr().slice(0, 7), 1);
  const patterns = buildBudgetPlan({ startMonth: defaultStart, monthCount: 1 }).patterns;

  if (!patterns.length) {
    body.innerHTML = `<div class="card"><div class="empty-state">
      Nothing to learn from yet. Log a few weeks of real spending, or add recurring items in Settings, and this can build you a budget.
    </div></div>`;
    return;
  }

  body.innerHTML = `
    <div class="card">
      <h2>What I learned from your history</h2>
      <p style="color:var(--text-dim); font-size:12px; margin-top:-6px;">Median month per category — the middle month, so one unusual month doesn't skew the plan.</p>
      <table>
        <thead><tr><th>Category</th><th class="num">Typical month</th><th class="num">Pattern</th></tr></thead>
        <tbody>
          ${patterns.map((p) => `
            <tr>
              <td>${escapeHtml(p.category)}</td>
              <td class="num ${p.monthlyTotal >= 0 ? "amt-pos" : "amt-neg"}">${fmtMoney(p.monthlyTotal)}</td>
              <td class="num" style="font-size:11px; color:var(--text-dim);">${p.perMonthCount > 3 ? "spread weekly" : `day ${p.typicalDay}`}</td>
            </tr>`).join("")}
        </tbody>
      </table>
    </div>

    <div class="card">
      <h2>Generate</h2>
      <div class="field-row">
        <div class="field"><label>Start month</label><input type="month" id="start-month" value="${defaultStart}"></div>
        <div class="field"><label>How many months</label><input type="number" id="month-count" value="12" min="1" max="36"></div>
      </div>
      <label style="display:flex; gap:10px; align-items:flex-start; font-size:13px; color:var(--text-dim); margin-bottom:14px;">
        <input type="checkbox" id="replace-existing" style="width:auto; margin-top:2px;">
        <span>Replace any budget already in those months (otherwise new entries are added alongside)</span>
      </label>
      <button class="btn" id="preview-budget">Preview budget</button>
    </div>
  `;

  body.querySelector("#preview-budget").addEventListener("click", () => {
    const startMonth = body.querySelector("#start-month").value || defaultStart;
    const monthCount = Math.max(1, Math.min(36, parseInt(body.querySelector("#month-count").value) || 12));
    const replaceExisting = body.querySelector("#replace-existing").checked;
    const plan = buildBudgetPlan({ startMonth, monthCount, replaceExisting });
    showProposal(container, {
      title: `Budget for ${fmtMonth(plan.months[0])} – ${fmtMonth(plan.months[plan.months.length - 1])}`,
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
    `${adds.length} entries across ${perMonth} month${perMonth === 1 ? "" : "s"}`,
    `income ${fmtMoney(income)}`,
    `expenses ${fmtMoney(expense)}`,
    `net ${fmtMoney(income - expense)}`
  ];
  if (dels.length) parts.push(`replaces ${dels.length} existing`);
  return parts.join(" · ");
}

// -------------------------------------------------------------- find leaks

function renderLeaksTab(body, container) {
  const leaks = findLeaks();
  const surplus = averageMonthlySurplus();

  if (!leaks.length) {
    body.innerHTML = `<div class="card"><div class="empty-state">
      Not enough history yet to spot leaks. This needs at least two months of logged spending in the same category.
    </div></div>`;
    return;
  }

  const totalOpportunity = leaks.reduce((s, l) => s + l.monthlySaving, 0);

  body.innerHTML = `
    <div class="card hero-balance">
      <div class="label">If every category hit its own best month</div>
      <div class="amount" style="color:var(--accent);">${fmtMoney(totalOpportunity)}</div>
      <div class="sub" style="color:var(--text-dim); font-size:12px;">per month · ${fmtMoney(totalOpportunity * 12)} a year</div>
    </div>

    <div class="card">
      <h2>Where the room is</h2>
      <p style="color:var(--text-dim); font-size:12px; margin-top:-6px;">
        These aren't invented targets. Each "good month" is a figure you actually hit at least once — so it's provably doable.
      </p>
      ${leaks.map((l) => `
        <div style="padding:12px 0; border-bottom:1px solid var(--border);">
          <div style="display:flex; justify-content:space-between; align-items:baseline;">
            <div style="font-size:14px; font-weight:600;">${escapeHtml(l.category)}</div>
            <div style="font-size:14px; font-weight:700; color:var(--accent);">${fmtMoney(l.monthlySaving)}/mo</div>
          </div>
          <div style="font-size:12px; color:var(--text-dim); margin-top:4px;">
            Typical month ${fmtMoney(l.typicalMonth)} · your best ${fmtMoney(l.goodMonth)}
            ${l.trend > 0.2 ? ` · <span style="color:var(--warn);">trending up ${Math.round(l.trend * 100)}%</span>` : ""}
          </div>
        </div>
      `).join("")}
    </div>

    <div class="card">
      <h2>What if you cut them?</h2>
      <p style="color:var(--text-dim); font-size:12px; margin-top:-6px;">Drag to see what it does to your goals. Nothing is saved — this is just the maths.</p>
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
      Frees up <strong style="color:var(--accent);">${fmtMoney(freed)}</strong> a month
      ${freed > 0 ? `(${fmtMoney(freed * 12)} a year)` : ""}
    </div>
    <table>
      <thead><tr><th>Goal</th><th class="num">Now</th><th class="num">After cuts</th></tr></thead>
      <tbody>
        ${after.map((g, i) => {
          const b = before[i];
          const improved = g.months !== null && b.months !== null && g.months < b.months;
          return `<tr>
            <td>${escapeHtml(g.label)}${g.done ? ` <span class="badge">done</span>` : ""}</td>
            <td class="num" style="font-size:12px; color:var(--text-dim);">${etaText(b)}</td>
            <td class="num" style="font-size:12px; ${improved ? "color:var(--accent); font-weight:700;" : ""}">${etaText(g)}</td>
          </tr>`;
        }).join("")}
      </tbody>
    </table>
  `;
}

function etaText(g) {
  if (g.done) return "reached";
  if (g.months === null) return "never at this rate";
  return `${fmtMonth(g.eta)}`;
}

// ------------------------------------------------------------------- goals

function renderGoalsTab(body, container) {
  const surplus = averageMonthlySurplus();
  const goals = goalStatus(0);
  const defaultTarget = addMonths(todayStr().slice(0, 7), 24);

  body.innerHTML = `
    <div class="card">
      <h2>Your monthly surplus</h2>
      <div class="stat" style="border:none; padding:0;">
        <div class="value ${surplus >= 0 ? "pos" : "neg"}">${fmtMoney(surplus)}</div>
        <div class="sub">averaged across the months you've logged</div>
      </div>
    </div>

    ${goals.map((g) => `
      <div class="card">
        <h2>${escapeHtml(g.label)}</h2>
        <div class="progress-bar"><div class="fill" style="width:${g.target > 0 ? Math.min(100, Math.round((g.saved / g.target) * 100)) : 0}%"></div></div>
        <p style="font-size:12px; color:var(--text-dim); margin-top:8px;">
          ${fmtMoney(g.saved)} of ${fmtMoney(g.target)} · ${fmtMoney(g.remaining)} to go
        </p>
        <div style="font-size:13px; margin-top:6px;">
          ${g.done ? `<span style="color:var(--accent);">Fully funded.</span>`
            : g.months === null
              ? `<span style="color:var(--danger);">You have no surplus right now, so this isn't moving.</span>`
              : `At ${fmtMoney(g.surplus)}/month this lands <strong>${fmtMonth(g.eta)}</strong> (${g.months} months).`}
        </div>
        ${!g.done ? `
        <div class="divider"></div>
        <div class="field">
          <label>Want it by a certain month? Pick one:</label>
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
      if (!req) { slot.innerHTML = `<span style="color:var(--danger);">Pick a month in the future.</span>`; return; }
      slot.innerHTML = req.gap > 0
        ? `You'd need <strong>${fmtMoney(req.requiredPerMonth)}/month</strong> — that's <strong style="color:var(--danger);">${fmtMoney(req.gap)}</strong> more than you currently save. Check the Leaks tab for where it could come from.`
        : `You'd need <strong>${fmtMoney(req.requiredPerMonth)}/month</strong>, and you're already saving ${fmtMoney(req.surplus)}. <span style="color:var(--accent);">On track.</span>`;
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
      <h2>Already set up</h2>
      ${existing.length ? `
        <table><tbody>
          ${existing.map((r) => `
            <tr>
              <td>${escapeHtml(r.name)}<br><span style="color:var(--text-dim); font-size:11px;">${escapeHtml(r.category)} · day ${r.dayOfMonth}</span></td>
              <td class="num ${r.amount >= 0 ? "amt-pos" : "amt-neg"}">${fmtMoney(r.amount)}</td>
            </tr>`).join("")}
        </tbody></table>` : `<div class="empty-state">Nothing recurring yet.</div>`}
    </div>

    <div class="card">
      <h2>Spotted in your history</h2>
      <p style="color:var(--text-dim); font-size:12px; margin-top:-6px;">Same amount, same category, three or more separate months — almost certainly a bill.</p>
      ${detected.length ? `
        ${detected.map((d) => `
          <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid var(--border);">
            <div>
              <div style="font-size:14px;">${escapeHtml(d.category)}</div>
              <div style="font-size:11px; color:var(--text-dim);">${fmtMoney(d.amount)} · seen in ${d.monthsSeen} months · usually day ${d.dayOfMonth}</div>
            </div>
            <button class="mini-btn" data-add-rec='${escapeHtml(JSON.stringify(d))}'>Add</button>
          </div>`).join("")}
        <button class="btn secondary small" id="add-all-rec" style="margin-top:12px;">Add all ${detected.length}</button>
      ` : `<div class="empty-state">Nothing new spotted.</div>`}
    </div>
  `;

  body.querySelectorAll("[data-add-rec]").forEach((b) => {
    b.addEventListener("click", () => {
      const d = JSON.parse(b.dataset.addRec);
      db.addRecurring({ name: d.category, category: d.category, amount: d.amount, dayOfMonth: d.dayOfMonth });
      showToast("Added");
      renderPlanner(container);
    });
  });

  const addAll = body.querySelector("#add-all-rec");
  if (addAll) addAll.addEventListener("click", () => {
    for (const d of detected) {
      db.addRecurring({ name: d.category, category: d.category, amount: d.amount, dayOfMonth: d.dayOfMonth });
    }
    showToast(`Added ${detected.length} recurring items`);
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
    ? `<div style="font-size:11px; padding-top:6px;">…and ${operations.length - shown.length} more</div>` : "");
  wrap.appendChild(preview);

  const row = el("div", { style: "display:flex; gap:10px;" });
  row.appendChild(el("button", { class: "btn secondary", onClick: closeSheet }, "Cancel"));
  row.appendChild(el("button", {
    class: "btn",
    onClick: () => {
      const n = db.applyProposal(operations);
      closeSheet();
      showToast(`Applied ${n} change${n === 1 ? "" : "s"}`);
      offerUndo(container);
      renderPlanner(container);
    }
  }, `Apply ${operations.length}`));
  wrap.appendChild(row);

  openSheet(title, wrap);
}

function offerUndo(container) {
  const bar = el("div", {
    class: "toast",
    style: "top:auto; bottom:calc(150px + env(safe-area-inset-bottom,0px)); display:flex; gap:12px; align-items:center;"
  });
  bar.appendChild(document.createTextNode("Applied"));
  const undo = el("button", { class: "mini-btn", style: "border-color:var(--accent); color:var(--accent);" }, "Undo");
  undo.addEventListener("click", () => {
    if (db.undoLastProposal()) {
      showToast("Reverted");
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
      return item ? `− remove ${fmtDate(item.date)} · ${item.category} · ${fmtMoney(item.amount)}` : `− remove ${op.id}`;
    }
    default:
      return op.action;
  }
}

function cssId(s) {
  return s.replace(/[^a-z0-9]/gi, "-");
}
