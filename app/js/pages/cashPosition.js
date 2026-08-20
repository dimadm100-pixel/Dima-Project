import { db } from "../db.js";
import { fmtMoney, fmtDate, escapeHtml, el } from "../utils.js";
import { openSheet, closeSheet, confirmAction, field, numberInput, dateInput, textInput, selectInput, categoryField, showToast } from "../ui.js";
import { openTransactionModal } from "./transactionForm.js";

export function renderCashPosition(container) {
  const accounts = db.accountsWithBalances();
  const accountsTotal = db.accountsTotal();
  const currentBalance = db.currentBalance();
  const unassigned = db.unassignedTransactions();
  const unassignedTotal = unassigned.reduce((s, t) => s + t.amount, 0);
  const ledger = buildLedgerRows().reverse(); // newest first

  container.innerHTML = `
    <div class="page-title">Cash Position</div>
    <p class="page-sub">Your real ledger, and where the money physically sits.</p>

    <div class="card hero-balance">
      <div class="label">Balance as of today</div>
      <div class="amount" style="color:${currentBalance < 0 ? "var(--danger)" : "var(--text)"};">${fmtMoney(currentBalance)}</div>
    </div>

    ${unassigned.length ? `
    <div class="card" style="border-color:var(--warn);">
      <h2>⚠️ Ledger doesn't balance</h2>
      <p style="font-size:13px; color:var(--text-dim); margin-top:-6px;">
        ${unassigned.length} transaction${unassigned.length === 1 ? " isn't" : "s aren't"} assigned to an account, worth ${fmtMoney(unassignedTotal)}.
        Until they're assigned, your accounts add up to ${fmtMoney(accountsTotal)} instead of ${fmtMoney(currentBalance)}.
      </p>
      <button class="btn secondary small" id="fix-unassigned">Assign them now</button>
    </div>` : ""}

    <div class="card">
      <h2>Accounts</h2>
      <table>
        <tbody>
          ${accounts.map((a) => `
            <tr>
              <td>${escapeHtml(a.name)}${a.number ? `<br><span style="color:var(--text-dim); font-size:11px;">•• ${escapeHtml(a.number)}</span>` : ""}</td>
              <td class="num ${a.balance < 0 ? "amt-neg" : ""}" style="font-weight:600;">${fmtMoney(a.balance)}</td>
              <td class="row-actions" style="justify-content:flex-end;"><button class="mini-btn" data-edit-account="${a.id}">Edit</button></td>
            </tr>`).join("")}
          <tr>
            <td style="font-weight:700;">Total</td>
            <td class="num" style="font-weight:700;">${fmtMoney(accountsTotal)}</td>
            <td></td>
          </tr>
        </tbody>
      </table>
      ${unassigned.length === 0
        ? `<p style="color:var(--accent); font-size:12px; margin-top:10px;">✓ Balanced — accounts match the ledger exactly.</p>`
        : `<p style="color:var(--warn); font-size:12px; margin-top:10px;">Off by ${fmtMoney(currentBalance - accountsTotal)} — see above.</p>`}
      <button class="btn secondary small" id="add-account-btn" style="margin-top:10px;">+ Add account</button>
    </div>

    <div class="card">
      <h2>Ledger</h2>
      ${ledger.length <= 1 ? `<div class="empty-state">No transactions yet. Tap + to log your first one.</div>` : ""}
      <table><tbody>${ledger.map(rowHTML).join("")}</tbody></table>
    </div>
  `;

  const rerender = () => renderCashPosition(container);

  container.querySelectorAll("[data-edit-account]").forEach((btn) => {
    btn.addEventListener("click", () => openAccountEditor(btn.dataset.editAccount, rerender));
  });
  container.querySelector("#add-account-btn").addEventListener("click", () => openAccountEditor(null, rerender));

  const fixBtn = container.querySelector("#fix-unassigned");
  if (fixBtn) fixBtn.addEventListener("click", () => openBulkAssign(rerender));

  container.querySelectorAll("[data-edit-tx]").forEach((btn) => {
    btn.addEventListener("click", () => openTxEditor(btn.dataset.editTx, rerender));
  });
  container.querySelectorAll("[data-delete-tx]").forEach((btn) => {
    btn.addEventListener("click", () => confirmAction("Delete this transaction?", () => {
      db.deleteActual(btn.dataset.deleteTx);
      rerender();
      showToast("Transaction deleted");
    }));
  });
  container.querySelectorAll("[data-delete-trf]").forEach((btn) => {
    btn.addEventListener("click", () => confirmAction("Delete this transfer?", () => {
      db.deleteTransfer(btn.dataset.deleteTrf);
      rerender();
      showToast("Transfer deleted");
    }));
  });
}

// Transfers appear in the ledger for context but never move the running
// total -- they shift money between accounts, they don't create or spend it.
function buildLedgerRows() {
  const rows = db.cashPositionLedger();
  const withTransfers = [...rows];
  for (const t of db.data.transfers) {
    withTransfers.push({
      id: t.id,
      date: t.date,
      type: "transfer",
      label: `${db.accountName(t.fromAccountId)} → ${db.accountName(t.toAccountId)}`,
      note: t.note,
      amount: t.amount,
      balance: null
    });
  }
  return withTransfers.sort((a, b) => a.date.localeCompare(b.date));
}

function rowHTML(row) {
  if (row.type === "opening") {
    return `<tr>
      <td colspan="2" style="color:var(--text-dim);">Opening balance, ${fmtDate(row.date)}</td>
      <td class="num" style="font-weight:700;">${fmtMoney(row.balance)}</td>
    </tr>`;
  }
  if (row.type === "transfer") {
    return `<tr>
      <td>${fmtDate(row.date)}<br><span style="color:var(--accent-2); font-size:11px;">⇄ ${escapeHtml(row.label)}${row.note ? " · " + escapeHtml(row.note) : ""}</span></td>
      <td class="num" style="color:var(--accent-2);">${fmtMoney(row.amount)}</td>
      <td class="row-actions" style="justify-content:flex-end;">
        <button class="mini-btn danger" data-delete-trf="${row.id}">Del</button>
      </td>
    </tr>`;
  }
  const account = row.accountId ? db.accountName(row.accountId) : null;
  return `<tr>
    <td>${fmtDate(row.date)}<br><span style="color:var(--text-dim); font-size:11px;">${escapeHtml(row.label)}${row.note ? " · " + escapeHtml(row.note) : ""}</span>
      <br><span style="font-size:10px; color:${account ? "var(--text-dim)" : "var(--warn)"};">${account ? escapeHtml(account) : "unassigned"}</span></td>
    <td class="num ${row.amount >= 0 ? "amt-pos" : "amt-neg"}">${fmtMoney(row.amount)}<br><span style="color:var(--text-dim); font-size:11px; font-weight:400;">${fmtMoney(row.balance)}</span></td>
    <td class="row-actions" style="justify-content:flex-end;">
      <button class="mini-btn" data-edit-tx="${row.id}">Edit</button>
      <button class="mini-btn danger" data-delete-tx="${row.id}">Del</button>
    </td>
  </tr>`;
}

// One screen to clear every unassigned transaction, with a bulk shortcut for
// the common case of "these were all on the same card".
function openBulkAssign(onDone) {
  const unassigned = db.unassignedTransactions();
  const options = db.data.accounts.map((a) => ({ value: a.id, label: a.name }));
  const wrap = el("div");

  wrap.appendChild(el("p", { style: "font-size:13px; color:var(--text-dim); margin-bottom:14px;" },
    `${unassigned.length} transaction${unassigned.length === 1 ? "" : "s"} need an account.`));

  const bulkRow = el("div", { style: "display:flex; gap:8px; align-items:flex-end; margin-bottom:16px;" });
  const bulkSelect = selectInput(options, {});
  const bulkField = field("Set all to", bulkSelect);
  bulkField.style.flex = "1";
  bulkField.style.marginBottom = "0";
  bulkRow.appendChild(bulkField);
  const applyAll = el("button", { class: "btn small secondary" }, "Apply to all");
  bulkRow.appendChild(applyAll);
  wrap.appendChild(bulkRow);

  const list = el("div", { style: "max-height:44vh; overflow-y:auto;" });
  const selects = new Map();
  for (const t of unassigned) {
    const row = el("div", { style: "display:flex; gap:8px; align-items:center; padding:8px 0; border-bottom:1px solid var(--border);" });
    row.appendChild(el("div", { style: "flex:1; font-size:12px;" }, [
      el("div", {}, `${fmtDate(t.date)} · ${t.category}`),
      el("div", { style: `font-size:12px; font-weight:600; color:${t.amount >= 0 ? "var(--accent)" : "var(--danger)"};` }, fmtMoney(t.amount))
    ]));
    const sel = selectInput(options, {});
    sel.style.width = "auto";
    sel.style.flex = "0 0 42%";
    selects.set(t.id, sel);
    row.appendChild(sel);
    list.appendChild(row);
  }
  wrap.appendChild(list);

  applyAll.addEventListener("click", () => {
    for (const sel of selects.values()) sel.value = bulkSelect.value;
    showToast("Set — now save");
  });

  const save = el("button", { class: "btn", style: "margin-top:14px;" }, "Save assignments");
  save.addEventListener("click", () => {
    for (const [txId, sel] of selects.entries()) {
      if (sel.value) db.updateActual(txId, { accountId: sel.value });
    }
    closeSheet();
    showToast("Ledger balanced");
    onDone();
  });
  wrap.appendChild(save);

  openSheet("Assign accounts", wrap);
}

function openAccountEditor(id, onDone) {
  const acc = id ? db.data.accounts.find((a) => a.id === id) : null;
  const form = el("div");
  const nameInput = textInput({ value: acc?.name || "" });
  const numberInputEl = textInput({ value: acc?.number || "" });
  const openingInput = numberInput({ value: acc?.openingBalance ?? 0 });

  form.appendChild(field("Name", nameInput));
  form.appendChild(field("Card / account number (optional)", numberInputEl));
  form.appendChild(field("Starting balance (UZS)", openingInput));

  if (acc) {
    form.appendChild(el("p", { style: "font-size:11px; color:var(--text-dim); margin:-4px 0 14px;" },
      `Current balance is ${fmtMoney(db.accountBalance(acc.id))} — that's this starting figure plus everything assigned to it. Change the starting figure only if it was wrong to begin with.`));
  }

  const saveBtn = el("button", { class: "btn" }, "Save");
  saveBtn.addEventListener("click", () => {
    if (!nameInput.value.trim()) { showToast("Enter a name"); return; }
    const payload = {
      name: nameInput.value.trim(),
      number: numberInputEl.value.trim(),
      openingBalance: parseFloat(openingInput.value) || 0
    };
    if (acc) db.updateAccount(acc.id, payload);
    else db.addAccount(payload);
    closeSheet();
    onDone();
  });
  form.appendChild(saveBtn);

  if (acc) {
    const usage = db.accountUsage(acc.id);
    const delBtn = el("button", { class: "btn danger", style: "margin-top:10px;" }, "Delete account");
    delBtn.addEventListener("click", () => {
      if (usage.total > 0) {
        openReassign(acc, usage, onDone);
      } else {
        confirmAction("Delete this account?", () => { db.deleteAccount(acc.id); closeSheet(); onDone(); });
      }
    });
    form.appendChild(delBtn);
  }

  openSheet(acc ? "Edit account" : "Add account", form);
}

function openReassign(acc, usage, onDone) {
  const others = db.data.accounts.filter((a) => a.id !== acc.id).map((a) => ({ value: a.id, label: a.name }));
  const wrap = el("div");
  wrap.appendChild(el("p", { style: "font-size:13px; color:var(--text-dim); margin-bottom:16px;" },
    `${acc.name} still has ${usage.total} item${usage.total === 1 ? "" : "s"} attached. Move them to another account first, or they'd be left unassigned and your ledger would stop balancing.`));

  if (!others.length) {
    wrap.appendChild(el("p", { style: "font-size:13px; color:var(--danger);" },
      "This is your only account, so there's nowhere to move them. Add another account first."));
    wrap.appendChild(el("button", { class: "btn secondary", style: "margin-top:14px;", onClick: closeSheet }, "Close"));
    openSheet("Can't delete yet", wrap);
    return;
  }

  const sel = selectInput(others, {});
  wrap.appendChild(field("Move everything to", sel));
  const go = el("button", { class: "btn danger" }, "Move and delete");
  go.addEventListener("click", () => {
    db.reassignAccount(acc.id, sel.value);
    db.deleteAccount(acc.id);
    closeSheet();
    showToast("Account deleted");
    onDone();
  });
  wrap.appendChild(go);
  openSheet("Move items first", wrap);
}

function openTxEditor(id, onDone) {
  const tx = db.data.actuals.find((t) => t.id === id);
  if (!tx) return;
  const form = el("div");
  const isIncome = tx.amount >= 0;

  const typeSelect = selectInput([{ value: "expense", label: "Expense" }, { value: "income", label: "Income" }], { value: isIncome ? "income" : "expense" });
  const amountInput = numberInput({ value: Math.abs(tx.amount) });
  const dateEl = dateInput({ value: tx.date });
  const { wrap: catWrap, input: categoryInput, refresh } = categoryField("Category", isIncome ? "income" : "expense", tx.category);
  const accountSelect = selectInput(db.data.accounts.map((a) => ({ value: a.id, label: a.name })), { value: tx.accountId || "" });
  const noteInputEl = textInput({ value: tx.note || "" });
  typeSelect.addEventListener("change", () => refresh(typeSelect.value));

  form.appendChild(field("Type", typeSelect));
  form.appendChild(field("Amount (UZS)", amountInput));
  form.appendChild(field("Date", dateEl));
  form.appendChild(catWrap);
  form.appendChild(field("Account", accountSelect));
  form.appendChild(field("Note", noteInputEl));

  const saveBtn = el("button", { class: "btn" }, "Save changes");
  saveBtn.addEventListener("click", () => {
    const raw = parseFloat(amountInput.value);
    if (!raw || raw <= 0) { showToast("Enter an amount greater than 0"); return; }
    if (!accountSelect.value) { showToast("Pick an account"); return; }
    db.updateActual(tx.id, {
      amount: typeSelect.value === "expense" ? -Math.abs(raw) : Math.abs(raw),
      date: dateEl.value,
      category: categoryInput.value.trim() || "other",
      note: noteInputEl.value.trim(),
      accountId: accountSelect.value
    });
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
