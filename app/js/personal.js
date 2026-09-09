// Personal page: today's plan, the standing weekly routine, and upcoming
// deadlines.
//
// Same architecture as the finance app -- everything lives in one namespaced
// localStorage key on this device, no backend -- but under its own key, so the
// two never read or overwrite each other's data.

import { el, todayStr, fmtDate, daysBetween } from "./utils.js";
import { storageKey } from "./config.js";

const STORAGE_KEY = storageKey("personal_v1");

const DAYS = [
  { key: "mon", label: "Monday", short: "Mon" },
  { key: "tue", label: "Tuesday", short: "Tue" },
  { key: "wed", label: "Wednesday", short: "Wed" },
  { key: "thu", label: "Thursday", short: "Thu" },
  { key: "fri", label: "Friday", short: "Fri" },
  { key: "sat", label: "Saturday", short: "Sat" },
  { key: "sun", label: "Sunday", short: "Sun" }
];
const DAY_KEYS = DAYS.map((d) => d.key);
// Date#getDay() counts from Sunday; the UI runs Monday-first.
const DAY_KEY_BY_JS_INDEX = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

const todayDayKey = () => DAY_KEY_BY_JS_INDEX[new Date().getDay()];
const dayLabel = (key) => (DAYS.find((d) => d.key === key) || {}).label || key;

function uid(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// ---------- storage ----------

function normalise(raw) {
  const plan = (Array.isArray(raw.plan) ? raw.plan : []).map((t) => ({
    id: t.id || uid("task"),
    text: String(t.text || ""),
    time: typeof t.time === "string" ? t.time : "",
    done: !!t.done
  }));
  const routine = (Array.isArray(raw.routine) ? raw.routine : []).map((r) => ({
    id: r.id || uid("rt"),
    text: String(r.text || ""),
    time: typeof r.time === "string" ? r.time : "",
    days: Array.isArray(r.days) ? r.days.filter((d) => DAY_KEYS.includes(d)) : []
  }));
  const deadlines = (Array.isArray(raw.deadlines) ? raw.deadlines : []).map((d) => ({
    id: d.id || uid("dl"),
    title: String(d.title || ""),
    date: typeof d.date === "string" ? d.date : todayStr(),
    note: String(d.note || "")
  }));
  return { version: 1, plan, routine, deadlines };
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return normalise(JSON.parse(raw));
  } catch (e) {
    console.error("Could not read saved personal data; starting empty.", e);
  }
  return normalise({});
}

let data = load();

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error("Could not save personal data.", e);
    showToast("Couldn't save — storage is full or blocked.");
  }
}

function commit() {
  save();
  render();
}

// ---------- small UI helpers (same markup the finance app's sheets use) ----------

let toastTimer = null;

function showToast(message) {
  document.querySelectorAll(".toast").forEach((n) => n.remove());
  const t = el("div", { class: "toast" }, message);
  document.body.appendChild(t);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.remove(), 2200);
}

function openSheet(title, contentNode) {
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
}

function closeSheet() {
  const existing = document.getElementById("active-modal");
  if (existing) existing.remove();
  document.body.style.overflow = "";
}

function confirmAction(message, onConfirm, confirmLabel = "Delete") {
  const wrap = el("div", {});
  wrap.appendChild(el("p", { style: "color: var(--text-dim); font-size: 14px; margin-bottom: 20px;" }, message));
  const row = el("div", { style: "display:flex; gap:10px;" });
  row.appendChild(el("button", { class: "btn secondary", onClick: () => closeSheet() }, "Cancel"));
  row.appendChild(el("button", { class: "btn danger", onClick: () => { closeSheet(); onConfirm(); } }, confirmLabel));
  wrap.appendChild(row);
  openSheet("Are you sure?", wrap);
}

function field(labelText, inputEl) {
  const wrap = el("div", { class: "field" });
  wrap.appendChild(el("label", {}, labelText));
  wrap.appendChild(inputEl);
  return wrap;
}

function miniBtn(label, title, onClick, { danger = false, disabled = false } = {}) {
  return el("button", {
    class: `mini-btn${danger ? " danger" : ""}`,
    title,
    "aria-label": title,
    disabled: disabled ? "disabled" : undefined,
    onClick: disabled ? undefined : onClick
  }, label);
}

// Blank times sort last, so a timed item always sits above an untimed one.
function byTime(a, b) {
  if (!a.time && !b.time) return 0;
  if (!a.time) return 1;
  if (!b.time) return -1;
  return a.time.localeCompare(b.time);
}

function move(list, index, delta) {
  const target = index + delta;
  if (target < 0 || target >= list.length) return;
  const [item] = list.splice(index, 1);
  list.splice(target, 0, item);
}

// ---------- Today's Plan ----------

function planCard() {
  const card = el("div", { class: "card" });
  const done = data.plan.filter((t) => t.done).length;

  const head = el("div", { class: "card-head" });
  head.appendChild(el("h2", {}, "Today's Plan"));
  const headActions = el("div", { class: "head-actions" });
  headActions.appendChild(miniBtn("＋ Add", "Add a task", () => openPlanEditor(null)));
  if (data.plan.length) {
    headActions.appendChild(miniBtn("Clear", "Clear the whole list", () => {
      confirmAction("Clear every item in today's plan? The routine and deadlines below are not touched.",
        () => { data.plan = []; commit(); showToast("Today's plan cleared."); }, "Clear");
    }, { danger: true }));
  }
  head.appendChild(headActions);
  card.appendChild(head);
  card.appendChild(el("p", { class: "card-sub" },
    data.plan.length
      ? `${done} of ${data.plan.length} done · clear it yourself whenever you want a fresh day.`
      : "Whatever you're doing today. Nothing here resets on its own — you clear it."));

  if (data.plan.length) {
    const bar = el("div", { class: "progress-bar", style: "margin-bottom: 6px;" });
    bar.appendChild(el("div", { class: "fill", style: `width: ${data.plan.length ? (done / data.plan.length) * 100 : 0}%;` }));
    card.appendChild(bar);
  }

  if (!data.plan.length) {
    card.appendChild(el("div", { class: "empty-state" }, "Nothing planned yet. Add the first thing below."));
  } else {
    data.plan.forEach((task, i) => card.appendChild(planRow(task, i)));
  }

  // Quick add: the common case is a line of text, so it shouldn't need a sheet.
  const timeInput = el("input", { type: "time", "aria-label": "Time (optional)" });
  const textInput = el("input", { type: "text", class: "grow", placeholder: "Add a task…", "aria-label": "Task", autocomplete: "off" });
  const submit = () => {
    const text = textInput.value.trim();
    if (!text) { textInput.focus(); return; }
    data.plan.push({ id: uid("task"), text, time: timeInput.value || "", done: false });
    commit();
  };
  textInput.addEventListener("keydown", (e) => { if (e.key === "Enter") submit(); });
  const quick = el("div", { class: "quick-add" });
  quick.appendChild(timeInput);
  quick.appendChild(textInput);
  quick.appendChild(el("button", { class: "btn small", onClick: submit }, "Add"));
  card.appendChild(quick);

  return card;
}

function planRow(task, i) {
  const row = el("div", { class: `p-row${task.done ? " done" : ""}` });

  row.appendChild(el("button", {
    class: `p-check${task.done ? " on" : ""}`,
    title: task.done ? "Mark as not done" : "Mark as done",
    "aria-pressed": task.done ? "true" : "false",
    onClick: () => { task.done = !task.done; commit(); }
  }, "✓"));

  row.appendChild(el("div", { class: `p-time${task.time ? "" : " none"}` }, task.time || "—"));

  const main = el("div", { class: "p-main" });
  main.appendChild(el("div", { class: "p-text" }, task.text));
  row.appendChild(main);

  const actions = el("div", { class: "row-actions" });
  actions.appendChild(miniBtn("↑", "Move up", () => { move(data.plan, i, -1); commit(); }, { disabled: i === 0 }));
  actions.appendChild(miniBtn("↓", "Move down", () => { move(data.plan, i, 1); commit(); }, { disabled: i === data.plan.length - 1 }));
  actions.appendChild(miniBtn("✎", "Edit", () => openPlanEditor(task)));
  actions.appendChild(miniBtn("✕", "Delete", () => {
    confirmAction(`Delete "${task.text}" from today's plan?`, () => {
      data.plan = data.plan.filter((t) => t.id !== task.id);
      commit();
    });
  }, { danger: true }));
  row.appendChild(actions);

  return row;
}

function openPlanEditor(task) {
  const text = el("input", { type: "text", value: task ? task.text : "", placeholder: "e.g. Meet the bank", autocomplete: "off" });
  const time = el("input", { type: "time", value: task ? task.time : "" });

  const wrap = el("div", {});
  wrap.appendChild(field("Task or appointment", text));
  wrap.appendChild(field("Time (optional)", time));
  wrap.appendChild(el("button", {
    class: "btn",
    onClick: () => {
      const value = text.value.trim();
      if (!value) { showToast("Give it a name first."); return; }
      if (task) {
        task.text = value;
        task.time = time.value || "";
      } else {
        data.plan.push({ id: uid("task"), text: value, time: time.value || "", done: false });
      }
      closeSheet();
      commit();
    }
  }, task ? "Save" : "Add to today"));

  openSheet(task ? "Edit task" : "New task", wrap);
  setTimeout(() => text.focus(), 50);
}

// ---------- Routine ----------

function routineCard() {
  const card = el("div", { class: "card" });
  const today = todayDayKey();

  const head = el("div", { class: "card-head" });
  head.appendChild(el("h2", {}, "Routine"));
  const headActions = el("div", { class: "head-actions" });
  if (data.routine.some((r) => r.days.includes(today))) {
    headActions.appendChild(miniBtn("Copy today →", "Copy today's routine into today's plan", copyTodayIntoPlan));
  }
  headActions.appendChild(miniBtn("＋ Add", "Add a routine item", () => openRoutineEditor(null)));
  head.appendChild(headActions);
  card.appendChild(head);
  card.appendChild(el("p", { class: "card-sub" }, "Your standing weekly schedule. It stays put — today's plan is the part that changes."));

  if (!data.routine.length) {
    card.appendChild(el("div", { class: "empty-state" }, "No routine yet. Add gym, study blocks, classes — anything that repeats weekly."));
    return card;
  }

  const grid = el("div", { class: "day-grid" });
  for (const day of DAYS) {
    const items = data.routine.filter((r) => r.days.includes(day.key)).sort(byTime);
    const block = el("div", { class: `day-block${day.key === today ? " today" : ""}` });
    const heading = el("h3", {}, day.label);
    if (day.key === today) heading.appendChild(el("span", { class: "badge" }, "Today"));
    block.appendChild(heading);
    if (!items.length) {
      block.appendChild(el("div", { class: "empty-day" }, "—"));
    } else {
      items.forEach((item) => block.appendChild(routineRow(item)));
    }
    grid.appendChild(block);
  }
  card.appendChild(grid);

  return card;
}

function routineRow(item) {
  const row = el("div", { class: "p-row" });
  row.appendChild(el("div", { class: `p-time${item.time ? "" : " none"}` }, item.time || "—"));

  const main = el("div", { class: "p-main" });
  // No day list here: an item already shows up under every day it runs on.
  main.appendChild(el("div", { class: "p-text" }, item.text));
  row.appendChild(main);

  const actions = el("div", { class: "row-actions" });
  actions.appendChild(miniBtn("✎", "Edit", () => openRoutineEditor(item)));
  actions.appendChild(miniBtn("✕", "Delete", () => {
    confirmAction(`Delete "${item.text}" from the routine? It goes from every day it's on.`, () => {
      data.routine = data.routine.filter((r) => r.id !== item.id);
      commit();
    });
  }, { danger: true }));
  row.appendChild(actions);

  return row;
}

function openRoutineEditor(item) {
  const text = el("input", { type: "text", value: item ? item.text : "", placeholder: "e.g. Gym", autocomplete: "off" });
  const time = el("input", { type: "time", value: item ? item.time : "" });
  const selected = new Set(item ? item.days : []);

  const chipRow = el("div", { class: "chip-row" });
  for (const day of DAYS) {
    const chip = el("button", {
      class: `chip${selected.has(day.key) ? " active" : ""}`,
      type: "button",
      onClick: () => {
        if (selected.has(day.key)) selected.delete(day.key);
        else selected.add(day.key);
        chip.classList.toggle("active", selected.has(day.key));
      }
    }, day.short);
    chipRow.appendChild(chip);
  }

  const applyPreset = (keys) => {
    selected.clear();
    keys.forEach((k) => selected.add(k));
    Array.from(chipRow.children).forEach((chip, i) => chip.classList.toggle("active", selected.has(DAYS[i].key)));
  };
  const presets = el("div", { class: "row-actions", style: "margin-top: 8px;" });
  presets.appendChild(miniBtn("Mon–Fri", "Weekdays", () => applyPreset(["mon", "tue", "wed", "thu", "fri"])));
  presets.appendChild(miniBtn("Weekend", "Saturday and Sunday", () => applyPreset(["sat", "sun"])));
  presets.appendChild(miniBtn("Every day", "All week", () => applyPreset(DAY_KEYS)));

  const daysWrap = el("div", { class: "field" });
  daysWrap.appendChild(el("label", {}, "Days"));
  daysWrap.appendChild(chipRow);
  daysWrap.appendChild(presets);

  const wrap = el("div", {});
  wrap.appendChild(field("What is it", text));
  wrap.appendChild(field("Time (optional)", time));
  wrap.appendChild(daysWrap);
  wrap.appendChild(el("button", {
    class: "btn",
    style: "margin-top: 6px;",
    onClick: () => {
      const value = text.value.trim();
      if (!value) { showToast("Give it a name first."); return; }
      if (!selected.size) { showToast("Pick at least one day."); return; }
      const days = DAY_KEYS.filter((k) => selected.has(k));
      if (item) {
        item.text = value;
        item.time = time.value || "";
        item.days = days;
      } else {
        data.routine.push({ id: uid("rt"), text: value, time: time.value || "", days });
      }
      closeSheet();
      commit();
    }
  }, item ? "Save" : "Add to routine"));

  openSheet(item ? "Edit routine item" : "New routine item", wrap);
  setTimeout(() => text.focus(), 50);
}

// Pulling the routine into today's plan is deliberately a button, not something
// that happens on its own: the plan is only ever changed by hand.
function copyTodayIntoPlan() {
  const items = data.routine.filter((r) => r.days.includes(todayDayKey())).sort(byTime);
  let added = 0;
  for (const item of items) {
    const already = data.plan.some((t) =>
      t.text.trim().toLowerCase() === item.text.trim().toLowerCase() && (t.time || "") === (item.time || ""));
    if (already) continue;
    data.plan.push({ id: uid("task"), text: item.text, time: item.time || "", done: false });
    added++;
  }
  commit();
  showToast(added ? `Added ${added} routine item${added === 1 ? "" : "s"} to today.` : "Today's routine is already in the plan.");
}

// ---------- Deadlines ----------

function sortedDeadlines() {
  return data.deadlines.slice().sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title));
}

// Anything inside a week gets flagged; today or past gets the stronger red one.
function deadlineStatus(deadline) {
  const days = daysBetween(todayStr(), deadline.date);
  if (days < 0) return { days, tone: "overdue", badge: "danger", text: days === -1 ? "Yesterday" : `${-days} days ago` };
  if (days === 0) return { days, tone: "overdue", badge: "danger", text: "Today" };
  if (days === 1) return { days, tone: "soon", badge: "warn", text: "Tomorrow" };
  if (days <= 7) return { days, tone: "soon", badge: "warn", text: `In ${days} days` };
  return { days, tone: "", badge: "mute", text: `In ${days} days` };
}

function deadlinesCard() {
  const card = el("div", { class: "card" });
  const list = sortedDeadlines();
  const soon = list.filter((d) => deadlineStatus(d).days <= 7).length;

  const head = el("div", { class: "card-head" });
  head.appendChild(el("h2", {}, "Notifications & Deadlines"));
  const headActions = el("div", { class: "head-actions" });
  headActions.appendChild(miniBtn("＋ Add", "Add a deadline", () => openDeadlineEditor(null)));
  head.appendChild(headActions);
  card.appendChild(head);
  card.appendChild(el("p", { class: "card-sub" },
    list.length
      ? `Soonest first. ${soon ? `${soon} within the next 7 days (or already due).` : "Nothing due in the next 7 days."}`
      : "Bills, exam dates, application deadlines — anything with a date you don't want to miss."));

  if (!list.length) {
    card.appendChild(el("div", { class: "empty-state" }, "No deadlines saved yet."));
    return card;
  }

  list.forEach((deadline) => card.appendChild(deadlineRow(deadline)));
  return card;
}

function deadlineRow(deadline) {
  const status = deadlineStatus(deadline);
  const row = el("div", { class: `p-row deadline${status.tone ? ` ${status.tone}` : ""}` });

  row.appendChild(el("div", { class: "p-date" }, fmtDate(deadline.date)));

  const main = el("div", { class: "p-main" });
  const titleLine = el("div", { class: "p-text" });
  titleLine.appendChild(document.createTextNode(deadline.title));
  titleLine.appendChild(el("span", { class: `badge ${status.badge}`, style: "margin-left: 8px;" }, status.text));
  main.appendChild(titleLine);
  if (deadline.note) main.appendChild(el("div", { class: "p-sub" }, deadline.note));
  row.appendChild(main);

  const actions = el("div", { class: "row-actions" });
  actions.appendChild(miniBtn("✎", "Edit", () => openDeadlineEditor(deadline)));
  actions.appendChild(miniBtn("✕", "Delete", () => {
    confirmAction(`Delete the deadline "${deadline.title}"?`, () => {
      data.deadlines = data.deadlines.filter((d) => d.id !== deadline.id);
      commit();
    });
  }, { danger: true }));
  row.appendChild(actions);

  return row;
}

function openDeadlineEditor(deadline) {
  const title = el("input", { type: "text", value: deadline ? deadline.title : "", placeholder: "e.g. Internet bill", autocomplete: "off" });
  const date = el("input", { type: "date", value: deadline ? deadline.date : todayStr() });
  const note = el("input", { type: "text", value: deadline ? deadline.note : "", placeholder: "Optional detail", autocomplete: "off" });

  const wrap = el("div", {});
  wrap.appendChild(field("What's due", title));
  wrap.appendChild(field("Date", date));
  wrap.appendChild(field("Note (optional)", note));
  wrap.appendChild(el("button", {
    class: "btn",
    onClick: () => {
      const value = title.value.trim();
      if (!value) { showToast("Give it a name first."); return; }
      if (!date.value) { showToast("Pick a date."); return; }
      if (deadline) {
        deadline.title = value;
        deadline.date = date.value;
        deadline.note = note.value.trim();
      } else {
        data.deadlines.push({ id: uid("dl"), title: value, date: date.value, note: note.value.trim() });
      }
      closeSheet();
      commit();
    }
  }, deadline ? "Save" : "Add deadline"));

  openSheet(deadline ? "Edit deadline" : "New deadline", wrap);
  setTimeout(() => title.focus(), 50);
}

// ---------- summary + page ----------

function summary() {
  const done = data.plan.filter((t) => t.done).length;
  const routineToday = data.routine.filter((r) => r.days.includes(todayDayKey())).length;
  const next = sortedDeadlines().find((d) => deadlineStatus(d).days >= 0);
  const nextStatus = next ? deadlineStatus(next) : null;

  const grid = el("div", { class: "grid-3", style: "margin-bottom: 14px;" });

  const planStat = el("div", { class: "stat" });
  planStat.appendChild(el("div", { class: "label" }, "Today's plan"));
  planStat.appendChild(el("div", { class: `value${data.plan.length && done === data.plan.length ? " pos" : ""}` },
    `${done}/${data.plan.length}`));
  planStat.appendChild(el("div", { class: "sub" }, data.plan.length ? "done" : "nothing added"));
  grid.appendChild(planStat);

  const routineStat = el("div", { class: "stat" });
  routineStat.appendChild(el("div", { class: "label" }, "Routine today"));
  routineStat.appendChild(el("div", { class: "value" }, String(routineToday)));
  routineStat.appendChild(el("div", { class: "sub" }, dayLabel(todayDayKey())));
  grid.appendChild(routineStat);

  const deadlineStat = el("div", { class: "stat" });
  deadlineStat.appendChild(el("div", { class: "label" }, "Next deadline"));
  deadlineStat.appendChild(el("div", { class: `value${nextStatus && nextStatus.days <= 7 ? " neg" : ""}` },
    nextStatus ? nextStatus.text : "—"));
  deadlineStat.appendChild(el("div", { class: "sub" }, next ? next.title : "nothing scheduled"));
  grid.appendChild(deadlineStat);

  return grid;
}

const view = document.getElementById("view");

function render() {
  view.innerHTML = "";
  view.appendChild(el("h1", { class: "page-title" }, "Personal"));
  view.appendChild(el("p", { class: "page-sub" }, "Your day, your standing routine, and what's coming up. Saved on this device only."));
  view.appendChild(summary());
  view.appendChild(planCard());
  view.appendChild(routineCard());
  view.appendChild(deadlinesCard());
}

const todayChip = document.getElementById("today-chip");
if (todayChip) todayChip.textContent = `${dayLabel(todayDayKey())}, ${fmtDate(todayStr())}`;

render();

// ---- PWA install + service worker ----
//
// The page shares the finance app's service worker (its scope covers the whole
// site), but declares its own manifest, so it installs to the home screen as
// its own app with its own icon rather than as a shortcut into the tracker.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}

const installBtn = document.getElementById("install-btn");
let deferredInstallPrompt = null;

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  if (installBtn) installBtn.style.display = "flex";
});

if (installBtn) {
  installBtn.addEventListener("click", async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    installBtn.style.display = "none";
  });
}

window.addEventListener("appinstalled", () => {
  if (installBtn) installBtn.style.display = "none";
});
