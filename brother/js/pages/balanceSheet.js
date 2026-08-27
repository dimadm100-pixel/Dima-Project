import { db } from "../db.js";
import { fmtMoney, escapeHtml } from "../utils.js";
import { openSheet, closeSheet, confirmAction, field, numberInput, textInput, showToast } from "../ui.js";

export function renderBalanceSheet(container) {
  const bs = db.balanceSheet();
  const extra = db.data.balanceSheetExtra;

  container.innerHTML = `
    <div class="page-title">Balance Sheet</div>
    <p class="page-sub">Assets, liabilities and net worth — as of today, derived from your real balance.</p>

    <div class="card hero-balance">
      <div class="label">Net worth (equity)</div>
      <div class="amount" style="color:${bs.equity >= 0 ? "var(--accent)" : "var(--danger)"};">${fmtMoney(bs.equity)}</div>
    </div>

    <div class="card">
      <h2>Assets</h2>
      <table>
        <tbody>
          <tr><td>Cash (from Cash Position)</td><td class="num">${fmtMoney(bs.cash)}</td><td></td></tr>
          <tr>
            <td>Investments</td>
            <td class="num">${fmtMoney(extra.investments)}</td>
            <td class="row-actions" style="justify-content:flex-end;"><button class="mini-btn" id="edit-investments">Edit</button></td>
          </tr>
          ${extra.otherAssets.map((a) => `
            <tr>
              <td>${escapeHtml(a.name)}</td>
              <td class="num">${fmtMoney(a.value)}</td>
              <td class="row-actions" style="justify-content:flex-end;"><button class="mini-btn danger" data-del-asset="${a.id}">Del</button></td>
            </tr>`).join("")}
          <tr>
            <td style="font-weight:700;">Total assets</td>
            <td class="num" style="font-weight:700;">${fmtMoney(bs.totalAssets)}</td>
            <td></td>
          </tr>
        </tbody>
      </table>
      <button class="btn secondary small" id="add-asset-btn" style="margin-top:10px;">+ Add other asset</button>
    </div>

    <div class="card">
      <h2>Liabilities</h2>
      ${extra.liabilities.length ? `
      <table>
        <tbody>
          ${extra.liabilities.map((l) => `
            <tr>
              <td>${escapeHtml(l.name)}</td>
              <td class="num">${fmtMoney(l.value)}</td>
              <td class="row-actions" style="justify-content:flex-end;"><button class="mini-btn danger" data-del-liab="${l.id}">Del</button></td>
            </tr>`).join("")}
          <tr>
            <td style="font-weight:700;">Total liabilities</td>
            <td class="num" style="font-weight:700;">${fmtMoney(bs.totalLiabilities)}</td>
            <td></td>
          </tr>
        </tbody>
      </table>` : `<div class="empty-state">No debts logged. Nice.</div>`}
      <button class="btn secondary small" id="add-liab-btn" style="margin-top:10px;">+ Add liability</button>
    </div>

    <div class="card">
      <h2>Equity</h2>
      <table>
        <tbody>
          <tr><td>Total assets</td><td class="num">${fmtMoney(bs.totalAssets)}</td></tr>
          <tr><td>Total liabilities</td><td class="num">− ${fmtMoney(bs.totalLiabilities)}</td></tr>
          <tr><td style="font-weight:700;">Equity (net worth)</td><td class="num" style="font-weight:700;">${fmtMoney(bs.equity)}</td></tr>
        </tbody>
      </table>
    </div>
  `;

  container.querySelector("#edit-investments").addEventListener("click", () => {
    const form = document.createElement("div");
    const input = numberInput({ value: extra.investments });
    form.appendChild(field("Investments (UZS)", input));
    const btn = document.createElement("button");
    btn.className = "btn";
    btn.textContent = "Save";
    btn.addEventListener("click", () => {
      db.updateBalanceSheetExtra({ investments: parseFloat(input.value) || 0 });
      closeSheet();
      renderBalanceSheet(container);
    });
    form.appendChild(btn);
    openSheet("Investments", form);
  });

  container.querySelector("#add-asset-btn").addEventListener("click", () => {
    openLineItemEditor("Add asset", (name, value) => { db.addOtherAsset({ name, value }); renderBalanceSheet(container); });
  });
  container.querySelector("#add-liab-btn").addEventListener("click", () => {
    openLineItemEditor("Add liability", (name, value) => { db.addLiability({ name, value }); renderBalanceSheet(container); });
  });
  container.querySelectorAll("[data-del-asset]").forEach((btn) => {
    btn.addEventListener("click", () => confirmAction("Remove this asset?", () => { db.deleteOtherAsset(btn.dataset.delAsset); renderBalanceSheet(container); }));
  });
  container.querySelectorAll("[data-del-liab]").forEach((btn) => {
    btn.addEventListener("click", () => confirmAction("Remove this liability?", () => { db.deleteLiability(btn.dataset.delLiab); renderBalanceSheet(container); }));
  });
}

function openLineItemEditor(title, onSave) {
  const form = document.createElement("div");
  const nameInput = textInput({ placeholder: "e.g. car, savings account, loan" });
  const valueInput = numberInput({ placeholder: "0" });
  form.appendChild(field("Name", nameInput));
  form.appendChild(field("Value (UZS)", valueInput));
  const btn = document.createElement("button");
  btn.className = "btn";
  btn.textContent = "Save";
  btn.addEventListener("click", () => {
    if (!nameInput.value.trim()) { showToast("Enter a name"); return; }
    onSave(nameInput.value.trim(), parseFloat(valueInput.value) || 0);
    closeSheet();
  });
  form.appendChild(btn);
  openSheet(title, form);
}
