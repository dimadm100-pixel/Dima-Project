import { db } from "../db.js";
import { t as T } from "../i18n.js";
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
    <div class="page-title">${T("position.title")}</div>
    <p class="page-sub">${T("position.sub")}</p>

    <div class="card hero-balance">
      <div class="label">${T("position.balanceToday")}</div>
      <div class="amount" style="color:${currentBalance < 0 ? "var(--danger)" : "var(--text)"};">${fmtMoney(currentBalance)}</div>
    </div>

    ${unassigned.length ? `
    <div class="card" style="border-color:var(--warn);">
      <h2>⚠️ ${T("position.unbalancedTitle")}</h2>
      <p style="font-size:13px; color:var(--text-dim); margin-top:-6px;">
        ${T("position.unbalancedBody", { n: unassigned.length, worth: fmtMoney(unassignedTotal), accounts: fmtMoney(accountsTotal), ledger: fmtMoney(currentBalance) })}
      </p>
      <button class="btn secondary small" id="fix-unassigned">${T("position.assignNow")}</button>
    </div>` : ""}

    <div class="card">
      <h2>${T("position.accounts")}</h2>
      <table>
        <tbody>
          ${accounts.map((a) => `
            <tr>
              <td>${escapeHtml(a.name)}${a.number ? `<br><span style="color:var(--text-dim); font-size:11px;">•• ${escapeHtml(a.number)}</span>` : ""}</td>
              <td class="num ${a.balance < 0 ? "amt-neg" : ""}" style="font-weight:600;">${fmtMoney(a.balance)}</td>
              <td class="row-actions" style="justify-content:flex-end;"><button class="mini-btn" data-edit-account="${a.id}">${T("common.edit")}</button></td>
            </tr>`).join("")}
          <tr>
            <td style="font-weight:700;">${T("common.total")}</td>
            <td class="num" style="font-weight:700;">${fmtMoney(accountsTotal)}</td>
            <td></td>
          </tr>
        </tbody>
      </table>
      ${unassigned.length === 0
        ? `<p style="color:var(--accent); font-size:12px; margin-top:10px;">✓ ${T("position.balanced")}</p>`
        : `<p style="color:var(--warn); font-size:12px; margin-top:10px;">${T("position.offBy", { amount: fmtMoney(currentBalance - accountsTotal) })}</p>`}
      <button class="btn secondary small" id="add-account-btn" style="margin-top:10px;">${T("position.addAccount")}</button>
    </div>

    <div class="card">
      <h2>${T("position.ledger")}</h2>
      ${ledger.length <= 1 ? `<div class="empty-state">${T("position.noTransactions")}</div>` : ""}
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

  const openingBtn = container.querySelector("#edit-opening-row");
  if (openingBtn) openingBtn.addEventListener("click", () => openOpeningEditor(rerender));

  container.querySelectorAll("[data-edit-tx]").forEach((btn) => {
    btn.addEventListener("click", () => openTxEditor(btn.dataset.editTx, rerender));
  });
  container.querySelectorAll("[data-delete-tx]").forEach((btn) => {
    btn.addEventListener("click", () => confirmAction(T("position.confirmDeleteTx"), () => {
      db.deleteActual(btn.dataset.deleteTx);
      rerender();
      showToast(T("position.txDeleted"));
    }));
  });
  container.querySelectorAll("[data-delete-trf]").forEach((btn) => {
    btn.addEventListener("click", () => confirmAction(T("position.confirmDeleteTransfer"), () => {
      db.deleteTransfer(btn.dataset.deleteTrf);
      rerender();
      showToast(T("position.transferDeleted"));
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
      <td style="color:var(--text-dim);">${T("position.openingBalance")}<br><span style="font-size:11px;">${fmtDate(row.date)}</span></td>
      <td class="num" style="font-weight:700;">${fmtMoney(row.balance)}</td>
      <td class="row-actions" style="justify-content:flex-end;">
        <button class="mini-btn" id="edit-opening-row">${T("common.edit")}</button>
      </td>
    </tr>`;
  }
  if (row.type === "transfer") {
    return `<tr>
      <td>${fmtDate(row.date)}<br><span style="color:var(--accent-2); font-size:11px;">⇄ ${escapeHtml(row.label)}${row.note ? " · " + escapeHtml(row.note) : ""}</span></td>
      <td class="num" style="color:var(--accent-2);">${fmtMoney(row.amount)}</td>
      <td class="row-actions" style="justify-content:flex-end;">
        <button class="mini-btn danger" data-delete-trf="${row.id}">${T("common.del")}</button>
      </td>
    </tr>`;
  }
  const account = row.accountId ? db.accountName(row.accountId) : null;
  return `<tr>
    <td>${fmtDate(row.date)}<br><span style="color:var(--text-dim); font-size:11px;">${escapeHtml(row.label)}${row.note ? " · " + escapeHtml(row.note) : ""}</span>
      <br><span style="font-size:10px; color:${account ? "var(--text-dim)" : "var(--warn)"};">${account ? escapeHtml(account) : T("position.unassigned")}</span></td>
    <td class="num ${row.amount >= 0 ? "amt-pos" : "amt-neg"}">${fmtMoney(row.amount)}<br><span style="color:var(--text-dim); font-size:11px; font-weight:400;">${fmtMoney(row.balance)}</span></td>
    <td class="row-actions" style="justify-content:flex-end;">
      <button class="mini-btn" data-edit-tx="${row.id}">${T("common.edit")}</button>
      <button class="mini-btn danger" data-delete-tx="${row.id}">${T("common.del")}</button>
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
    T("position.needAccountCount", { n: unassigned.length })));

  const bulkRow = el("div", { style: "display:flex; gap:8px; align-items:flex-end; margin-bottom:16px;" });
  const bulkSelect = selectInput(options, {});
  const bulkField = field(T("position.setAllTo"), bulkSelect);
  bulkField.style.flex = "1";
  bulkField.style.marginBottom = "0";
  bulkRow.appendChild(bulkField);
  const applyAll = el("button", { class: "btn small secondary" }, T("position.applyToAll"));
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
    showToast(T("position.setNowSave"));
  });

  const save = el("button", { class: "btn", style: "margin-top:14px;" }, T("position.saveAssignments"));
  save.addEventListener("click", () => {
    for (const [txId, sel] of selects.entries()) {
      if (sel.value) db.updateActual(txId, { accountId: sel.value });
    }
    closeSheet();
    showToast(T("position.ledgerBalanced"));
    onDone();
  });
  wrap.appendChild(save);

  openSheet(T("position.assignAccounts"), wrap);
}

function openAccountEditor(id, onDone) {
  const acc = id ? db.data.accounts.find((a) => a.id === id) : null;
  const form = el("div");
  const nameInput = textInput({ value: acc?.name || "" });
  const numberInputEl = textInput({ value: acc?.number || "" });
  const openingInput = numberInput({ value: acc?.openingBalance ?? 0 });

  form.appendChild(field(T("common.name"), nameInput));
  form.appendChild(field(T("position.cardNumber"), numberInputEl));
  form.appendChild(field(T("position.startingBalance"), openingInput));

  if (acc) {
    form.appendChild(el("p", { style: "font-size:11px; color:var(--text-dim); margin:-4px 0 14px;" },
      `Current balance is ${fmtMoney(db.accountBalance(acc.id))} — that's this starting figure plus everything assigned to it. Change the starting figure only if it was wrong to begin with.`));
  }

  const saveBtn = el("button", { class: "btn" }, T("common.save"));
  saveBtn.addEventListener("click", () => {
    if (!nameInput.value.trim()) { showToast(T("common.needName")); return; }
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
    const delBtn = el("button", { class: "btn danger", style: "margin-top:10px;" }, T("position.deleteAccount"));
    delBtn.addEventListener("click", () => {
      if (usage.total > 0) {
        openReassign(acc, usage, onDone);
      } else {
        confirmAction(T("position.confirmDeleteAccount"), () => { db.deleteAccount(acc.id); closeSheet(); onDone(); });
      }
    });
    form.appendChild(delBtn);
  }

  openSheet(acc ? T("position.editAccount") : T("position.addAccountTitle"), form);
}

function openReassign(acc, usage, onDone) {
  const others = db.data.accounts.filter((a) => a.id !== acc.id).map((a) => ({ value: a.id, label: a.name }));
  const wrap = el("div");
  wrap.appendChild(el("p", { style: "font-size:13px; color:var(--text-dim); margin-bottom:16px;" },
    T("position.stillHasItems", { name: acc.name, n: usage.total })));

  if (!others.length) {
    wrap.appendChild(el("p", { style: "font-size:13px; color:var(--danger);" },
      T("position.onlyAccount")));
    wrap.appendChild(el("button", { class: "btn secondary", style: "margin-top:14px;", onClick: closeSheet }, T("common.close")));
    openSheet(T("position.cantDeleteYet"), wrap);
    return;
  }

  const sel = selectInput(others, {});
  wrap.appendChild(field(T("position.moveEverythingTo"), sel));
  const go = el("button", { class: "btn danger" }, T("position.moveAndDelete"));
  go.addEventListener("click", () => {
    db.reassignAccount(acc.id, sel.value);
    db.deleteAccount(acc.id);
    closeSheet();
    showToast(T("position.accountDeleted"));
    onDone();
  });
  wrap.appendChild(go);
  openSheet(T("position.moveItemsFirst"), wrap);
}

function openTxEditor(id, onDone) {
  const tx = db.data.actuals.find((t) => t.id === id);
  if (!tx) return;
  const form = el("div");
  const isIncome = tx.amount >= 0;

  const typeSelect = selectInput([{ value: "expense", label: T("common.expense") }, { value: "income", label: T("common.income") }], { value: isIncome ? "income" : "expense" });
  const amountInput = numberInput({ value: Math.abs(tx.amount) });
  const dateEl = dateInput({ value: tx.date });
  const { wrap: catWrap, input: categoryInput, refresh } = categoryField(T("common.category"), isIncome ? "income" : "expense", tx.category);
  const accountSelect = selectInput(db.data.accounts.map((a) => ({ value: a.id, label: a.name })), { value: tx.accountId || "" });
  const noteInputEl = textInput({ value: tx.note || "" });
  typeSelect.addEventListener("change", () => refresh(typeSelect.value));

  form.appendChild(field(T("common.type"), typeSelect));
  form.appendChild(field(T("common.amount"), amountInput));
  form.appendChild(field(T("common.date"), dateEl));
  form.appendChild(catWrap);
  form.appendChild(field(T("tx.account"), accountSelect));
  form.appendChild(field(T("tx.noteShort"), noteInputEl));

  const saveBtn = el("button", { class: "btn" }, T("common.saveChanges"));
  saveBtn.addEventListener("click", () => {
    const raw = parseFloat(amountInput.value);
    if (!raw || raw <= 0) { showToast(T("common.needAmount")); return; }
    if (!accountSelect.value) { showToast(T("position.pickAccount")); return; }
    db.updateActual(tx.id, {
      amount: typeSelect.value === "expense" ? -Math.abs(raw) : Math.abs(raw),
      date: dateEl.value,
      category: categoryInput.value.trim() || "other",
      note: noteInputEl.value.trim(),
      accountId: accountSelect.value
    });
    closeSheet();
    onDone();
    showToast(T("common.updated"));
  });
  form.appendChild(saveBtn);

  openSheet(T("position.editTransaction"), form);
}

export function openAddTransaction(onDone) {
  openTransactionModal({ onSaved: onDone });
}

// Editing where you started from.
//
// The opening total is the sum of the accounts' own starting amounts, so this
// edits them directly and the total follows. That is the whole point: there is
// no second copy of the figure left behind to make the ledger look unbalanced.
export function openOpeningEditor(onDone) {
  const accounts = db.data.accounts;
  const form = document.createElement("div");

  if (!accounts.length) {
    const amt = numberInput({ value: db.openingBalance() });
    const dateEl = dateInput({ value: db.data.meta.openingDate });
    form.appendChild(field(T("position.startingCash"), amt));
    form.appendChild(field(T("position.trackingStarts"), dateEl));
    const save = document.createElement("button");
    save.className = "btn";
    save.textContent = T("common.save");
    save.addEventListener("click", () => {
      db.setOpeningBalance(parseFloat(amt.value) || 0, dateEl.value);
      closeSheet();
      onDone();
      showToast(T("position.openingUpdated"));
    });
    form.appendChild(save);
    openSheet(T("position.openingBalance"), form);
    return;
  }

  const intro = document.createElement("p");
  intro.style.cssText = "color:var(--text-dim); font-size:12px; margin:0 0 14px;";
  intro.textContent = T("position.openingIntro");
  form.appendChild(intro);

  const dateEl = dateInput({ value: db.data.meta.openingDate });
  form.appendChild(field(T("position.trackingStarts"), dateEl));

  const totalLine = document.createElement("p");
  totalLine.style.cssText = "font-size:13px; font-weight:700; margin:4px 0 16px;";

  const inputs = accounts.map((a) => {
    const input = numberInput({ value: a.openingBalance ?? 0 });
    input.addEventListener("input", updateTotal);
    form.appendChild(field(a.name + (a.number ? ` ·· ${a.number}` : ""), input));
    return { id: a.id, input };
  });

  function updateTotal() {
    const sum = inputs.reduce((s, i) => s + (parseFloat(i.input.value) || 0), 0);
    totalLine.textContent = T("position.openingTotal", { amount: fmtMoney(sum) });
  }
  updateTotal();
  form.appendChild(totalLine);

  const save = document.createElement("button");
  save.className = "btn";
  save.textContent = T("common.save");
  save.addEventListener("click", () => {
    db.setAccountOpeningBalances(
      inputs.map((i) => ({ id: i.id, openingBalance: parseFloat(i.input.value) || 0 })),
      dateEl.value
    );
    closeSheet();
    onDone();
    showToast(T("position.openingUpdated"));
  });
  form.appendChild(save);

  openSheet(T("position.openingBalance"), form);
}
