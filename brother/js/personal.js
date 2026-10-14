// Personal page: today's plan, the standing weekly routine, and upcoming
// deadlines.
//
// Same architecture as the finance app -- everything lives in one namespaced
// localStorage key on this device, no backend -- but under its own key, so the
// two never read or overwrite each other's data.

import { el, todayStr, fmtDate, daysBetween, addDays } from "./utils.js";
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
const tomorrowDayKey = () => DAY_KEY_BY_JS_INDEX[(new Date().getDay() + 1) % 7];
const dayLabel = (key) => (DAYS.find((d) => d.key === key) || {}).label || key;

function uid(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// ---------- storage ----------

// Today's plan and tomorrow's hold the same kind of thing, so they are read,
// rendered and edited by the same code.
function normaliseDayList(raw) {
  return (Array.isArray(raw) ? raw : []).map((t) => ({
    id: t.id || uid("task"),
    text: String(t.text || ""),
    time: typeof t.time === "string" ? t.time : "",
    endTime: typeof t.endTime === "string" ? t.endTime : "",
    note: String(t.note || ""),
    done: !!t.done
  }));
}

function normalise(raw) {
  const plan = normaliseDayList(raw.plan);
  const tomorrow = normaliseDayList(raw.tomorrow);
  const routine = (Array.isArray(raw.routine) ? raw.routine : []).map((r) => ({
    id: r.id || uid("rt"),
    text: String(r.text || ""),
    time: typeof r.time === "string" ? r.time : "",
    endTime: typeof r.endTime === "string" ? r.endTime : "",
    note: String(r.note || ""),
    days: Array.isArray(r.days) ? r.days.filter((d) => DAY_KEYS.includes(d)) : []
  }));
  const deadlines = (Array.isArray(raw.deadlines) ? raw.deadlines : []).map((d) => ({
    id: d.id || uid("dl"),
    title: String(d.title || ""),
    date: typeof d.date === "string" ? d.date : todayStr(),
    note: String(d.note || "")
  }));
  // dayStartedOn is the last day the page rolled over for, so the rollover
  // happens once a day rather than on every render; tomorrowFor is the date the
  // tomorrow list is written for, so a day that passes unopened is not lost.
  // autoFilledFor is what dayStartedOn used to be called.
  const meta = raw.meta && typeof raw.meta === "object" ? raw.meta : {};
  const dayStartedOn = meta.dayStartedOn || meta.autoFilledFor || "";
  return {
    version: 1,
    plan,
    tomorrow,
    routine,
    deadlines,
    meta: {
      dayStartedOn: typeof dayStartedOn === "string" ? dayStartedOn : "",
      tomorrowFor: typeof meta.tomorrowFor === "string" ? meta.tomorrowFor : ""
    }
  };
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

// An item can be a moment (07:00) or an interval (07:00-08:00). The end time is
// stacked under the start so the column stays narrow enough for a phone.
function timeCell(item) {
  const cell = el("div", { class: `p-time${item.time ? "" : " none"}` });
  cell.appendChild(el("span", {}, item.time || "—"));
  if (item.time && item.endTime) cell.appendChild(el("span", { class: "p-time-end" }, `–${item.endTime}`));
  return cell;
}

// Start and end side by side, so an interval reads as one field, not two.
function timeRangeField(startEl, endEl) {
  const row = el("div", { class: "field-row" });
  row.appendChild(field("From (optional)", startEl));
  row.appendChild(field("To (optional)", endEl));
  return row;
}

// An end time on its own says nothing, so it only survives with a start.
function endFor(startValue, endValue) {
  return startValue ? endValue || "" : "";
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

// ---------- Today's Plan, and tomorrow's ----------
//
// Both lists hold the same kind of item and behave the same way, so one set of
// functions renders and edits either of them; the day list is passed in.

function newTask(src) {
  return {
    id: uid("task"),
    text: src.text,
    time: src.time || "",
    endTime: src.endTime || "",
    note: src.note || "",
    done: false
  };
}

// Two items are the same only if their whole slot matches -- the same thing at
// another time is another thing.
function sameSlot(a, b) {
  return a.text.trim().toLowerCase() === b.text.trim().toLowerCase()
    && (a.time || "") === (b.time || "")
    && (a.endTime || "") === (b.endTime || "");
}

function quickAdd(list, placeholder) {
  const timeInput = el("input", { type: "time", "aria-label": "Start time (optional)" });
  const endInput = el("input", { type: "time", "aria-label": "End time (optional)" });
  const textInput = el("input", { type: "text", class: "grow", placeholder, "aria-label": "Task", autocomplete: "off" });
  const submit = () => {
    const text = textInput.value.trim();
    if (!text) { textInput.focus(); return; }
    list.push(newTask({ text, time: timeInput.value, endTime: endFor(timeInput.value, endInput.value) }));
    commit();
  };
  textInput.addEventListener("keydown", (e) => { if (e.key === "Enter") submit(); });

  const range = el("div", { class: "time-range" });
  range.appendChild(timeInput);
  range.appendChild(el("span", { class: "range-sep" }, "→"));
  range.appendChild(endInput);

  const quick = el("div", { class: "quick-add" });
  quick.appendChild(range);
  quick.appendChild(textInput);
  quick.appendChild(el("button", { class: "btn small", onClick: submit }, "Add"));
  return quick;
}

function dayRow(item, i, list, { checkable = true, listName = "the list" } = {}) {
  const row = el("div", { class: `p-row${item.done ? " done" : ""}` });

  // Tomorrow's items have nothing to tick off yet, so only today's are checkable.
  if (checkable) {
    row.appendChild(el("button", {
      class: `p-check${item.done ? " on" : ""}`,
      title: item.done ? "Mark as not done" : "Mark as done",
      "aria-pressed": item.done ? "true" : "false",
      onClick: () => { item.done = !item.done; commit(); }
    }, "✓"));
  }

  row.appendChild(timeCell(item));

  const main = el("div", { class: "p-main" });
  main.appendChild(el("div", { class: "p-text" }, item.text));
  if (item.note) main.appendChild(el("div", { class: "p-sub" }, item.note));
  row.appendChild(main);

  const actions = el("div", { class: "row-actions" });
  actions.appendChild(miniBtn("↑", "Move up", () => { move(list, i, -1); commit(); }, { disabled: i === 0 }));
  actions.appendChild(miniBtn("↓", "Move down", () => { move(list, i, 1); commit(); }, { disabled: i === list.length - 1 }));
  actions.appendChild(miniBtn("✎", "Edit", () => openItemEditor(item, list, listName)));
  actions.appendChild(miniBtn("✕", "Delete", () => {
    confirmAction(`Delete "${item.text}" from ${listName}?`, () => {
      const at = list.indexOf(item);
      if (at > -1) list.splice(at, 1);
      commit();
    });
  }, { danger: true }));
  row.appendChild(actions);

  return row;
}

function openItemEditor(item, list, listName) {
  const text = el("input", { type: "text", value: item ? item.text : "", placeholder: "e.g. Meet the bank", autocomplete: "off" });
  const time = el("input", { type: "time", value: item ? item.time : "" });
  const end = el("input", { type: "time", value: item ? item.endTime : "" });
  const note = el("input", { type: "text", value: item ? item.note : "", placeholder: "Optional detail", autocomplete: "off" });

  const wrap = el("div", {});
  wrap.appendChild(field("Task or appointment", text));
  wrap.appendChild(timeRangeField(time, end));
  wrap.appendChild(field("Note (optional)", note));
  wrap.appendChild(el("button", {
    class: "btn",
    onClick: () => {
      const value = text.value.trim();
      if (!value) { showToast("Give it a name first."); return; }
      const fields = {
        text: value,
        time: time.value || "",
        endTime: endFor(time.value, end.value),
        note: note.value.trim()
      };
      if (item) Object.assign(item, fields);
      else list.push(newTask(fields));
      closeSheet();
      commit();
    }
  }, item ? "Save" : `Add to ${listName}`));

  openSheet(item ? "Edit task" : "New task", wrap);
  setTimeout(() => text.focus(), 50);
}

function planCard() {
  const card = el("div", { class: "card" });
  const done = data.plan.filter((t) => t.done).length;

  const head = el("div", { class: "card-head" });
  head.appendChild(el("h2", {}, "Today's Plan"));
  const headActions = el("div", { class: "head-actions" });
  headActions.appendChild(miniBtn("＋ Add", "Add a task", () => openItemEditor(null, data.plan, "today")));
  if (data.plan.length) {
    headActions.appendChild(miniBtn("Clear", "Clear the whole list", () => {
      confirmAction("Clear every item in today's plan? Tomorrow, the routine and deadlines are not touched.",
        () => { data.plan = []; commit(); showToast("Today's plan cleared."); }, "Clear");
    }, { danger: true }));
  }
  head.appendChild(headActions);
  card.appendChild(head);
  card.appendChild(el("p", { class: "card-sub" },
    data.plan.length
      ? `${done} of ${data.plan.length} done · clear it yourself whenever you want a fresh day.`
      : "Whatever you're doing today. The day's routine lands here each morning; clearing it is always yours to do."));

  if (data.plan.length) {
    const bar = el("div", { class: "progress-bar", style: "margin-bottom: 6px;" });
    bar.appendChild(el("div", { class: "fill", style: `width: ${(done / data.plan.length) * 100}%;` }));
    card.appendChild(bar);
  }

  if (!data.plan.length) {
    card.appendChild(el("div", { class: "empty-state" }, "Nothing planned yet. Add the first thing below."));
  } else {
    data.plan.forEach((task, i) => card.appendChild(dayRow(task, i, data.plan, { listName: "today's plan" })));
  }

  card.appendChild(quickAdd(data.plan, "Add a task…"));
  return card;
}

// Somewhere to put the things thought of tonight that belong to tomorrow and
// are not part of the weekly routine. It empties itself into today's plan when
// tomorrow arrives.
function tomorrowCard() {
  const card = el("div", { class: "card" });
  const dayName = dayLabel(tomorrowDayKey());

  const head = el("div", { class: "card-head" });
  const title = el("h2", {}, "Tomorrow");
  title.appendChild(el("span", { class: "badge mute", style: "margin-left: 8px;" }, dayName));
  head.appendChild(title);
  const headActions = el("div", { class: "head-actions" });
  headActions.appendChild(miniBtn("＋ Add", "Add something for tomorrow", () => openItemEditor(null, data.tomorrow, "tomorrow")));
  if (data.tomorrow.length) {
    headActions.appendChild(miniBtn("Clear", "Clear tomorrow's list", () => {
      confirmAction("Clear everything set aside for tomorrow?",
        () => { data.tomorrow = []; commit(); showToast("Tomorrow cleared."); }, "Clear");
    }, { danger: true }));
  }
  head.appendChild(headActions);
  card.appendChild(head);
  card.appendChild(el("p", { class: "card-sub" },
    `Set aside for ${dayName}. It moves into Today's Plan when the day starts.`));

  if (!data.tomorrow.length) {
    card.appendChild(el("div", { class: "empty-state" }, `Nothing set aside for ${dayName} yet.`));
  } else {
    data.tomorrow.forEach((task, i) => card.appendChild(dayRow(task, i, data.tomorrow, { checkable: false, listName: "tomorrow" })));
  }

  card.appendChild(quickAdd(data.tomorrow, `Add something for ${dayName}…`));

  // The routine turns up on its own, so it does not need repeating here -- but
  // it is worth knowing what else the day already holds.
  const routineCount = data.routine.filter((r) => r.days.includes(tomorrowDayKey())).length;
  if (routineCount) {
    card.appendChild(el("p", { class: "card-foot" },
      `Plus ${routineCount} routine item${routineCount === 1 ? "" : "s"} for ${dayName}, added automatically on the day.`));
  }

  return card;
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
  card.appendChild(el("p", { class: "card-sub" },
    "Your standing weekly schedule. Each day's items are added to that day's plan automatically, the first time you open the page that day."));

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
  row.appendChild(timeCell(item));

  const main = el("div", { class: "p-main" });
  // No day list here: an item already shows up under every day it runs on.
  main.appendChild(el("div", { class: "p-text" }, item.text));
  if (item.note) main.appendChild(el("div", { class: "p-sub" }, item.note));
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
  const end = el("input", { type: "time", value: item ? item.endTime : "" });
  const note = el("input", { type: "text", value: item ? item.note : "", placeholder: "Optional detail", autocomplete: "off" });
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
  wrap.appendChild(timeRangeField(time, end));
  wrap.appendChild(field("Note (optional)", note));
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
        item.endTime = endFor(time.value, end.value);
        item.note = note.value.trim();
        item.days = days;
      } else {
        data.routine.push({
          id: uid("rt"),
          text: value,
          time: time.value || "",
          endTime: endFor(time.value, end.value),
          note: note.value.trim(),
          days
        });
      }
      closeSheet();
      commit();
    }
  }, item ? "Save" : "Add to routine"));

  openSheet(item ? "Edit routine item" : "New routine item", wrap);
  setTimeout(() => text.focus(), 50);
}

// The day's routine items that are not already in the given list.
function routineItemsFor(dayKey, existing) {
  return data.routine
    .filter((r) => r.days.includes(dayKey))
    .sort(byTime)
    .filter((r) => !existing.some((t) => sameSlot(t, r)))
    .map(newTask);
}

// Rolls the page over to a new day, once per day.
//
// Whatever was set aside for tomorrow becomes today's plan, and the day's
// routine is added on top. Both only ever add: anything deleted stays deleted,
// and a plan cleared later in the day never refills itself. Emptying a list is
// only ever done by hand.
function startDay() {
  const today = todayStr();
  if (data.meta.dayStartedOn === today) {
    if (!data.meta.tomorrowFor) data.meta.tomorrowFor = addDays(today, 1);
    return { carried: 0, routine: 0 };
  }

  // A list written for tomorrow -- or for a day that came and went without the
  // page being opened -- is what today was meant to look like.
  let carried = [];
  if (data.tomorrow.length && data.meta.tomorrowFor && data.meta.tomorrowFor <= today) {
    carried = data.tomorrow.map(newTask);
    data.tomorrow = [];
  }

  const routine = routineItemsFor(todayDayKey(), [...data.plan, ...carried]);
  data.plan.push(...[...carried, ...routine].sort(byTime));
  data.meta.dayStartedOn = today;
  data.meta.tomorrowFor = addDays(today, 1);
  save();
  return { carried: carried.length, routine: routine.length };
}

// The button covers the rest: routine items added later in the day, or a plan
// deliberately re-filled after clearing it.
function copyTodayIntoPlan() {
  const items = routineItemsFor(todayDayKey(), data.plan);
  data.plan.push(...items);
  commit();
  showToast(items.length
    ? `Added ${items.length} routine item${items.length === 1 ? "" : "s"} to today.`
    : "Today's routine is already in the plan.");
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
  const routineTomorrow = data.routine.filter((r) => r.days.includes(tomorrowDayKey())).length;
  const next = sortedDeadlines().find((d) => deadlineStatus(d).days >= 0);
  const nextStatus = next ? deadlineStatus(next) : null;

  const grid = el("div", { class: "grid-3", style: "margin-bottom: 14px;" });

  const planStat = el("div", { class: "stat" });
  planStat.appendChild(el("div", { class: "label" }, "Today's plan"));
  planStat.appendChild(el("div", { class: `value${data.plan.length && done === data.plan.length ? " pos" : ""}` },
    `${done}/${data.plan.length}`));
  planStat.appendChild(el("div", { class: "sub" }, data.plan.length ? "done" : "nothing added"));
  grid.appendChild(planStat);

  const tomorrowStat = el("div", { class: "stat" });
  tomorrowStat.appendChild(el("div", { class: "label" }, "Tomorrow"));
  tomorrowStat.appendChild(el("div", { class: "value" }, String(data.tomorrow.length + routineTomorrow)));
  tomorrowStat.appendChild(el("div", { class: "sub" }, `${dayLabel(tomorrowDayKey())} · ${routineTomorrow} routine`));
  grid.appendChild(tomorrowStat);

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
  view.appendChild(tomorrowCard());
  view.appendChild(routineCard());
  view.appendChild(deadlinesCard());
}

const todayChip = document.getElementById("today-chip");
if (todayChip) todayChip.textContent = `${dayLabel(todayDayKey())}, ${fmtDate(todayStr())}`;

const started = startDay();
render();
const arrived = [];
if (started.carried) arrived.push(`${started.carried} item${started.carried === 1 ? "" : "s"} you set aside`);
if (started.routine) arrived.push(`${started.routine} routine item${started.routine === 1 ? "" : "s"}`);
if (arrived.length) showToast(`Added ${arrived.join(" and ")} to today's plan.`);

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
