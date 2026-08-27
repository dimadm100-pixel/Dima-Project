import { db } from "../db.js";
import { fmtDate, todayStr, escapeHtml, svgSparkline } from "../utils.js";
import { openSheet, closeSheet, confirmAction, field, numberInput, dateInput, textInput, showToast } from "../ui.js";

function qualitativeLabel(score) {
  if (score >= 800) return { text: "Excellent", color: "var(--accent)" };
  if (score >= 700) return { text: "Good", color: "var(--accent-2)" };
  if (score >= 600) return { text: "Fair", color: "var(--warn)" };
  return { text: "Needs work", color: "var(--danger)" };
}

export function renderCreditRating(container) {
  const entries = [...db.data.creditRating].sort((a, b) => a.date.localeCompare(b.date));
  const latest = entries[entries.length - 1];
  const reversed = [...entries].reverse();

  container.innerHTML = `
    <div class="page-title">Credit Rating</div>
    <p class="page-sub">Keep an eye on your score over time.</p>

    <div class="card hero-balance">
      ${latest ? `
        <div class="label">Latest score</div>
        <div class="amount">${latest.score}</div>
        <span class="badge" style="background:transparent; border:1px solid ${qualitativeLabel(latest.score).color}; color:${qualitativeLabel(latest.score).color};">${qualitativeLabel(latest.score).text}</span>
        <div class="sub" style="margin-top:8px;">${fmtDate(latest.date)}${latest.bureau ? " · " + escapeHtml(latest.bureau) : ""}</div>
      ` : `<div class="empty-state">No score logged yet. Tap + to add one.</div>`}
    </div>

    ${entries.length > 1 ? `
    <div class="card">
      <h2>Trend</h2>
      ${svgSparkline(entries.map((e) => ({ value: e.score })), { height: 70, baseline: "auto" })}
    </div>` : ""}

    <div class="card">
      <h2>History</h2>
      ${reversed.length ? `
      <table>
        <tbody>
          ${reversed.map((e) => `
            <tr>
              <td>${fmtDate(e.date)}${e.bureau ? `<br><span style="color:var(--text-dim); font-size:11px;">${escapeHtml(e.bureau)}</span>` : ""}${e.notes ? `<br><span style="color:var(--text-dim); font-size:11px;">${escapeHtml(e.notes)}</span>` : ""}</td>
              <td class="num" style="font-weight:700;">${e.score}</td>
              <td><button class="mini-btn danger" data-del-credit="${e.id}">Del</button></td>
            </tr>`).join("")}
        </tbody>
      </table>` : `<div class="empty-state">Nothing logged yet.</div>`}
      <button class="btn secondary small" id="add-credit" style="margin-top:10px;">+ Log a score</button>
    </div>
  `;

  container.querySelector("#add-credit").addEventListener("click", () => openCreditEditor(() => renderCreditRating(container)));
  container.querySelectorAll("[data-del-credit]").forEach((btn) => {
    btn.addEventListener("click", () => confirmAction("Delete this entry?", () => { db.deleteCreditEntry(btn.dataset.delCredit); renderCreditRating(container); }));
  });
}

function openCreditEditor(onDone) {
  const form = document.createElement("div");
  const dateEl = dateInput({ value: todayStr() });
  const scoreInput = numberInput({ placeholder: "e.g. 720" });
  const bureauInput = textInput({ placeholder: "optional" });
  const notesInput = textInput({ placeholder: "optional" });
  form.appendChild(field("Date", dateEl));
  form.appendChild(field("Score", scoreInput));
  form.appendChild(field("Source / bureau", bureauInput));
  form.appendChild(field("Notes", notesInput));
  const btn = document.createElement("button");
  btn.className = "btn";
  btn.textContent = "Save";
  btn.addEventListener("click", () => {
    if (!scoreInput.value) { showToast("Enter a score"); return; }
    db.addCreditEntry({ date: dateEl.value || todayStr(), score: parseFloat(scoreInput.value), bureau: bureauInput.value.trim(), notes: notesInput.value.trim() });
    closeSheet();
    onDone();
    showToast("Score logged");
  });
  form.appendChild(btn);
  openSheet("Log credit score", form);
}
