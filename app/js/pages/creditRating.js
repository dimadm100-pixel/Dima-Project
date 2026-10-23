import { db } from "../db.js";
import { t as T } from "../i18n.js";
import { fmtDate, todayStr, escapeHtml, svgSparkline } from "../utils.js";
import { openSheet, closeSheet, confirmAction, field, numberInput, dateInput, textInput, showToast } from "../ui.js";

// KATM scores out of 500, in five bands with letter grades, not on the
// 300-850 scale the rest of the world uses. The thresholds used to be the
// American ones, which labelled a perfectly good 420 as "needs work".
const MAX_SCORE = 500;

const BANDS = [
  { min: 401, letter: "A", key: "credit.excellent", color: "var(--accent)" },
  { min: 301, letter: "B", key: "credit.good", color: "var(--accent-2)" },
  { min: 201, letter: "C", key: "credit.fair", color: "var(--warn)" },
  { min: 101, letter: "D", key: "credit.needsWork", color: "var(--danger)" },
  { min: 0, letter: "E", key: "credit.poor", color: "var(--danger)" }
];

function qualitativeLabel(score) {
  const band = BANDS.find((b) => score >= b.min) || BANDS[BANDS.length - 1];
  return { text: T(band.key), letter: band.letter, color: band.color };
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
        <div class="amount">${latest.score}<span style="font-size:17px; font-weight:400; color:var(--text-dim);"> / ${MAX_SCORE}</span></div>
        <span class="badge" style="background:transparent; border:1px solid ${qualitativeLabel(latest.score).color}; color:${qualitativeLabel(latest.score).color};">${qualitativeLabel(latest.score).text} · ${qualitativeLabel(latest.score).letter}</span>
        <div class="progress-bar" style="margin-top:12px;"><div class="fill" style="width:${Math.max(0, Math.min(100, (latest.score / MAX_SCORE) * 100))}%; background:${qualitativeLabel(latest.score).color};"></div></div>
        <div class="sub" style="margin-top:8px;">${fmtDate(latest.date)}${latest.bureau ? " · " + escapeHtml(latest.bureau) : ""}</div>
      ` : `<div class="empty-state">${T("credit.noScore")}</div>`}
    </div>

    ${entries.length > 1 ? `
    <div class="card">
      <h2>${T("credit.trend")}</h2>
      ${svgSparkline(entries.map((e) => ({ value: e.score })), { height: 70, baseline: "auto" })}
    </div>` : ""}

    <div class="card">
      <h2>${T("credit.bandsTitle")}</h2>
      <table>
        <tbody>
          ${BANDS.map((b, i) => {
            const upper = i === 0 ? MAX_SCORE : BANDS[i - 1].min - 1;
            const active = latest && latest.score >= b.min && latest.score <= upper;
            return `<tr style="${active ? "background:var(--accent-fade);" : ""}">
              <td style="font-weight:700; color:${b.color};">${b.letter}</td>
              <td>${T(b.key)}</td>
              <td class="num" style="color:var(--text-dim);">${b.min}–${upper}</td>
            </tr>`;
          }).join("")}
        </tbody>
      </table>
    </div>

    <div class="card">
      <h2>${T("credit.history")}</h2>
      ${reversed.length ? `
      <table>
        <tbody>
          ${reversed.map((e) => `
            <tr>
              <td>${fmtDate(e.date)}${e.bureau ? `<br><span style="color:var(--text-dim); font-size:11px;">${escapeHtml(e.bureau)}</span>` : ""}${e.notes ? `<br><span style="color:var(--text-dim); font-size:11px;">${escapeHtml(e.notes)}</span>` : ""}</td>
              <td class="num" style="font-weight:700;">${e.score}<span style="font-weight:400; color:var(--text-dim);"> / ${MAX_SCORE}</span><br><span style="font-size:11px; font-weight:700; color:${qualitativeLabel(e.score).color};">${qualitativeLabel(e.score).letter}</span></td>
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
  const scoreInput = numberInput({ placeholder: T("credit.scorePlaceholder"), min: "0", max: String(MAX_SCORE) });
  const bureauInput = textInput({ placeholder: T("common.optional") });
  const notesInput = textInput({ placeholder: T("common.optional") });
  form.appendChild(field(T("common.date"), dateEl));
  form.appendChild(field(T("credit.scoreOutOf", { max: MAX_SCORE }), scoreInput));
  form.appendChild(field(T("credit.bureau"), bureauInput));
  form.appendChild(field(T("credit.notes"), notesInput));
  const btn = document.createElement("button");
  btn.className = "btn";
  btn.textContent = T("common.save");
  btn.addEventListener("click", () => {
    if (!scoreInput.value) { showToast(T("credit.needScore")); return; }
    const score = parseFloat(scoreInput.value);
    // A number outside the scale is a typo, not a score: without this, 720
    // from a different bureau's scale would silently land in the top band.
    if (!Number.isFinite(score) || score < 0 || score > MAX_SCORE) {
      showToast(T("credit.outOfRange", { max: MAX_SCORE }));
      return;
    }
    db.addCreditEntry({ date: dateEl.value || todayStr(), score, bureau: bureauInput.value.trim(), notes: notesInput.value.trim() });
    closeSheet();
    onDone();
    showToast(T("credit.scoreLogged"));
  });
  form.appendChild(btn);
  openSheet(T("credit.logScoreTitle"), form);
}
