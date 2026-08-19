import { db } from "../db.js";
import { fmtDate } from "../utils.js";
import { openSheet, closeSheet, confirmAction, field, numberInput, dateInput, showToast } from "../ui.js";

export function renderSettings(container) {
  container.innerHTML = `
    <div class="page-title">Settings</div>
    <p class="page-sub">Your data lives only on this device. Back it up regularly.</p>

    <div class="card">
      <h2>Opening balance</h2>
      <p style="color:var(--text-dim); font-size:12px; margin-top:-6px;">The starting point your Cash Position is built from.</p>
      <button class="btn secondary small" id="edit-opening">Edit opening balance</button>
    </div>

    <div class="card">
      <h2>Backup</h2>
      <p style="color:var(--text-dim); font-size:13px;">Export your data to a file you can keep safe, and re-import it any time (e.g. after reinstalling, or to move to a new phone).</p>
      <button class="btn" id="export-btn">Export data (.json)</button>
      <div style="height:10px;"></div>
      <label class="btn secondary" style="display:block; text-align:center; cursor:pointer;">
        Import data (.json)
        <input type="file" id="import-input" accept="application/json" style="display:none;">
      </label>
    </div>

    <div class="card">
      <h2>Danger zone</h2>
      <button class="btn danger" id="reset-btn">Reset all data</button>
    </div>

    <p style="text-align:center; color:var(--text-dim); font-size:11px; margin-top:20px;">Dima Finance Tracker · installed as a PWA · works offline</p>
  `;

  container.querySelector("#edit-opening").addEventListener("click", () => {
    const form = document.createElement("div");
    const amtInput = numberInput({ value: db.data.meta.openingBalance });
    const dateEl = dateInput({ value: db.data.meta.openingDate });
    form.appendChild(field("Opening balance (UZS)", amtInput));
    form.appendChild(field("Opening date", dateEl));
    const btn = document.createElement("button");
    btn.className = "btn";
    btn.textContent = "Save";
    btn.addEventListener("click", () => {
      db.setOpeningBalance(parseFloat(amtInput.value) || 0, dateEl.value);
      closeSheet();
      showToast("Opening balance updated");
      renderSettings(container);
    });
    form.appendChild(btn);
    openSheet("Opening balance", form);
  });

  container.querySelector("#export-btn").addEventListener("click", () => {
    const json = db.exportJSON();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `finance-backup-${fmtDate(new Date().toISOString().slice(0, 10)).replace(/ /g, "-")}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast("Exported");
  });

  container.querySelector("#import-input").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      confirmAction("Importing will replace all current data on this device. Continue?", () => {
        try {
          db.importJSON(reader.result);
          showToast("Data imported");
          window.location.hash = "#dashboard";
        } catch (err) {
          showToast("Could not read that file");
        }
      });
    };
    reader.readAsText(file);
    e.target.value = "";
  });

  container.querySelector("#reset-btn").addEventListener("click", () => {
    confirmAction("This wipes all your logged transactions and restores the original seed data. Continue?", () => {
      db.resetToSeed();
      showToast("Reset complete");
      window.location.hash = "#dashboard";
    });
  });
}
