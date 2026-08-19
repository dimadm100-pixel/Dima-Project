import { el } from "./utils.js";

let toastTimer = null;

export function showToast(message) {
  document.querySelectorAll(".toast").forEach((n) => n.remove());
  const t = el("div", { class: "toast" }, message);
  document.body.appendChild(t);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.remove(), 2200);
}

export function openSheet(title, contentNode) {
  closeSheet();
  const backdrop = el("div", { class: "modal-backdrop", id: "active-modal" });
  const sheet = el("div", { class: "modal-sheet" });
  sheet.appendChild(el("div", { class: "modal-handle" }));
  if (title) sheet.appendChild(el("h3", {}, title));
  sheet.appendChild(contentNode);
  backdrop.appendChild(sheet);
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) closeSheet();
  });
  document.body.appendChild(backdrop);
  document.body.style.overflow = "hidden";
  return backdrop;
}

export function closeSheet() {
  const existing = document.getElementById("active-modal");
  if (existing) existing.remove();
  document.body.style.overflow = "";
}

export function confirmAction(message, onConfirm) {
  const wrap = el("div", {});
  wrap.appendChild(el("p", { style: "color: var(--text-dim); font-size: 14px; margin-bottom: 20px;" }, message));
  const row = el("div", { style: "display:flex; gap:10px;" });
  const cancelBtn = el("button", { class: "btn secondary", onClick: () => closeSheet() }, "Cancel");
  const confirmBtn = el("button", { class: "btn danger", onClick: () => { closeSheet(); onConfirm(); } }, "Delete");
  row.appendChild(cancelBtn);
  row.appendChild(confirmBtn);
  wrap.appendChild(row);
  openSheet("Are you sure?", wrap);
}

export function field(labelText, inputEl) {
  const wrap = el("div", { class: "field" });
  wrap.appendChild(el("label", {}, labelText));
  wrap.appendChild(inputEl);
  return wrap;
}

export function textInput(attrs = {}) {
  return el("input", { type: "text", ...attrs });
}
export function numberInput(attrs = {}) {
  return el("input", { type: "number", inputmode: "decimal", step: "any", ...attrs });
}
export function dateInput(attrs = {}) {
  return el("input", { type: "date", ...attrs });
}
export function selectInput(options, attrs = {}) {
  const sel = el("select", attrs);
  for (const opt of options) {
    const value = typeof opt === "string" ? opt : opt.value;
    const label = typeof opt === "string" ? opt : opt.label;
    const optEl = el("option", { value }, label);
    if (attrs.value === value) optEl.selected = true;
    sel.appendChild(optEl);
  }
  return sel;
}
