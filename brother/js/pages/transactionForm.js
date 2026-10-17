import { db } from "../db.js";
import { t as T } from "../i18n.js";
import { el, todayStr } from "../utils.js";
import { openSheet, closeSheet, field, numberInput, dateInput, selectInput, categoryField, showToast } from "../ui.js";
import { storageKey, readWithLegacy } from "../config.js";

const LAST_ACCOUNT_KEY = storageKey("lastAccount");

function lastAccountId() {
  const id = readWithLegacy("lastAccount");
  return db.data.accounts.some((a) => a.id === id) ? id : (db.data.accounts[0]?.id || "");
}

export function openTransactionModal({ onSaved } = {}) {
  if (!db.data.accounts.length) {
    const wrap = el("div");
    wrap.appendChild(el("p", { style: "font-size:14px; color:var(--text-dim); margin-bottom:18px;" },
      T("tx.needAccountBody")));
    wrap.appendChild(el("button", {
      class: "btn",
      onClick: () => { closeSheet(); window.location.hash = "#cashposition"; }
    }, T("tx.addAccount")));
    openSheet(T("tx.noAccounts"), wrap);
    return;
  }

  let mode = "expense"; // expense | income | transfer
  const form = el("div");

  const segmented = el("div", { class: "segmented", style: "margin-bottom: 14px;" });
  const expenseBtn = el("button", { type: "button", class: "active" }, T("common.expense"));
  const incomeBtn = el("button", { type: "button" }, T("common.income"));
  const transferBtn = el("button", { type: "button" }, T("tx.transfer"));
  segmented.appendChild(expenseBtn);
  segmented.appendChild(incomeBtn);
  segmented.appendChild(transferBtn);
  form.appendChild(segmented);

  const amountInput = numberInput({ placeholder: "0", autofocus: true, min: "0" });
  form.appendChild(field(T("common.amount"), amountInput));

  const dateEl = dateInput({ value: todayStr() });
  form.appendChild(field(T("common.date"), dateEl));

  // --- expense / income fields ---
  const { wrap: categoryWrap, input: categoryInput, refresh: refreshCategories } = categoryField(T("common.category"), "expense");
  form.appendChild(categoryWrap);

  const accountOptions = db.data.accounts.map((a) => ({ value: a.id, label: a.name }));
  const accountSelect = selectInput(accountOptions, { value: lastAccountId() });
  const accountWrap = field(T("tx.account"), accountSelect);
  form.appendChild(accountWrap);

  // --- transfer fields ---
  const fromSelect = selectInput(accountOptions, { value: lastAccountId() });
  const fromWrap = field(T("tx.fromAccount"), fromSelect);
  fromWrap.style.display = "none";
  form.appendChild(fromWrap);

  const toSelect = selectInput(accountOptions, { value: accountOptions[1]?.value || accountOptions[0].value });
  const toWrap = field(T("tx.toAccount"), toSelect);
  toWrap.style.display = "none";
  form.appendChild(toWrap);

  const noteInput = el("input", { type: "text", placeholder: T("tx.notePlaceholder") });
  form.appendChild(field(T("tx.note"), noteInput));

  function setMode(m) {
    mode = m;
    expenseBtn.classList.toggle("active", m === "expense");
    incomeBtn.classList.toggle("active", m === "income");
    transferBtn.classList.toggle("active", m === "transfer");

    const isTransfer = m === "transfer";
    categoryWrap.style.display = isTransfer ? "none" : "";
    accountWrap.style.display = isTransfer ? "none" : "";
    fromWrap.style.display = isTransfer ? "" : "none";
    toWrap.style.display = isTransfer ? "" : "none";

    if (!isTransfer) {
      refreshCategories(m);
      categoryInput.value = "";
    }
  }
  expenseBtn.addEventListener("click", () => setMode("expense"));
  incomeBtn.addEventListener("click", () => setMode("income"));
  transferBtn.addEventListener("click", () => setMode("transfer"));

  const saveBtn = el("button", { class: "btn", style: "margin-top: 6px;" }, T("common.save"));
  saveBtn.addEventListener("click", () => {
    const raw = parseFloat(amountInput.value);
    if (!raw || raw <= 0) { showToast(T("common.needAmount")); return; }
    const date = dateEl.value || todayStr();

    if (mode === "transfer") {
      if (fromSelect.value === toSelect.value) { showToast(T("tx.needTwoAccounts")); return; }
      db.addTransfer({ date, amount: raw, fromAccountId: fromSelect.value, toAccountId: toSelect.value, note: noteInput.value.trim() });
      localStorage.setItem(LAST_ACCOUNT_KEY, fromSelect.value);
      closeSheet();
      showToast(T("tx.movedTo", { account: db.accountName(toSelect.value) }));
      if (onSaved) onSaved();
      return;
    }

    if (!accountSelect.value) { showToast(T("tx.needAccount")); return; }
    const category = (categoryInput.value.trim() || "other").toLowerCase();
    const amount = mode === "expense" ? -Math.abs(raw) : Math.abs(raw);
    db.addActual({ date, amount, category, note: noteInput.value.trim(), accountId: accountSelect.value });
    localStorage.setItem(LAST_ACCOUNT_KEY, accountSelect.value);
    closeSheet();
    showToast(mode === "expense" ? T("tx.expenseLogged") : T("tx.incomeLogged"));
    if (onSaved) onSaved();
  });
  form.appendChild(saveBtn);

  openSheet(T("tx.title"), form);
  setTimeout(() => amountInput.focus(), 50);
}
