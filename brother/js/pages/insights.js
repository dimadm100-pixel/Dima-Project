import { db } from "../db.js";
import { analyze, buildAIContext } from "../insights.js";
import { hasApiKey, stream, AIError } from "../ai.js";
import { fmtMoney, fmtMonth, todayStr, escapeHtml, svgSparkline } from "../utils.js";
import { showToast } from "../ui.js";

const SEVERITY_BADGE = { high: "danger", medium: "warn", low: "" };
const SEVERITY_LABEL = { high: "needs attention", medium: "worth a look", low: "fyi" };

export function renderInsights(container) {
  const findings = analyze();
  const thisMonth = todayStr().slice(0, 7);
  const pnl = db.pnlForMonth(thisMonth);
  const savingsRate = pnl.incomeTotal > 0 ? Math.round((pnl.net / pnl.incomeTotal) * 100) : null;
  const rateFinding = findings.find((f) => f.kind === "savings_rate");

  container.innerHTML = `
    <div class="page-title">Insights</div>
    <p class="page-sub">Analysis of your actual numbers. Works offline — no AI needed.</p>

    <div class="grid-2">
      <div class="stat">
        <div class="label">Savings rate</div>
        <div class="value ${savingsRate !== null && savingsRate >= 0 ? "pos" : "neg"}">${savingsRate === null ? "—" : savingsRate + "%"}</div>
        <div class="sub">${fmtMonth(thisMonth)}</div>
      </div>
      <div class="stat">
        <div class="label">Net this month</div>
        <div class="value ${pnl.net >= 0 ? "pos" : "neg"}">${fmtMoney(pnl.net)}</div>
      </div>
    </div>

    ${rateFinding?.series?.length > 1 ? `
    <div class="card">
      <h2>Savings rate trend</h2>
      ${svgSparkline(rateFinding.series.map((s) => ({ value: s.rate })), { height: 60 })}
      <div class="legend">
        ${rateFinding.series.map((s) => `<div class="legend-item">${fmtMonth(s.month)}: ${s.rate}%</div>`).join("")}
      </div>
    </div>` : ""}

    <div class="card">
      <h2>What I'm seeing <span style="font-weight:400;color:var(--text-dim);font-size:12px;">(${findings.length})</span></h2>
      ${findings.length ? findings.map(findingHTML).join("") : `<div class="empty-state">Nothing to flag — log a few more days and check back.</div>`}
    </div>

    <div class="card">
      <h2>AI review</h2>
      ${hasApiKey() ? `
        <p style="color:var(--text-dim); font-size:13px; margin-top:-6px;">A written review of this month and where your money could work harder.</p>
        <button class="btn" id="ai-review-btn">Write my monthly review</button>
        <div id="ai-output" style="margin-top:14px;"></div>
      ` : `
        <div class="empty-state" style="padding:18px 8px;">
          Add an Anthropic API key in Settings to unlock the written review and the AI assistant.
          <div style="height:12px;"></div>
          <button class="btn secondary small" id="go-settings">Open Settings</button>
        </div>
      `}
    </div>
  `;

  const settingsBtn = container.querySelector("#go-settings");
  if (settingsBtn) settingsBtn.addEventListener("click", () => { window.location.hash = "#settings"; });

  container.querySelectorAll("[data-make-recurring]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const payload = JSON.parse(btn.dataset.makeRecurring);
      db.addRecurring({ name: payload.category, category: payload.category, amount: payload.amount, dayOfMonth: payload.dayOfMonth });
      showToast("Recurring item added");
      renderInsights(container);
    });
  });

  const reviewBtn = container.querySelector("#ai-review-btn");
  if (reviewBtn) reviewBtn.addEventListener("click", () => runReview(container, reviewBtn));
}

function findingHTML(f) {
  const badge = SEVERITY_BADGE[f.severity];
  return `
    <div style="padding:12px 0; border-bottom:1px solid var(--border);">
      <span class="badge ${badge}">${SEVERITY_LABEL[f.severity]}</span>
      <div style="font-size:14px; font-weight:600; margin-top:6px;">${escapeHtml(f.title)}</div>
      <div style="font-size:13px; color:var(--text-dim); margin-top:4px;">${escapeHtml(f.detail)}</div>
      ${f.suggestedRecurring ? `<button class="mini-btn" style="margin-top:8px;" data-make-recurring='${escapeHtml(JSON.stringify(f.suggestedRecurring))}'>Set up recurring</button>` : ""}
    </div>
  `;
}

const REVIEW_SYSTEM = `You are a careful personal finance analyst reviewing one person's real tracked finances.

They are 22, live in Uzbekistan, and track everything in UZS (sums). They are saving toward three named goals: marriage, a home down payment, and Umrah.

You will be given a JSON snapshot of their finances: monthly income/expense history by category, budget vs actual for the current month, their forward budget projection including any point where the projected balance goes negative, account balances, goal targets and progress, and a list of findings already computed deterministically from their data.

Write a review with exactly these sections, using markdown headings:

## This month
What actually happened, in plain language. Lead with the single most important fact.

## Where the money went
The categories that mattered, with real numbers. Call out anything that moved sharply versus prior months.

## What I'd change
Two to four concrete, specific actions. Each must reference their real numbers and name an amount. Rank by how much money it frees up. Do not suggest generic advice like "make a budget" — they already have one.

## Watch out for
Any genuine risk in the data: a projected cash shortfall, a category trending badly, a goal that is not reachable at the current pace. If there is nothing genuinely concerning, say so plainly rather than inventing a worry.

Rules:
- Every claim must be traceable to the data you were given. Never invent a transaction, category, or number.
- Amounts in UZS with thousands separators, e.g. 1,250,000 UZS.
- Be direct and concrete. No filler, no motivational padding, no restating the data back at them.
- If the data is too sparse to say something useful, say exactly that and name what they'd need to log.
- Keep the whole thing under 400 words.`;

async function runReview(container, btn) {
  const out = container.querySelector("#ai-output");
  btn.disabled = true;
  btn.textContent = "Thinking…";
  out.innerHTML = `<div style="color:var(--text-dim); font-size:13px;">Reading your numbers…</div>`;

  const context = buildAIContext();

  try {
    let acc = "";
    await stream({
      system: REVIEW_SYSTEM,
      maxTokens: 4000,
      messages: [{
        role: "user",
        content: `Here is my current financial data as JSON:\n\n${JSON.stringify(context, null, 1)}\n\nWrite my review.`
      }],
      onText: (_chunk, full) => {
        acc = full;
        out.innerHTML = renderMarkdown(full);
      }
    });
    if (!acc.trim()) out.innerHTML = `<div class="empty-state">The model returned nothing. Try again.</div>`;
    btn.textContent = "Regenerate review";
  } catch (e) {
    const msg = e instanceof AIError ? e.message : "Something went wrong generating the review.";
    out.innerHTML = `<div style="color:var(--danger); font-size:13px;">${escapeHtml(msg)}</div>`;
    btn.textContent = "Try again";
  } finally {
    btn.disabled = false;
  }
}

// Deliberately tiny markdown subset: headings, bold, bullets, paragraphs.
// Input is escaped first, so no model output can inject HTML.
export function renderMarkdown(md) {
  const lines = escapeHtml(md).split("\n");
  let html = "";
  let inList = false;
  for (const line of lines) {
    const t = line.trim();
    if (!t) { if (inList) { html += "</ul>"; inList = false; } continue; }
    if (t.startsWith("## ")) {
      if (inList) { html += "</ul>"; inList = false; }
      html += `<h3 style="font-size:14px; margin:16px 0 6px;">${inline(t.slice(3))}</h3>`;
    } else if (t.startsWith("# ")) {
      if (inList) { html += "</ul>"; inList = false; }
      html += `<h3 style="font-size:15px; margin:16px 0 6px;">${inline(t.slice(2))}</h3>`;
    } else if (/^[-*]\s+/.test(t)) {
      if (!inList) { html += `<ul style="margin:6px 0 6px 18px; padding:0;">`; inList = true; }
      html += `<li style="font-size:13px; color:var(--text-dim); margin-bottom:4px;">${inline(t.replace(/^[-*]\s+/, ""))}</li>`;
    } else {
      if (inList) { html += "</ul>"; inList = false; }
      html += `<p style="font-size:13px; color:var(--text-dim); margin:6px 0;">${inline(t)}</p>`;
    }
  }
  if (inList) html += "</ul>";
  return html;
}

function inline(s) {
  return s
    .replace(/\*\*([^*]+)\*\*/g, '<strong style="color:var(--text);">$1</strong>')
    .replace(/`([^`]+)`/g, '<code style="font-size:12px;">$1</code>');
}
