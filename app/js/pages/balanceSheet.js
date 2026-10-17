import { db } from "../db.js";
import { t as T } from "../i18n.js";
import { fmtMoney, escapeHtml } from "../utils.js";
import { openSheet, closeSheet, confirmAction, field, numberInput, textInput, showToast } from "../ui.js";

export function renderBalanceSheet(container) {
  const bs = db.balanceSheet();
  const extra = db.data.balanceSheetExtra;

  container.innerHTML = `
    <div class="page-title">${T("balance.title")}</div>
    <p class="page-sub">${T("balance.sub")}</p>

    <div class="card hero-balance">
      <div class="label">${T("balance.netWorth")}</div>
      <div class="amount" style="color:${bs.equity >= 0 ? "var(--accent)" : "var(--danger)"};">${fmtMoney(bs.equity)}</div>
    </div>

    <div class="card">
      <h2>${T("balance.assets")}</h2>
      <table>
        <tbody>
          <tr><td>${T("balance.cashFromPosition")}</td><td class="num">${fmtMoney(bs.cash)}</td><td></td></tr>
          <tr>
            <td>${T("balance.investments")}</td>
            <td class="num">${fmtMoney(extra.investments)}</td>
            <td class="row-actions" style="justify-content:flex-end;"><button class="mini-btn" id="edit-investments">${T("common.edit")}</button></td>
          </tr>
          ${extra.otherAssets.map((a) => `
            <tr>
              <td>${escapeHtml(a.name)}</td>
              <td class="num">${fmtMoney(a.value)}</td>
              <td class="row-actions" style="justify-content:flex-end;"><button class="mini-btn danger" data-del-asset="${a.id}">${T("common.del")}</button></td>
            </tr>`).join("")}
          <tr>
            <td style="font-weight:700;">${T("balance.totalAssets")}</td>
            <td class="num" style="font-weight:700;">${fmtMoney(bs.totalAssets)}</td>
            <td></td>
          </tr>
        </tbody>
      </table>
      <button class="btn secondary small" id="add-asset-btn" style="margin-top:10px;">+ Add other asset</button>
    </div>

    <div class="card">
      <h2>${T("balance.liabilities")}</h2>
      ${extra.liabilities.length ? `
      <table>
        <tbody>
          ${extra.liabilities.map((l) => `
            <tr>
              <td>${escapeHtml(l.name)}</td>
              <td class="num">${fmtMoney(l.value)}</td>
              <td class="row-actions" style="justify-content:flex-end;"><button class="mini-btn danger" data-del-liab="${l.id}">${T("common.del")}</button></td>
            </tr>`).join("")}
          <tr>
            <td style="font-weight:700;">${T("balance.totalLiabilities")}</td>
            <td class="num" style="font-weight:700;">${fmtMoney(bs.totalLiabilities)}</td>
            <td></td>
          </tr>
        </tbody>
      </table>` : `<div class="empty-state">${T("balance.noDebts")}</div>`}
      <button class="btn secondary small" id="add-liab-btn" style="margin-top:10px;">+ Add liability</button>
    </div>

    <div class="card">
      <h2>${T("balance.equity")}</h2>
      <table>
        <tbody>
          <tr><td>${T("balance.totalAssets")}</td><td class="num">${fmtMoney(bs.totalAssets)}</td></tr>
          <tr><td>${T("balance.totalLiabilities")}</td><td class="num">− ${fmtMoney(bs.totalLiabilities)}</td></tr>
          <tr><td style="font-weight:700;">${T("balance.equityNetWorth")}</td><td class="num" style="font-weight:700;">${fmtMoney(bs.equity)}</td></tr>
        </tbody>
      </table>
    </div>
  `;

  container.querySelector("#edit-investments").addEventListener("click", () => {
    const form = document.createElement("div");
    const input = numberInput({ value: extra.investments });
    form.appendChild(field(T("balance.investmentsAmount"), input));
    const btn = document.createElement("button");
    btn.className = "btn";
    btn.textContent = T("common.save");
    btn.addEventListener("click", () => {
      db.updateBalanceSheetExtra({ investments: parseFloat(input.value) || 0 });
      closeSheet();
      renderBalanceSheet(container);
    });
    form.appendChild(btn);
    openSheet(T("balance.investments"), form);
  });

  container.querySelector("#add-asset-btn").addEventListener("click", () => {
    openLineItemEditor(T("balance.addAsset"), (name, value) => { db.addOtherAsset({ name, value }); renderBalanceSheet(container); });
  });
  container.querySelector("#add-liab-btn").addEventListener("click", () => {
    openLineItemEditor(T("balance.addLiability"), (name, value) => { db.addLiability({ name, value }); renderBalanceSheet(container); });
  });
  container.querySelectorAll("[data-del-asset]").forEach((btn) => {
    btn.addEventListener("click", () => confirmAction(T("balance.confirmRemoveAsset"), () => { db.deleteOtherAsset(btn.dataset.delAsset); renderBalanceSheet(container); }));
  });
  container.querySelectorAll("[data-del-liab]").forEach((btn) => {
    btn.addEventListener("click", () => confirmAction(T("balance.confirmRemoveLiability"), () => { db.deleteLiability(btn.dataset.delLiab); renderBalanceSheet(container); }));
  });
}

function openLineItemEditor(title, onSave) {
  const form = document.createElement("div");
  const nameInput = textInput({ placeholder: T("balance.lineItemPlaceholder") });
  const valueInput = numberInput({ placeholder: "0" });
  form.appendChild(field(T("common.name"), nameInput));
  form.appendChild(field(T("balance.value"), valueInput));
  const btn = document.createElement("button");
  btn.className = "btn";
  btn.textContent = T("common.save");
  btn.addEventListener("click", () => {
    if (!nameInput.value.trim()) { showToast(T("common.needName")); return; }
    onSave(nameInput.value.trim(), parseFloat(valueInput.value) || 0);
    closeSheet();
  });
  form.appendChild(btn);
  openSheet(title, form);
}
