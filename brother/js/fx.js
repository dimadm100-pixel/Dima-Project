// Central Bank of Uzbekistan rate feed.
//
// CBU publishes an open JSON endpoint, one request per date. There's no bulk
// range endpoint, so history is built up two ways: today's rate is appended
// each day the app is opened, and an optional backfill samples past dates to
// populate the chart immediately.
//
// Every network path here degrades rather than breaks -- if CBU is
// unreachable, or the browser blocks the cross-origin call, the last cached
// rate is served and flagged stale so the UI can say so honestly.

import { db } from "./db.js";
import { todayStr, addDays } from "./utils.js";

const BASE = "https://cbu.uz/uz/arkhiv-kursov-valyut/json";
export const TRACKED = ["USD", "EUR"];

function fx() {
  if (!db.data.fx) {
    db.data.fx = { rates: {}, history: [], lastFetch: null, alerts: {}, useLiveForGoals: true, lastError: null };
  }
  const f = db.data.fx;
  if (!f.rates) f.rates = {};
  if (!Array.isArray(f.history)) f.history = [];
  if (!f.alerts) f.alerts = {};
  if (f.useLiveForGoals === undefined) f.useLiveForGoals = true;
  return f;
}

export function fxState() {
  return fx();
}

// CBU returns dates as DD.MM.YYYY; everything else in this app is YYYY-MM-DD.
function normalizeDate(s) {
  if (!s || typeof s !== "string") return null;
  const m = s.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return null;
}

// The upstream shape isn't under our control, so read it defensively and
// reject anything that doesn't yield a usable number.
function parseEntry(raw) {
  if (!raw || typeof raw !== "object") return null;
  const ccy = raw.Ccy || raw.ccy;
  const rate = parseFloat(raw.Rate ?? raw.rate);
  if (!ccy || !Number.isFinite(rate)) return null;
  const nominal = parseFloat(raw.Nominal ?? raw.nominal) || 1;
  return {
    ccy,
    rate: rate / (nominal || 1),
    diff: parseFloat(raw.Diff ?? raw.diff) || 0,
    date: normalizeDate(raw.Date ?? raw.date) || todayStr(),
    name: raw.CcyNm_EN || raw.CcyNm_UZ || ccy
  };
}

async function getJSON(url, timeoutMs = 12000) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctl.signal, headers: { accept: "application/json" } });
    if (!res.ok) throw new Error(`CBU returned HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Today's rates for the tracked currencies. Returns { ok, stale, rates, error }.
 * A failure never throws -- the caller gets whatever was last cached.
 */
export async function refreshRates({ force = false } = {}) {
  const f = fx();
  const today = todayStr();

  // CBU publishes once a day, so don't re-request on every page view.
  if (!force && f.lastFetch === today && Object.keys(f.rates).length) {
    return { ok: true, stale: false, rates: f.rates, cached: true };
  }

  try {
    const data = await getJSON(`${BASE}/`);
    if (!Array.isArray(data)) throw new Error("Unexpected response from CBU");

    const found = {};
    for (const raw of data) {
      const entry = parseEntry(raw);
      if (entry && TRACKED.includes(entry.ccy)) found[entry.ccy] = entry;
    }
    if (!Object.keys(found).length) throw new Error("No tracked currencies in the response");

    f.rates = found;
    f.lastFetch = today;
    f.lastError = null;
    recordHistory(found);
    db.save();
    return { ok: true, stale: false, rates: found };
  } catch (e) {
    f.lastError = describeError(e);
    db.save();
    return {
      ok: false,
      stale: Object.keys(f.rates).length > 0,
      rates: f.rates,
      error: f.lastError
    };
  }
}

function describeError(e) {
  if (e.name === "AbortError") return "CBU didn't respond in time.";
  if (e instanceof TypeError) {
    return "Couldn't reach cbu.uz from the browser — this is usually no internet, or the bank not allowing direct browser requests.";
  }
  return e.message || "Something went wrong fetching rates.";
}

function recordHistory(entries) {
  const f = fx();
  for (const ccy of Object.keys(entries)) {
    const { date, rate } = entries[ccy];
    upsertHistory(date, ccy, rate);
  }
}

function upsertHistory(date, ccy, rate) {
  const f = fx();
  let row = f.history.find((h) => h.date === date);
  if (!row) {
    row = { date };
    f.history.push(row);
  }
  row[ccy] = rate;
  f.history.sort((a, b) => a.date.localeCompare(b.date));
  // Keep it bounded; well past the 90-day window we chart.
  if (f.history.length > 400) f.history = f.history.slice(-400);
}

/**
 * Samples past dates to populate the chart. CBU has no range endpoint, so this
 * requests one date at a time -- sampled every few days and run in small
 * batches to stay polite and avoid hammering the phone's connection.
 */
export async function backfillHistory({ days = 90, stepDays = 5, onProgress } = {}) {
  const f = fx();
  const today = todayStr();
  const wanted = [];
  for (let i = days; i >= 0; i -= stepDays) {
    const d = addDays(today, -i);
    if (!f.history.some((h) => h.date === d && TRACKED.every((c) => h[c] !== undefined))) wanted.push(d);
  }

  let done = 0, failed = 0;
  const BATCH = 3;
  for (let i = 0; i < wanted.length; i += BATCH) {
    const batch = wanted.slice(i, i + BATCH);
    await Promise.all(batch.map(async (date) => {
      try {
        const data = await getJSON(`${BASE}/all/${date}/`);
        if (Array.isArray(data)) {
          for (const raw of data) {
            const entry = parseEntry(raw);
            if (entry && TRACKED.includes(entry.ccy)) upsertHistory(date, entry.ccy, entry.rate);
          }
        }
      } catch {
        failed++;
      } finally {
        done++;
        if (onProgress) onProgress(done, wanted.length);
      }
    }));
  }
  db.save();
  return { requested: wanted.length, failed };
}

export function historyFor(ccy, days = 90) {
  const cutoff = addDays(todayStr(), -days);
  return fx().history
    .filter((h) => h.date >= cutoff && Number.isFinite(h[ccy]))
    .map((h) => ({ date: h.date, value: h[ccy] }));
}

// ---------------------------------------------------------------- goal rates

/**
 * The rate a USD-denominated goal should be converted at.
 *
 * The goals are really dollar amounts, so when live tracking is on their UZS
 * target follows the market rather than sitting frozen at a rate set months
 * ago.
 */
export function effectiveRate(fallbackRate) {
  const f = fx();
  const live = f.rates?.USD?.rate;
  if (f.useLiveForGoals && Number.isFinite(live)) return live;
  return fallbackRate;
}

export function liveUSD() {
  return fx().rates?.USD?.rate ?? null;
}

export function setUseLiveForGoals(on) {
  fx().useLiveForGoals = !!on;
  db.save();
}

// ------------------------------------------------------------------- alerts

export function setAlert(ccy, { above, below }) {
  fx().alerts[ccy] = {
    above: Number.isFinite(Number(above)) && above !== "" ? Number(above) : null,
    below: Number.isFinite(Number(below)) && below !== "" ? Number(below) : null
  };
  db.save();
}

export function getAlert(ccy) {
  return fx().alerts[ccy] || { above: null, below: null };
}

// Threshold crossings, for the dashboard's in-app reminders.
export function triggeredAlerts() {
  const f = fx();
  const out = [];
  for (const ccy of TRACKED) {
    const rate = f.rates?.[ccy]?.rate;
    if (!Number.isFinite(rate)) continue;
    const a = f.alerts[ccy];
    if (!a) continue;
    if (Number.isFinite(a.above) && a.above !== null && rate >= a.above) {
      out.push({ id: `fx-${ccy}-above`, ccy, rate, threshold: a.above, direction: "above" });
    }
    if (Number.isFinite(a.below) && a.below !== null && rate <= a.below) {
      out.push({ id: `fx-${ccy}-below`, ccy, rate, threshold: a.below, direction: "below" });
    }
  }
  return out;
}
