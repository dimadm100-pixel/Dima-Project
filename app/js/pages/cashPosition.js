import { db } from "../db.js";
import { fmtMoney, fmtDate, escapeHtml } from "../utils.js";
import { openSheet, closeSheet, confirmAction, field, numberInput, dateInput, textInput, selectInput, categoryField, showToast } from "../ui.js";
import { openTransactionModal } from "./transactionForm.js";

export function renderCashPosition(container) {
  const ledger = db.cashPositionLedger().slice().reverse(); // newest first
  const accounts = db.data.accounts;
  const accountsTotal = db.accountsTotal();
  const currentBalance = db.currentBalance();
  const diff = accountsTotal - currentBalance;

  container.innerHTML = `
    <div class="page-title">Cash Position</div>
    <p class="page-sub">Your real, day-by-day ledger — actual money in, actual money out.</p>

    <div class="card hero-balance">
      <div class="label">Balance as of today</div>
      <div class="amount">${fmtMoney(currentBalance)}</div>
    </div>

    <div class="card">
      <h2>Accounts <span style="font-weight:400; color:var(--text-dim); font-size:12px;">(manual snapshot)</span></h2>
      <table>
        <tbody>
          ${accounts.map((a) => `
            <tr data-account-row="${a.id}">
              <td>${escapeHtml(a.name)}${a.number ? `<br><span style="color:var(--text-dim); font-size:11px;">•• ${escapeHtml(a.number)}</span>` : ""}</td>
              <td class="num">${fmtMoney(a.balance)}</td>
              <td class="row-actions" style="justify-content:flex-end;"><button class="mini-btn" data-edit-account="${a.id}">Edit</button></td>
            </tr>`).join("")}
          <tr>
            <td style="font-weight:700;">Total</td>
            <td class="num" style="font-weight:700;">${fmtMoney(accountsTotal)}</td>
            <td></td>
          </tr>
        </tbody>
      </table>
      ${Math.abs(diff) > 1 ? `<p style="color:var(--warn); font-size:12px; margin-top:10px;">Accounts total is ${fmtMoney(diff)} off from the ledger balance — worth a quick reconcile.</p>` : `<p style="color:var(--text-dim); font-size:12px; margin-top:10px;">Matches your ledger balance.</p>`}
      <button class="btn secondary small" id="add-account-btn" style="margin-top:10px;">+ Add account</button>
    </div>

    <div class="card">
      <h2>Ledger</h2>
      ${ledger.length <= 1 ? `<div class="empty-state">No transactions yet. Tap the + button to log your first one.</div>` : ""}
      <table>
        <tbody>
          ${ledger.map((row) => rowHTML(row)).join("")}
        </tbody>
      </table>
    </div>
  `;

  container.querySelectorAll("[data-edit-account]").forEach((btn) => {
    btn.addEventListener("click", () => openAccountEditor(btn.dataset.editAccount, () => renderCashPosition(container)));
  });
  container.querySelector("#add-account-btn").addEventListener("click", () => openAccountEditor(null, () => renderCashPosition(container)));

  container.querySelectorAll("[data-edit-tx]").forEach((btn) => {
    btn.addEventListener("click", () => openTxEditor(btn.dataset.editTx, () => renderCashPosition(container)));
  });
  container.querySelectorAll("[data-delete-tx]").forEach((btn) => {
    btn.addEventListener("click", () => {
      confirmAction("Delete this transaction?", () => {
        db.deleteActual(btn.dataset.deleteTx);
        renderCashPosition(container);
        showToast("Transaction deleted");
      });
    });
  });
}

function rowHTML(row) {
  if (row.type === "opening") {
    return `<tr>
      <td colspan="2" style="color:var(--text-dim);">Opening balance, ${fmtDate(row.date)}</td>
      <td class="num" style="font-weight:700;">${fmtMoney(row.balance)}</td>
    </tr>`;
  }
  return `<tr>
    <td>${fmtDate(row.date)}<br><span style="color:var(--text-dim); font-size:11px;">${escapeHtml(row.label)}${row.note ? " · " + escapeHtml(row.note) : ""}</span></td>
    <td class="num ${row.amount >= 0 ? "amt-pos" : "amt-neg"}">${fmtMoney(row.amount)}<br><span style="color:var(--text-dim); font-size:11px; font-weight:400;">${fmtMoney(row.balance)}</span></td>
    <td class="row-actions" style="justify-content:flex-end;">
      <button class="mini-btn" data-edit-tx="${row.id}">Edit</button>
      <button class="mini-btn danger" data-delete-tx="${row.id}">Del</button>
    </td>
  </tr>`;
}

function openAccountEditor(id, onDone) {
  const acc = id ? db.data.accounts.find((a) => a.id === id) : null;
  const form = document.createElement("div");
  const nameInput = textInput({ value: acc?.name || "" });
  const numberInputEl = textInput({ value: acc?.number || "" });
  const balanceInputEl = numberInput({ value: acc?.balance ?? 0 });
  form.appendChild(field("Name", nameInput));
  form.appendChild(field("Card / account number (optional)", numberInputEl));
  form.appendChild(field("Current balance (UZS)", balanceInputEl));

  const saveBtn = document.createElement("button");
  saveBtn.className = "btn";
  saveBtn.textContent = "Save";
  saveBtn.addEventListener("click", () => {
    if (!nameInput.value.trim()) { showToast("Enter a name"); return; }
    if (acc) {
      db.updateAccount(acc.id, { name: nameInput.value.trim(), number: numberInputEl.value.trim(), balance: parseFloat(balanceInputEl.value) || 0 });
    } else {
      db.addAccount({ name: nameInput.value.trim(), number: numberInputEl.value.trim(), balance: parseFloat(balanceInputEl.value) || 0 });
    }
    closeSheet();
    onDone();
  });
  form.appendChild(saveBtn);

  if (acc) {
    const delBtn = document.createElement("button");
    delBtn.className = "btn danger";
    delBtn.style.marginTop = "10px";
    delBtn.textContent = "Delete account";
    delBtn.addEventListener("click", () => {
      confirmAction("Delete this account?", () => {
        db.deleteAccount(acc.id);
        onDone();
      });
    });
    form.appendChild(delBtn);
  }

  openSheet(acc ? "Edit account" : "Add account", form);
}

function openTxEditor(id, onDone) {
  const tx = db.data.actuals.find((t) => t.id === id);
  if (!tx) return;
  const form = document.createElement("div");
  const isIncome = tx.amount >= 0;
  const amountInput = numberInput({ value: Math.abs(tx.amount) });
  const dateEl = dateInput({ value: tx.date });
  const { wrap: categoryWrap, input: categoryInput, refresh: refreshCategories } = categoryField("Category", isIncome ? "income" : "expense", tx.category);
  const noteInputEl = textInput({ value: tx.note || "" });
  const typeSelect = selectInput([{ value: "expense", label: "Expense" }, { value: "income", label: "Income" }], { value: isIncome ? "income" : "expense" });
  typeSelect.addEventListener("change", () => refreshCategories(typeSelect.value));

  form.appendChild(field("Type", typeSelect));
  form.appendChild(field("Amount (UZS)", amountInput));
  form.appendChild(field("Date", dateEl));
  form.appendChild(categoryWrap);
  form.appendChild(field("Note", noteInputEl));

  const saveBtn = document.createElement("button");
  saveBtn.className = "btn";
  saveBtn.textContent = "Save changes";
  saveBtn.addEventListener("click", () => {
    const raw = parseFloat(amountInput.value);
    if (!raw || raw <= 0) { showToast("Enter an amount greater than 0"); return; }
    const amount = typeSelect.value === "expense" ? -Math.abs(raw) : Math.abs(raw);
    db.updateActual(tx.id, { amount, date: dateEl.value, category: categoryInput.value.trim() || "other", note: noteInputEl.value.trim() });
    closeSheet();
    onDone();
    showToast("Updated");
  });
  form.appendChild(saveBtn);

  openSheet("Edit transaction", form);
}

export function openAddTransaction(onDone) {
  openTransactionModal({ onSaved: onDone });
}
