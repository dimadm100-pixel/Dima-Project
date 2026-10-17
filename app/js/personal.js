// Personal page: today's plan, the standing weekly routine, and upcoming
// deadlines.
//
// Same architecture as the finance app -- everything lives in one namespaced
// localStorage key on this device, no backend -- but under its own key, so the
// two never read or overwrite each other's data.

import { el, todayStr, fmtDate, daysBetween, addDays } from "./utils.js";
import { storageKey } from "./config.js";
import { t as T, onLangChange, getLang } from "./i18n.js";

const STORAGE_KEY = storageKey("personal_v1");

const DAYS = [
  { key: "mon", label: "day.mon", short: "dayShort.mon" },
  { key: "tue", label: "day.tue", short: "dayShort.tue" },
  { key: "wed", label: "day.wed", short: "dayShort.wed" },
  { key: "thu", label: "day.thu", short: "dayShort.thu" },
  { key: "fri", label: "day.fri", short: "dayShort.fri" },
  { key: "sat", label: "day.sat", short: "dayShort.sat" },
  { key: "sun", label: "day.sun", short: "dayShort.sun" }
];
const DAY_KEYS = DAYS.map((d) => d.key);
// Date#getDay() counts from Sunday; the UI runs Monday-first.
const DAY_KEY_BY_JS_INDEX = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

const todayDayKey = () => DAY_KEY_BY_JS_INDEX[new Date().getDay()];
const tomorrowDayKey = () => DAY_KEY_BY_JS_INDEX[(new Date().getDay() + 1) % 7];
const dayLabel = (key) => { const d = DAYS.find((x) => x.key === key); return d ? T(d.label) : key; };

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
    showToast(T("personal.saveFailed"));
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

function confirmAction(message, onConfirm, confirmLabel = null) {
  const wrap = el("div", {});
  wrap.appendChild(el("p", { style: "color: var(--text-dim); font-size: 14px; margin-bottom: 20px;" }, message));
  const row = el("div", { style: "display:flex; gap:10px;" });
  row.appendChild(el("button", { class: "btn secondary", onClick: () => closeSheet() }, T("common.cancel")));
  row.appendChild(el("button", { class: "btn danger", onClick: () => { closeSheet(); onConfirm(); } }, confirmLabel));
  wrap.appendChild(row);
  openSheet(T("common.areYouSure"), wrap);
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
  row.appendChild(field(T("personal.fromOptional"), startEl));
  row.appendChild(field(T("personal.toOptional"), endEl));
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
  const timeInput = el("input", { type: "time", "aria-label": T("personal.startTime") });
  const endInput = el("input", { type: "time", "aria-label": T("personal.endTime") });
  const textInput = el("input", { type: "text", class: "grow", placeholder, "aria-label": T("personal.task"), autocomplete: "off" });
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
      title: item.done ? T("personal.markNotDone") : T("personal.markDone"),
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
  actions.appendChild(miniBtn("↑", T("personal.moveUp"), () => { move(list, i, -1); commit(); }, { disabled: i === 0 }));
  actions.appendChild(miniBtn("↓", T("personal.moveDown"), () => { move(list, i, 1); commit(); }, { disabled: i === list.length - 1 }));
  actions.appendChild(miniBtn("✎", T("common.edit"), () => openItemEditor(item, list, listName)));
  actions.appendChild(miniBtn("✕", T("common.delete"), () => {
    confirmAction(T("personal.confirmDeleteItem", { text: item.text, list: listName }), () => {
      const at = list.indexOf(item);
      if (at > -1) list.splice(at, 1);
      commit();
    });
  }, { danger: true }));
  row.appendChild(actions);

  return row;
}

function openItemEditor(item, list, listName) {
  const text = el("input", { type: "text", value: item ? item.text : "", placeholder: T("personal.taskPlaceholder"), autocomplete: "off" });
  const time = el("input", { type: "time", value: item ? item.time : "" });
  const end = el("input", { type: "time", value: item ? item.endTime : "" });
  const note = el("input", { type: "text", value: item ? item.note : "", placeholder: T("personal.notePlaceholder"), autocomplete: "off" });

  const wrap = el("div", {});
  wrap.appendChild(field(T("personal.taskOrAppointment"), text));
  wrap.appendChild(timeRangeField(time, end));
  wrap.appendChild(field(T("tx.note"), note));
  wrap.appendChild(el("button", {
    class: "btn",
    onClick: () => {
      const value = text.value.trim();
      if (!value) { showToast(T("personal.needName")); return; }
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
  }, item ? T("common.save") : T("personal.addToList", { list: listName })));

  openSheet(item ? T("personal.editTask") : T("personal.newTask"), wrap);
  setTimeout(() => text.focus(), 50);
}

function planCard() {
  const card = el("div", { class: "card" });
  const done = data.plan.filter((t) => t.done).length;

  const head = el("div", { class: "card-head" });
  head.appendChild(el("h2", {}, T("personal.todaysPlan")));
  const headActions = el("div", { class: "head-actions" });
  headActions.appendChild(miniBtn("＋ " + T("common.add"), T("personal.addTask"), () => openItemEditor(null, data.plan, "today")));
  if (data.plan.length) {
    headActions.appendChild(miniBtn(T("personal.clear"), T("personal.clearWholeList"), () => {
      confirmAction(T("personal.confirmClearPlan"),
        () => { data.plan = []; commit(); showToast(T("personal.planCleared")); }, T("personal.clear"));
    }, { danger: true }));
  }
  head.appendChild(headActions);
  card.appendChild(head);
  card.appendChild(el("p", { class: "card-sub" },
    data.plan.length
      ? `${done} of ${data.plan.length} done · clear it yourself whenever you want a fresh day.`
      : T("personal.planHint")));

  if (data.plan.length) {
    const bar = el("div", { class: "progress-bar", style: "margin-bottom: 6px;" });
    bar.appendChild(el("div", { class: "fill", style: `width: ${(done / data.plan.length) * 100}%;` }));
    card.appendChild(bar);
  }

  if (!data.plan.length) {
    card.appendChild(el("div", { class: "empty-state" }, T("personal.nothingPlanned")));
  } else {
    data.plan.forEach((task, i) => card.appendChild(dayRow(task, i, data.plan, { listName: "today's plan" })));
  }

  card.appendChild(quickAdd(data.plan, T("personal.addTaskPlaceholder")));
  return card;
}

// Somewhere to put the things thought of tonight that belong to tomorrow and
// are not part of the weekly routine. It empties itself into today's plan when
// tomorrow arrives.
function tomorrowCard() {
  const card = el("div", { class: "card" });
  const dayName = dayLabel(tomorrowDayKey());

  const head = el("div", { class: "card-head" });
  const title = el("h2", {}, T("personal.tomorrow"));
  title.appendChild(el("span", { class: "badge mute", style: "margin-left: 8px;" }, dayName));
  head.appendChild(title);
  const headActions = el("div", { class: "head-actions" });
  headActions.appendChild(miniBtn("＋ " + T("common.add"), T("personal.addTomorrow"), () => openItemEditor(null, data.tomorrow, "tomorrow")));
  if (data.tomorrow.length) {
    headActions.appendChild(miniBtn(T("personal.clear"), T("personal.clearTomorrow"), () => {
      confirmAction(T("personal.confirmClearTomorrow"),
        () => { data.tomorrow = []; commit(); showToast(T("personal.tomorrowCleared")); }, T("personal.clear"));
    }, { danger: true }));
  }
  head.appendChild(headActions);
  card.appendChild(head);
  card.appendChild(el("p", { class: "card-sub" },
    T("personal.setAsideFor", { day: dayName })));

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
      T("personal.plusRoutine", { n: routineCount, day: dayName })));
  }

  return card;
}

// ---------- Routine ----------

function routineCard() {
  const card = el("div", { class: "card" });
  const today = todayDayKey();

  const head = el("div", { class: "card-head" });
  head.appendChild(el("h2", {}, T("personal.routine")));
  const headActions = el("div", { class: "head-actions" });
  if (data.routine.some((r) => r.days.includes(today))) {
    headActions.appendChild(miniBtn(T("personal.copyToday"), T("personal.copyTodayHint"), copyTodayIntoPlan));
  }
  headActions.appendChild(miniBtn("＋ " + T("common.add"), T("personal.addRoutineItem"), () => openRoutineEditor(null)));
  head.appendChild(headActions);
  card.appendChild(head);
  card.appendChild(el("p", { class: "card-sub" },
    T("personal.routineHint")));

  if (!data.routine.length) {
    card.appendChild(el("div", { class: "empty-state" }, T("personal.noRoutine")));
    return card;
  }

  const grid = el("div", { class: "day-grid" });
  for (const day of DAYS) {
    const items = data.routine.filter((r) => r.days.includes(day.key)).sort(byTime);
    const block = el("div", { class: `day-block${day.key === today ? " today" : ""}` });
    const heading = el("h3", {}, T(day.label));
    if (day.key === today) heading.appendChild(el("span", { class: "badge" }, T("common.today")));
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
  actions.appendChild(miniBtn("✎", T("common.edit"), () => openRoutineEditor(item)));
  actions.appendChild(miniBtn("✕", T("common.delete"), () => {
    confirmAction(T("personal.confirmDeleteRoutine", { text: item.text }), () => {
      data.routine = data.routine.filter((r) => r.id !== item.id);
      commit();
    });
  }, { danger: true }));
  row.appendChild(actions);

  return row;
}

function openRoutineEditor(item) {
  const text = el("input", { type: "text", value: item ? item.text : "", placeholder: T("personal.routinePlaceholder"), autocomplete: "off" });
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
    }, T(day.short));
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
  daysWrap.appendChild(el("label", {}, T("personal.days")));
  daysWrap.appendChild(chipRow);
  daysWrap.appendChild(presets);

  const wrap = el("div", {});
  wrap.appendChild(field(T("personal.whatIsIt"), text));
  wrap.appendChild(timeRangeField(time, end));
  wrap.appendChild(field(T("tx.note"), note));
  wrap.appendChild(daysWrap);
  wrap.appendChild(el("button", {
    class: "btn",
    style: "margin-top: 6px;",
    onClick: () => {
      const value = text.value.trim();
      if (!value) { showToast("Give it a name first."); return; }
      if (!selected.size) { showToast(T("personal.needDay")); return; }
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
  }, item ? T("common.save") : T("personal.addToRoutine")));

  openSheet(item ? T("personal.editRoutine") : T("personal.newRoutine"), wrap);
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
    ? T("personal.addedRoutineToToday", { n: items.length })
    : T("personal.routineAlreadyIn"));
}

// ---------- Deadlines ----------

function sortedDeadlines() {
  return data.deadlines.slice().sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title));
}

// Anything inside a week gets flagged; today or past gets the stronger red one.
function deadlineStatus(deadline) {
  const days = daysBetween(todayStr(), deadline.date);
  if (days < 0) return { days, tone: "overdue", badge: "danger", text: days === -1 ? T("personal.yesterday") : T("personal.daysAgo", { n: -days }) };
  if (days === 0) return { days, tone: "overdue", badge: "danger", text: T("common.today") };
  if (days === 1) return { days, tone: "soon", badge: "warn", text: T("personal.tomorrow") };
  if (days <= 7) return { days, tone: "soon", badge: "warn", text: `In ${days} days` };
  return { days, tone: "", badge: "mute", text: `In ${days} days` };
}

function deadlinesCard() {
  const card = el("div", { class: "card" });
  const list = sortedDeadlines();
  const soon = list.filter((d) => deadlineStatus(d).days <= 7).length;

  const head = el("div", { class: "card-head" });
  head.appendChild(el("h2", {}, T("personal.deadlines")));
  const headActions = el("div", { class: "head-actions" });
  headActions.appendChild(miniBtn("＋ " + T("common.add"), T("personal.addDeadline"), () => openDeadlineEditor(null)));
  head.appendChild(headActions);
  card.appendChild(head);
  card.appendChild(el("p", { class: "card-sub" },
    list.length
      ? (soon ? T("personal.soonestWithin", { n: soon }) : T("personal.soonestNone"))
      : T("personal.deadlinesHint")));

  if (!list.length) {
    card.appendChild(el("div", { class: "empty-state" }, T("personal.noDeadlines")));
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
  actions.appendChild(miniBtn("✎", T("common.edit"), () => openDeadlineEditor(deadline)));
  actions.appendChild(miniBtn("✕", T("common.delete"), () => {
    confirmAction(T("personal.confirmDeleteDeadline", { title: deadline.title }), () => {
      data.deadlines = data.deadlines.filter((d) => d.id !== deadline.id);
      commit();
    });
  }, { danger: true }));
  row.appendChild(actions);

  return row;
}

function openDeadlineEditor(deadline) {
  const title = el("input", { type: "text", value: deadline ? deadline.title : "", placeholder: T("personal.deadlinePlaceholder"), autocomplete: "off" });
  const date = el("input", { type: "date", value: deadline ? deadline.date : todayStr() });
  const note = el("input", { type: "text", value: deadline ? deadline.note : "", placeholder: "Optional detail", autocomplete: "off" });

  const wrap = el("div", {});
  wrap.appendChild(field(T("personal.whatsDue"), title));
  wrap.appendChild(field(T("common.date"), date));
  wrap.appendChild(field(T("tx.note"), note));
  wrap.appendChild(el("button", {
    class: "btn",
    onClick: () => {
      const value = title.value.trim();
      if (!value) { showToast("Give it a name first."); return; }
      if (!date.value) { showToast(T("personal.needDate")); return; }
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
  planStat.appendChild(el("div", { class: "label" }, T("personal.todaysPlan")));
  planStat.appendChild(el("div", { class: `value${data.plan.length && done === data.plan.length ? " pos" : ""}` },
    `${done}/${data.plan.length}`));
  planStat.appendChild(el("div", { class: "sub" }, data.plan.length ? T("personal.done") : T("personal.nothingAdded")));
  grid.appendChild(planStat);

  const tomorrowStat = el("div", { class: "stat" });
  tomorrowStat.appendChild(el("div", { class: "label" }, T("personal.tomorrow")));
  tomorrowStat.appendChild(el("div", { class: "value" }, String(data.tomorrow.length + routineTomorrow)));
  tomorrowStat.appendChild(el("div", { class: "sub" }, T("personal.nRoutine", { day: dayLabel(tomorrowDayKey()), n: routineTomorrow })));
  grid.appendChild(tomorrowStat);

  const deadlineStat = el("div", { class: "stat" });
  deadlineStat.appendChild(el("div", { class: "label" }, T("personal.nextDeadline")));
  deadlineStat.appendChild(el("div", { class: `value${nextStatus && nextStatus.days <= 7 ? " neg" : ""}` },
    nextStatus ? nextStatus.text : "—"));
  deadlineStat.appendChild(el("div", { class: "sub" }, next ? next.title : T("personal.nothingScheduled")));
  grid.appendChild(deadlineStat);

  return grid;
}

const view = document.getElementById("view");

// The Personal page draws itself rather than going through the router, so it
// subscribes to the language change directly.
onLangChange(() => {
  document.documentElement.lang = getLang();
  applyShellText();
  render();
});

// Text that lives in personal.html rather than in this page's own markup.
function applyShellText() {
  const set = (sel, text) => { const n = document.querySelector(sel); if (n) n.textContent = text; };
  set(".page-switch a[href='./index.html']", `💰 ${T("shell.finance")}`);
  set(".page-switch a[href='./personal.html']", `🗓️ ${T("shell.personal")}`);
  const chip = document.getElementById("today-chip");
  if (chip) chip.textContent = `${dayLabel(todayDayKey())}, ${fmtDate(todayStr())}`;
  const h1 = document.querySelector(".topbar h1");
  if (h1) h1.textContent = `🗓️ ${T("shell.personal")}`;
}

function render() {
  view.innerHTML = "";
  view.appendChild(el("h1", { class: "page-title" }, T("shell.personal")));
  view.appendChild(el("p", { class: "page-sub" }, T("personal.sub")));
  view.appendChild(summary());
  view.appendChild(planCard());
  view.appendChild(tomorrowCard());
  view.appendChild(routineCard());
  view.appendChild(deadlinesCard());
}

applyShellText();

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
  // Whether this page is already under a service worker's control. On a very
  // first visit it is not, and there is nothing stale to replace.
  const hadController = !!navigator.serviceWorker.controller;
  let reloadedForUpdate = false;

  window.addEventListener("load", async () => {
    try {
      const reg = await navigator.serviceWorker.register("./sw.js");
      // An installed app is usually resumed rather than opened fresh, and a
      // resume does not always check for a new version on its own. Ask.
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") reg.update().catch(() => {});
      });
    } catch (e) { /* offline, or service workers unavailable */ }
  });

  // A newly installed worker claims its pages as soon as it activates. This
  // page was built from the old version's files, so reload once to pick up
  // the new ones -- without this, an update stays invisible until the app
  // happens to be opened a second time, which looks exactly like the update
  // never arrived. Guarded so repeated claims cannot cause a reload loop.
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!hadController || reloadedForUpdate) return;
    reloadedForUpdate = true;
    window.location.reload();
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
