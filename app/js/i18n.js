// Interface language.
//
// Three languages, chosen on first launch and changeable in Settings. The
// choice is stored per copy of the app, like everything else, so two installs
// on one phone don't fight over it.
//
// Lookup is by dotted key against the chosen language, falling back to English
// and then to the key itself — a missing key shows up as "cashFlow.title"
// rather than as a blank space, which is what makes the coverage test able to
// catch one.

import { storageKey } from "./config.js";
import en from "./locales/en.js";
import ru from "./locales/ru.js";
import uz from "./locales/uz.js";

export const LANGS = [
  { code: "uz", label: "O'zbekcha", short: "UZ" },
  { code: "ru", label: "Русский", short: "RU" },
  { code: "en", label: "English", short: "EN" }
];

const TABLES = { en, ru, uz };
const LANG_KEY = storageKey("lang");
const DEFAULT_LANG = "uz";

let current = null;
const listeners = new Set();

function isValid(code) {
  return Object.prototype.hasOwnProperty.call(TABLES, code);
}

/** The stored choice, or null when the user has not chosen yet. */
export function storedLang() {
  try {
    const raw = localStorage.getItem(LANG_KEY);
    return isValid(raw) ? raw : null;
  } catch (e) {
    return null;
  }
}

export function hasChosenLang() {
  return storedLang() !== null;
}

/** Best guess from the phone, used only to preselect the first-launch choice. */
export function suggestedLang() {
  try {
    for (const tag of navigator.languages || [navigator.language || ""]) {
      const code = String(tag).toLowerCase().slice(0, 2);
      if (isValid(code)) return code;
    }
  } catch (e) { /* no navigator.languages */ }
  return DEFAULT_LANG;
}

export function getLang() {
  if (current === null) current = storedLang() || suggestedLang();
  return current;
}

export function setLang(code) {
  if (!isValid(code)) return;
  current = code;
  try { localStorage.setItem(LANG_KEY, code); } catch (e) { /* blocked storage */ }
  document.documentElement.lang = code;
  listeners.forEach((fn) => fn(code));
}

/** Called whenever the language changes, so open pages can redraw. */
export function onLangChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function lookup(table, key) {
  let node = table;
  for (const part of key.split(".")) {
    if (node === null || typeof node !== "object" || !(part in node)) return undefined;
    node = node[part];
  }
  return typeof node === "string" ? node : undefined;
}

/**
 * Translate `key`, substituting {placeholders} from `params`.
 *
 * Placeholders are substituted into the translated string rather than into a
 * pre-built sentence, so each language can put the number wherever its grammar
 * needs it instead of following English word order.
 */
export function t(key, params = null) {
  const lang = getLang();
  let str = lookup(TABLES[lang], key);
  if (str === undefined && lang !== "en") str = lookup(TABLES.en, key);
  if (str === undefined) return key;
  if (!params) return str;
  return str.replace(/\{(\w+)\}/g, (whole, name) =>
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : whole
  );
}

/** Every key defined in English, for the test that checks the other two. */
export function allKeys(table = en, prefix = "") {
  const keys = [];
  for (const [k, v] of Object.entries(table)) {
    const full = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "string") keys.push(full);
    // Arrays (the month names) are addressed by index, so include those too --
    // otherwise a language missing a month would slip past the coverage test.
    else if (Array.isArray(v)) v.forEach((item, i) => { if (typeof item === "string") keys.push(`${full}.${i}`); });
    else if (v && typeof v === "object") keys.push(...allKeys(v, full));
  }
  return keys;
}

export function tableFor(code) {
  return TABLES[code];
}
