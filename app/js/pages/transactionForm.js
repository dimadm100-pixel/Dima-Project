import { db } from "../db.js";
import { el, todayStr } from "../utils.js";
import { openSheet, closeSheet, field, textInput, numberInput, dateInput, selectInput, showToast } from "../ui.js";

const QUICK_EXPENSE_CATEGORIES = ["food", "rent", "transport", "debt", "to parents", "1fit", "phone", "entertainment", "gift", "trip to home", "other"];
const QUICK_INCOME_CATEGORIES = ["salary", "extra", "gift", "other"];

export function openTransactionModal({ onSaved } = {}) {
  let mode = "expense"; // expense = negative amount, income = positive

  const form = el("div");

  const segmented = el("div", { class: "segmented", style: "margin-bottom: 14px;" });
  const expenseBtn = el("button", { type: "button", class: "active" }, "Expense");
  const incomeBtn = el("button", { type: "button" }, "Income");
  segmented.appendChild(expenseBtn);
  segmented.appendChild(incomeBtn);
  form.appendChild(segmented);

  const amountInput = numberInput({ placeholder: "0", autofocus: true, min: "0" });
  form.appendChild(field("Amount (UZS)", amountInput));

  const dateEl = dateInput({ value: todayStr() });
  form.appendChild(field("Date", dateEl));

  const categorySelect = selectInput(QUICK_EXPENSE_CATEGORIES, {});
  const categoryWrap = field("Category", categorySelect);
  form.appendChild(categoryWrap);

  const customCategory = textInput({ placeholder: "Custom category (optional)" });
  form.appendChild(field("Or type your own", customCategory));

  const noteInput = textInput({ placeholder: "e.g. lunch with friends" });
  form.appendChild(field("Note (optional)", noteInput));

  const accounts = db.data.accounts;
  const accountSelect = selectInput([{ value: "", label: "Unspecified" }, ...accounts.map((a) => ({ value: a.id, label: a.name }))], {});
  form.appendChild(field("Account (optional)", accountSelect));

  function setMode(m) {
    mode = m;
    expenseBtn.classList.toggle("active", m === "expense");
    incomeBtn.classList.toggle("active", m === "income");
    const opts = m === "expense" ? QUICK_EXPENSE_CATEGORIES : QUICK_INCOME_CATEGORIES;
    categorySelect.innerHTML = "";
    for (const c of opts) categorySelect.appendChild(el("option", { value: c }, c));
  }
  expenseBtn.addEventListener("click", () => setMode("expense"));
  incomeBtn.addEventListener("click", () => setMode("income"));

  const saveBtn = el("button", { class: "btn", style: "margin-top: 6px;" }, "Save transaction");
  saveBtn.addEventListener("click", () => {
    const raw = parseFloat(amountInput.value);
    if (!raw || raw <= 0) {
      showToast("Enter an amount greater than 0");
      return;
    }
    const category = (customCategory.value.trim() || categorySelect.value || "other").toLowerCase();
    const amount = mode === "expense" ? -Math.abs(raw) : Math.abs(raw);
    db.addActual({
      date: dateEl.value || todayStr(),
      amount,
      category,
      note: noteInput.value.trim(),
      accountId: accountSelect.value
    });
    closeSheet();
    showToast(mode === "expense" ? "Expense logged" : "Income logged");
    if (onSaved) onSaved();
  });
  form.appendChild(saveBtn);

  openSheet("Log a transaction", form);
  setTimeout(() => amountInput.focus(), 50);
}
