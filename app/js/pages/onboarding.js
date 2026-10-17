import { db } from "../db.js";
import { todayStr } from "../utils.js";
import { showToast } from "../ui.js";
import { t as T, LANGS, getLang, setLang } from "../i18n.js";

/**
 * First-run setup.
 *
 * Only shown when there are no accounts at all. A seeded install (like one
 * carried over from a spreadsheet) always has accounts, so this never
 * interrupts an existing user -- it exists for a fresh, empty install, where
 * logging is otherwise blocked until an account exists.
 *
 * The language choice comes first, before anything that needs reading: there
 * is no point asking someone for their opening balance in a language they do
 * not speak.
 */
export function needsOnboarding() {
  return !db.data.accounts || db.data.accounts.length === 0;
}

export function renderOnboarding(container, onDone) {
  const lang = getLang();

  container.innerHTML = `
    <div class="page-title">${T("onboarding.title")}</div>
    <p class="page-sub">${T("onboarding.sub")}</p>

    <div class="card">
      <h2>${T("onboarding.languageTitle")}</h2>
      <div class="segmented" style="margin-top:12px;">
        ${LANGS.map((l) => `<button data-set-lang="${l.code}" class="${l.code === lang ? "active" : ""}">${l.label}</button>`).join("")}
      </div>
    </div>

    <div class="card">
      <h2>${T("onboarding.accountTitle")}</h2>
      <p style="color:var(--text-dim); font-size:12px; margin-top:-6px;">${T("onboarding.accountHint")}</p>
      <div class="field">
        <label>${T("onboarding.accountName")}</label>
        <input type="text" id="acc-name" placeholder="${T("onboarding.accountNamePlaceholder")}" value="${T("onboarding.accountNameDefault")}">
      </div>
      <div class="field">
        <label>${T("onboarding.accountBalance")}</label>
        <input type="number" id="acc-balance" placeholder="0" inputmode="decimal">
      </div>
    </div>

    <div class="card">
      <h2>${T("onboarding.startTitle")}</h2>
      <p style="color:var(--text-dim); font-size:12px; margin-top:-6px;">${T("onboarding.startHint")}</p>
      <div class="field">
        <label>${T("onboarding.startDate")}</label>
        <input type="date" id="start-date" value="${todayStr()}">
      </div>
    </div>

    <button class="btn" id="finish-setup">${T("onboarding.finish")}</button>
    <p style="text-align:center; color:var(--text-dim); font-size:11px; margin-top:14px;">
      ${T("onboarding.privacy")}
    </p>
  `;

  container.querySelectorAll("[data-set-lang]").forEach((btn) => {
    btn.addEventListener("click", () => {
      // Keep whatever has already been typed across the redraw, so changing
      // language does not wipe a half-filled form.
      const typed = {
        name: container.querySelector("#acc-name").value,
        balance: container.querySelector("#acc-balance").value,
        date: container.querySelector("#start-date").value
      };
      const wasDefault = typed.name === T("onboarding.accountNameDefault");
      setLang(btn.dataset.setLang);
      renderOnboarding(container, onDone);
      if (!wasDefault) container.querySelector("#acc-name").value = typed.name;
      container.querySelector("#acc-balance").value = typed.balance;
      container.querySelector("#start-date").value = typed.date;
    });
  });

  container.querySelector("#finish-setup").addEventListener("click", () => {
    const name = container.querySelector("#acc-name").value.trim();
    if (!name) { showToast(T("onboarding.needName")); return; }
    const balance = parseFloat(container.querySelector("#acc-balance").value) || 0;
    const startDate = container.querySelector("#start-date").value || todayStr();

    // The account holds the starting figure; the opening total is derived
    // from the accounts, so there is nothing to set twice.
    db.addAccount({ name, number: "", openingBalance: balance });
    db.setOpeningDate(startDate);

    showToast(T("onboarding.done"));
    onDone();
  });
}
