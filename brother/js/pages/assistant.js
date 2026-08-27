import { db } from "../db.js";
import { buildAIContext } from "../insights.js";
import { complete, textOf, toolUsesOf, hasApiKey, AIError } from "../ai.js";
import { fmtMoney, fmtDate, todayStr, escapeHtml, el } from "../utils.js";
import { showToast, openSheet, closeSheet } from "../ui.js";
import { renderMarkdown } from "./insights.js";

const MAX_TURNS = 8;

// Conversation persists while the page is open so follow-ups keep context.
let conversation = [];
let pendingProposal = null;
let busy = false;

const TOOLS = [
  {
    name: "get_financial_data",
    description: "Get a full snapshot of the user's finances: balance, monthly income/expense history by category, budget vs actual for this month, forward budget projection with any cash shortfalls, account balances, goal targets and progress, recurring items, and pre-computed findings. Call this first for almost any question.",
    input_schema: { type: "object", properties: {}, required: [] }
  },
  {
    name: "search_transactions",
    description: "Search the user's logged transactions or their planned budget items. Use when you need specific line items rather than the aggregate summary.",
    input_schema: {
      type: "object",
      properties: {
        source: { type: "string", enum: ["actuals", "budget"], description: "'actuals' = money that really moved; 'budget' = the plan." },
        query: { type: "string", description: "Free text matched against category, note, date and amount." },
        category: { type: "string", description: "Exact category filter." },
        from: { type: "string", description: "Start date, YYYY-MM-DD." },
        to: { type: "string", description: "End date, YYYY-MM-DD." },
        kind: { type: "string", enum: ["all", "income", "expense"] }
      },
      required: []
    }
  },
  {
    name: "propose_changes",
    description: "Propose a batch of changes to the user's data. NOTHING is written until the user reviews and approves the proposal, so always use this rather than claiming you have made a change. Batch all related changes into one call — for a full year of budget, include every line in one proposal.",
    input_schema: {
      type: "object",
      properties: {
        summary: { type: "string", description: "One or two sentences: what this does and why. Shown to the user above the change list." },
        operations: {
          type: "array",
          description: "The changes to make.",
          items: {
            type: "object",
            properties: {
              action: {
                type: "string",
                enum: ["add_budget", "delete_budget", "add_transaction", "add_recurring", "set_goal_saved"],
                description: "Which change to make."
              },
              date: { type: "string", description: "YYYY-MM-DD. For add_budget and add_transaction." },
              amount: { type: "number", description: "Negative for expenses, positive for income. For set_goal_saved, the new saved total (positive)." },
              category: { type: "string", description: "Lowercase category, e.g. 'food', 'rent', 'salary'. Reuse the user's existing categories where they fit." },
              note: { type: "string" },
              id: { type: "string", description: "Existing item id. Required for delete_budget." },
              name: { type: "string", description: "Label for a recurring item." },
              dayOfMonth: { type: "number", description: "1-28. For add_recurring." },
              goal: { type: "string", enum: ["marriage", "home", "umrah"], description: "For set_goal_saved." }
            },
            required: ["action"]
          }
        }
      },
      required: ["summary", "operations"]
    }
  }
];

function systemPrompt() {
  return `You are the financial assistant built into a personal finance app. You are talking to its owner: 22 years old, living in Uzbekistan, tracking everything in UZS (sums). He saves toward three goals: marriage, a home down payment, and Umrah.

Today is ${todayStr()}.

How the app is structured — this matters for giving correct answers:
- "Actuals" are transactions that really happened. They drive the P&L, balance sheet, and current cash balance.
- "Budget" is the forward plan. Budget and actuals are separate; changing one never changes the other.
- A "cash hole" is any date where the projected budget balance goes negative.
- Expenses are stored as negative amounts, income as positive.

Your job:
- Answer questions about his finances using the tools. Call get_financial_data before making claims about his numbers.
- When he asks you to change something — build a budget, add entries, set up recurring items — use propose_changes. Never claim you changed anything; the user must approve the proposal first.
- When building a budget forward, base it on what he actually earns and spends, not round guesses. Look at his real history first.
- Be concrete and brief. Use real amounts with thousands separators. No filler or motivational padding.
- If something in his plan does not work — a cash shortfall, a goal that is unreachable at his current rate — say so directly rather than softening it.
- Never invent transactions or numbers. If the data does not support an answer, say what is missing.`;
}

export function renderAssistant(container) {
  if (!hasApiKey()) {
    container.innerHTML = `
      <div class="page-title">Assistant</div>
      <p class="page-sub">Ask questions about your money, or have it build things for you.</p>
      <div class="card">
        <div class="empty-state" style="padding:24px 8px;">
          The assistant needs an Anthropic API key.
          <div style="height:6px;"></div>
          <span style="font-size:12px;">Everything else in the app works without one.</span>
          <div style="height:14px;"></div>
          <button class="btn secondary small" id="go-settings">Open Settings</button>
        </div>
      </div>`;
    container.querySelector("#go-settings").addEventListener("click", () => { window.location.hash = "#settings"; });
    return;
  }

  container.innerHTML = `
    <div class="page-title">Assistant</div>
    <p class="page-sub">Ask anything, or tell it to build something. It proposes; you approve.</p>

    ${conversation.length === 0 ? `
    <div class="card">
      <h2>Try asking</h2>
      <div class="chip-row" id="suggestions">
        <button class="chip" data-q="Build me a realistic budget for the next 12 months based on what I actually earn and spend.">Build next year's budget</button>
        <button class="chip" data-q="Where is my money leaking? Give me the three biggest specific cuts I could make.">Find my money leaks</button>
        <button class="chip" data-q="When can I realistically afford the marriage goal, and what would have to change to make it sooner?">When can I afford marriage?</button>
        <button class="chip" data-q="Set up recurring entries for everything I pay every month.">Set up my recurring bills</button>
      </div>
    </div>` : ""}

    <div id="thread"></div>
    <div id="proposal-slot"></div>

    <div class="card">
      <div class="field" style="margin-bottom:8px;">
        <textarea id="prompt-input" rows="3" placeholder="Ask about your finances, or describe what you want built…"></textarea>
      </div>
      <button class="btn" id="send-btn">Ask</button>
      ${conversation.length ? `<button class="btn secondary small" id="clear-btn" style="margin-top:8px;">Clear conversation</button>` : ""}
    </div>
  `;

  container.querySelectorAll("#suggestions .chip").forEach((c) => {
    c.addEventListener("click", () => {
      container.querySelector("#prompt-input").value = c.dataset.q;
      send(container);
    });
  });
  container.querySelector("#send-btn").addEventListener("click", () => send(container));
  const clearBtn = container.querySelector("#clear-btn");
  if (clearBtn) clearBtn.addEventListener("click", () => {
    conversation = [];
    pendingProposal = null;
    renderAssistant(container);
  });

  const input = container.querySelector("#prompt-input");
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) send(container);
  });

  drawThread(container);
  drawProposal(container);
}

function drawThread(container) {
  const thread = container.querySelector("#thread");
  if (!thread) return;
  const visible = conversation.filter((m) => m.display);
  thread.innerHTML = visible.map((m) => {
    if (m.role === "user") {
      return `<div class="card" style="background:var(--bg-elev-2);">
        <div style="font-size:11px; color:var(--text-dim); margin-bottom:6px;">You</div>
        <div style="font-size:14px;">${escapeHtml(m.display)}</div>
      </div>`;
    }
    return `<div class="card">
      <div style="font-size:11px; color:var(--text-dim); margin-bottom:6px;">Assistant</div>
      ${renderMarkdown(m.display)}
    </div>`;
  }).join("");
}

function drawProposal(container) {
  const slot = container.querySelector("#proposal-slot");
  if (!slot) return;
  if (!pendingProposal) { slot.innerHTML = ""; return; }

  const { summary, operations } = pendingProposal;
  const grouped = summarizeOps(operations);

  slot.innerHTML = `
    <div class="card" style="border-color:var(--accent);">
      <h2>Proposed changes</h2>
      <p style="font-size:13px; color:var(--text-dim); margin-top:-6px;">${escapeHtml(summary)}</p>
      <div class="divider"></div>
      <div style="font-size:13px; margin-bottom:10px;">${grouped.map((g) => `<div style="margin-bottom:4px;">• ${escapeHtml(g)}</div>`).join("")}</div>
      <details style="margin-bottom:12px;">
        <summary style="font-size:12px; color:var(--text-dim); cursor:pointer;">See all ${operations.length} change${operations.length === 1 ? "" : "s"}</summary>
        <table style="margin-top:10px;">
          <tbody>
            ${operations.slice(0, 200).map((op) => `
              <tr>
                <td style="font-size:12px;">${escapeHtml(describeOp(op))}</td>
              </tr>`).join("")}
          </tbody>
        </table>
        ${operations.length > 200 ? `<p style="font-size:11px; color:var(--text-dim);">…and ${operations.length - 200} more.</p>` : ""}
      </details>
      <div style="display:flex; gap:10px;">
        <button class="btn secondary" id="discard-proposal">Discard</button>
        <button class="btn" id="apply-proposal">Apply ${operations.length} change${operations.length === 1 ? "" : "s"}</button>
      </div>
    </div>
  `;

  slot.querySelector("#discard-proposal").addEventListener("click", () => {
    pendingProposal = null;
    drawProposal(container);
    showToast("Proposal discarded");
  });

  slot.querySelector("#apply-proposal").addEventListener("click", () => {
    const ops = pendingProposal.operations;
    confirmApply(ops.length, () => {
      const n = db.applyProposal(ops);
      pendingProposal = null;
      renderAssistant(container);
      showToast(`Applied ${n} change${n === 1 ? "" : "s"}`);
      offerUndo();
    });
  });
}

function confirmApply(count, onYes) {
  const wrap = el("div");
  wrap.appendChild(el("p", { style: "color: var(--text-dim); font-size: 14px; margin-bottom: 20px;" },
    `This writes ${count} change${count === 1 ? "" : "s"} to your data. You can undo it right after.`));
  const row = el("div", { style: "display:flex; gap:10px;" });
  row.appendChild(el("button", { class: "btn secondary", onClick: closeSheet }, "Cancel"));
  row.appendChild(el("button", { class: "btn", onClick: () => { closeSheet(); onYes(); } }, "Apply"));
  wrap.appendChild(row);
  openSheet("Apply changes?", wrap);
}

function offerUndo() {
  const bar = el("div", {
    class: "toast",
    style: "top:auto; bottom:calc(150px + env(safe-area-inset-bottom,0px)); display:flex; gap:12px; align-items:center;"
  });
  bar.appendChild(document.createTextNode("Changes applied"));
  const undo = el("button", { class: "mini-btn", style: "border-color:var(--accent); color:var(--accent);" }, "Undo");
  undo.addEventListener("click", () => {
    if (db.undoLastProposal()) {
      showToast("Reverted");
      const view = document.getElementById("view");
      if (view) renderAssistant(view);
    }
    bar.remove();
  });
  bar.appendChild(undo);
  document.body.appendChild(bar);
  setTimeout(() => bar.remove(), 12000);
}

async function send(container) {
  if (busy) return;
  const input = container.querySelector("#prompt-input");
  const text = input.value.trim();
  if (!text) return;

  busy = true;
  input.value = "";
  conversation.push({ role: "user", content: text, display: text });
  pendingProposal = null;
  drawThread(container);
  drawProposal(container);

  const status = el("div", { class: "card" }, [
    el("div", { style: "font-size:13px; color:var(--text-dim);" }, "Thinking…")
  ]);
  container.querySelector("#thread").appendChild(status);

  try {
    await runAgentLoop(container, status);
  } catch (e) {
    const msg = e instanceof AIError ? e.message : "Something went wrong.";
    conversation.push({ role: "assistant", content: msg, display: `⚠️ ${msg}` });
  } finally {
    busy = false;
    status.remove();
    renderAssistant(container);
  }
}

async function runAgentLoop(container, status) {
  // API messages carry structured content; `display` is UI-only, so strip it.
  const apiMessages = conversation.map(({ role, content }) => ({ role, content }));

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const res = await complete({
      system: systemPrompt(),
      messages: apiMessages,
      tools: TOOLS
    });

    apiMessages.push({ role: "assistant", content: res.content });

    if (res.stop_reason !== "tool_use") {
      const text = textOf(res);
      conversation.push({ role: "assistant", content: res.content, display: text || "(no response)" });
      return;
    }

    const uses = toolUsesOf(res);
    const results = [];
    let proposed = false;

    for (const use of uses) {
      status.firstChild.textContent = statusFor(use.name);
      if (use.name === "propose_changes") {
        const ops = Array.isArray(use.input?.operations) ? use.input.operations.filter(validOp) : [];
        if (!ops.length) {
          results.push(toolResult(use.id, "No valid operations were included. Each operation needs a valid 'action'.", true));
        } else {
          pendingProposal = { summary: use.input.summary || "Proposed changes", operations: ops };
          proposed = true;
          results.push(toolResult(use.id, `Proposal with ${ops.length} operation(s) shown to the user for approval. Do not assume it was applied.`));
        }
      } else {
        try {
          results.push(toolResult(use.id, JSON.stringify(runReadTool(use.name, use.input || {}))));
        } catch (err) {
          results.push(toolResult(use.id, `Tool failed: ${err.message}`, true));
        }
      }
    }

    apiMessages.push({ role: "user", content: results });

    if (proposed) {
      // Let the model close with a sentence, but don't let it keep looping.
      const closing = await complete({ system: systemPrompt(), messages: apiMessages, tools: TOOLS, maxTokens: 1000 });
      conversation.push({
        role: "assistant",
        content: closing.content,
        display: textOf(closing) || "I've put a proposal together — review it below."
      });
      return;
    }
  }

  conversation.push({
    role: "assistant",
    content: "I couldn't finish that.",
    display: "I couldn't finish that within a reasonable number of steps. Try narrowing the request."
  });
}

function statusFor(name) {
  if (name === "get_financial_data") return "Reading your finances…";
  if (name === "search_transactions") return "Searching transactions…";
  if (name === "propose_changes") return "Preparing changes…";
  return "Working…";
}

function toolResult(id, content, isError = false) {
  const block = { type: "tool_result", tool_use_id: id, content };
  if (isError) block.is_error = true;
  return block;
}

function runReadTool(name, input) {
  if (name === "get_financial_data") return buildAIContext();
  if (name === "search_transactions") {
    const rows = db.searchTransactions(input).slice(0, 200);
    return { count: rows.length, transactions: rows.map((t) => ({ id: t.id, date: t.date, amount: t.amount, category: t.category, note: t.note || "" })) };
  }
  throw new Error(`Unknown tool ${name}`);
}

const VALID_ACTIONS = new Set(["add_budget", "delete_budget", "add_transaction", "add_recurring", "set_goal_saved"]);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// The model's output is untrusted input to our data layer -- reject anything
// malformed rather than writing a broken record.
function validOp(op) {
  if (!op || !VALID_ACTIONS.has(op.action)) return false;
  switch (op.action) {
    case "add_budget":
    case "add_transaction":
      return DATE_RE.test(op.date || "") && Number.isFinite(Number(op.amount)) && Number(op.amount) !== 0;
    case "delete_budget":
      return typeof op.id === "string" && op.id.length > 0;
    case "add_recurring":
      return typeof op.category === "string" && Number.isFinite(Number(op.amount)) && Number(op.amount) !== 0;
    case "set_goal_saved":
      return ["marriage", "home", "umrah"].includes(op.goal) && Number.isFinite(Number(op.amount));
    default:
      return false;
  }
}

function describeOp(op) {
  switch (op.action) {
    case "add_budget":
      return `Budget · ${fmtDate(op.date)} · ${op.category} · ${fmtMoney(op.amount)}`;
    case "delete_budget": {
      const item = db.data.budget.find((b) => b.id === op.id);
      return item ? `Remove budget · ${fmtDate(item.date)} · ${item.category} · ${fmtMoney(item.amount)}` : `Remove budget item ${op.id}`;
    }
    case "add_transaction":
      return `Transaction · ${fmtDate(op.date)} · ${op.category} · ${fmtMoney(op.amount)}`;
    case "add_recurring":
      return `Recurring · ${op.name || op.category} · ${fmtMoney(op.amount)} on day ${op.dayOfMonth || 1}`;
    case "set_goal_saved":
      return `Set ${op.goal} saved to ${fmtMoney(op.amount)}`;
    default:
      return op.action;
  }
}

function summarizeOps(ops) {
  const counts = {};
  let budgetTotal = 0;
  for (const op of ops) {
    counts[op.action] = (counts[op.action] || 0) + 1;
    if (op.action === "add_budget") budgetTotal += Number(op.amount) || 0;
  }
  const out = [];
  if (counts.add_budget) out.push(`Add ${counts.add_budget} budget entries (net ${fmtMoney(budgetTotal)})`);
  if (counts.delete_budget) out.push(`Remove ${counts.delete_budget} budget entries`);
  if (counts.add_transaction) out.push(`Add ${counts.add_transaction} transactions`);
  if (counts.add_recurring) out.push(`Add ${counts.add_recurring} recurring items`);
  if (counts.set_goal_saved) out.push(`Update ${counts.set_goal_saved} goal balance(s)`);
  return out;
}
