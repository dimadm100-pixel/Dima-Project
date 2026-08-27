import { db } from "../db.js";
import { todayStr, el } from "../utils.js";
import { showToast } from "../ui.js";

/**
 * First-run setup.
 *
 * Only shown when there are no accounts at all. A seeded install (like one
 * carried over from a spreadsheet) always has accounts, so this never
 * interrupts an existing user -- it exists for a fresh, empty install, where
 * logging is otherwise blocked until an account exists.
 */
export function needsOnboarding() {
  return !db.data.accounts || db.data.accounts.length === 0;
}

export function renderOnboarding(container, onDone) {
  container.innerHTML = `
    <div class="page-title">Welcome</div>
    <p class="page-sub">Two quick things and you're set up. You can change all of it later.</p>

    <div class="card">
      <h2>Where do you keep your money?</h2>
      <p style="color:var(--text-dim); font-size:12px; margin-top:-6px;">
        Add the card or wallet you use most. Every expense gets assigned to one of these, so the app always knows
        what you actually have on each card. You can add more later.
      </p>
      <div class="field">
        <label>Name</label>
        <input type="text" id="acc-name" placeholder="e.g. Main card, or Cash" value="Cash">
      </div>
      <div class="field">
        <label>How much is on it right now? (UZS)</label>
        <input type="number" id="acc-balance" placeholder="0" inputmode="decimal">
      </div>
    </div>

    <div class="card">
      <h2>Starting date</h2>
      <p style="color:var(--text-dim); font-size:12px; margin-top:-6px;">
        Your records begin here. Usually today.
      </p>
      <div class="field">
        <label>Start tracking from</label>
        <input type="date" id="start-date" value="${todayStr()}">
      </div>
    </div>

    <button class="btn" id="finish-setup">Start tracking</button>
    <p style="text-align:center; color:var(--text-dim); font-size:11px; margin-top:14px;">
      Everything stays on this device. Nothing is uploaded anywhere.
    </p>
  `;

  container.querySelector("#finish-setup").addEventListener("click", () => {
    const name = container.querySelector("#acc-name").value.trim();
    if (!name) { showToast("Give the account a name"); return; }
    const balance = parseFloat(container.querySelector("#acc-balance").value) || 0;
    const startDate = container.querySelector("#start-date").value || todayStr();

    db.addAccount({ name, number: "", openingBalance: balance });
    db.setOpeningBalance(balance, startDate);

    showToast("All set");
    onDone();
  });
}
