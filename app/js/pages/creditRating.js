import { db } from "../db.js";
import { t as T } from "../i18n.js";
import { fmtDate, todayStr, escapeHtml, svgSparkline } from "../utils.js";
import { openSheet, closeSheet, confirmAction, field, numberInput, dateInput, textInput, showToast } from "../ui.js";

function qualitativeLabel(score) {
  if (score >= 800) return { text: T("credit.excellent"), color: "var(--accent)" };
  if (score >= 700) return { text: T("credit.good"), color: "var(--accent-2)" };
  if (score >= 600) return { text: T("credit.fair"), color: "var(--warn)" };
  return { text: T("credit.needsWork"), color: "var(--danger)" };
}

export function renderCreditRating(container) {
  const entries = [...db.data.creditRating].sort((a, b) => a.date.localeCompare(b.date));
  const latest = entries[entries.length - 1];
  const reversed = [...entries].reverse();

  container.innerHTML = `
    <div class="page-title">${T("credit.title")}</div>
    <p class="page-sub">${T("credit.sub")}</p>

    <div class="card hero-balance">
      ${latest ? `
        <div class="label">${T("credit.latestScore")}</div>
        <div class="amount">${latest.score}</div>
        <span class="badge" style="background:transparent; border:1px solid ${qualitativeLabel(latest.score).color}; color:${qualitativeLabel(latest.score).color};">${qualitativeLabel(latest.score).text}</span>
        <div class="sub" style="margin-top:8px;">${fmtDate(latest.date)}${latest.bureau ? " · " + escapeHtml(latest.bureau) : ""}</div>
      ` : `<div class="empty-state">${T("credit.noScore")}</div>`}
    </div>

    ${entries.length > 1 ? `
    <div class="card">
      <h2>${T("credit.trend")}</h2>
      ${svgSparkline(entries.map((e) => ({ value: e.score })), { height: 70, baseline: "auto" })}
    </div>` : ""}

    <div class="card">
      <h2>${T("credit.history")}</h2>
      ${reversed.length ? `
      <table>
        <tbody>
          ${reversed.map((e) => `
            <tr>
              <td>${fmtDate(e.date)}${e.bureau ? `<br><span style="color:var(--text-dim); font-size:11px;">${escapeHtml(e.bureau)}</span>` : ""}${e.notes ? `<br><span style="color:var(--text-dim); font-size:11px;">${escapeHtml(e.notes)}</span>` : ""}</td>
              <td class="num" style="font-weight:700;">${e.score}</td>
              <td><button class="mini-btn danger" data-del-credit="${e.id}">${T("common.del")}</button></td>
            </tr>`).join("")}
        </tbody>
      </table>` : `<div class="empty-state">${T("credit.nothingLogged")}</div>`}
      <button class="btn secondary small" id="add-credit" style="margin-top:10px;">${T("credit.logScore")}</button>
    </div>
  `;

  container.querySelector("#add-credit").addEventListener("click", () => openCreditEditor(() => renderCreditRating(container)));
  container.querySelectorAll("[data-del-credit]").forEach((btn) => {
    btn.addEventListener("click", () => confirmAction(T("credit.confirmDelete"), () => { db.deleteCreditEntry(btn.dataset.delCredit); renderCreditRating(container); }));
  });
}

function openCreditEditor(onDone) {
  const form = document.createElement("div");
  const dateEl = dateInput({ value: todayStr() });
  const scoreInput = numberInput({ placeholder: T("credit.scorePlaceholder") });
  const bureauInput = textInput({ placeholder: T("common.optional") });
  const notesInput = textInput({ placeholder: T("common.optional") });
  form.appendChild(field(T("common.date"), dateEl));
  form.appendChild(field(T("credit.score"), scoreInput));
  form.appendChild(field(T("credit.bureau"), bureauInput));
  form.appendChild(field(T("credit.notes"), notesInput));
  const btn = document.createElement("button");
  btn.className = "btn";
  btn.textContent = T("common.save");
  btn.addEventListener("click", () => {
    if (!scoreInput.value) { showToast(T("credit.needScore")); return; }
    db.addCreditEntry({ date: dateEl.value || todayStr(), score: parseFloat(scoreInput.value), bureau: bureauInput.value.trim(), notes: notesInput.value.trim() });
    closeSheet();
    onDone();
    showToast(T("credit.scoreLogged"));
  });
  form.appendChild(btn);
  openSheet(T("credit.logScoreTitle"), form);
}
