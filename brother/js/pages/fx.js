import { db } from "../db.js";
import {
  refreshRates, backfillHistory, historyFor, fxState, TRACKED,
  setAlert, getAlert, setUseLiveForGoals, liveUSD
} from "../fx.js";
import { fmtMoney, fmtDate, todayStr, escapeHtml, svgSparkline } from "../utils.js";
import { showToast } from "../ui.js";

let range = 90;
let loading = false;

export function renderFx(container) {
  const f = fxState();
  const hasRates = Object.keys(f.rates || {}).length > 0;

  container.innerHTML = `
    <div class="page-title">Exchange Rates</div>
    <p class="page-sub">Official Central Bank of Uzbekistan rates.</p>

    ${f.lastError && !hasRates ? `
      <div class="card" style="border-color:var(--danger);">
        <h2>Couldn't load rates</h2>
        <p style="font-size:13px; color:var(--text-dim); margin-top:-6px;">${escapeHtml(f.lastError)}</p>
        <button class="btn secondary small" id="retry">Try again</button>
      </div>` : ""}

    ${hasRates ? TRACKED.map((ccy) => rateCard(ccy, f)).join("") : `
      <div class="card"><div class="empty-state">No rates loaded yet. Tap refresh to fetch them.</div></div>`}

    <div class="card">
      <h2>Rate history</h2>
      <div class="segmented" style="margin-bottom:12px;">
        ${[30, 90, 180].map((d) => `<button data-range="${d}" class="${range === d ? "active" : ""}">${d}d</button>`).join("")}
      </div>
      ${TRACKED.map((ccy) => historyBlock(ccy)).join("")}
      <div id="backfill-status" style="font-size:12px; color:var(--text-dim); margin-bottom:10px;"></div>
      <button class="btn secondary small" id="backfill">Load past ${range} days</button>
    </div>

    <div class="card">
      <h2>Use live rate for goals</h2>
      <p style="font-size:12px; color:var(--text-dim); margin-top:-6px;">
        Your Marriage and Umrah targets are really dollar amounts. With this on, their UZS targets follow the CBU rate
        instead of the fixed figure you set, so a weakening sum shows up straight away.
      </p>
      <label style="display:flex; gap:10px; align-items:center; font-size:14px; margin:12px 0;">
        <input type="checkbox" id="use-live" ${f.useLiveForGoals ? "checked" : ""} style="width:auto;">
        <span>Track the live rate</span>
      </label>
      ${goalImpactHTML()}
    </div>

    <div class="card">
      <h2>Rate alerts</h2>
      <p style="font-size:12px; color:var(--text-dim); margin-top:-6px;">Get a notice on your dashboard when a rate crosses one of these. Leave blank for no alert.</p>
      ${TRACKED.map((ccy) => {
        const a = getAlert(ccy);
        return `
        <div style="margin-top:14px;">
          <div style="font-size:13px; font-weight:600; margin-bottom:8px;">${ccy}</div>
          <div class="field-row">
            <div class="field"><label>Alert if above</label><input type="number" data-alert-above="${ccy}" value="${a.above ?? ""}" placeholder="e.g. 13000"></div>
            <div class="field"><label>Alert if below</label><input type="number" data-alert-below="${ccy}" value="${a.below ?? ""}" placeholder="e.g. 12000"></div>
          </div>
        </div>`;
      }).join("")}
      <button class="btn secondary small" id="save-alerts">Save alerts</button>
    </div>

    <p style="text-align:center; color:var(--text-dim); font-size:11px; margin-top:16px;">
      ${f.lastFetch ? `Last updated ${fmtDate(f.lastFetch)}` : "Never updated"} · source: cbu.uz
    </p>
  `;

  const rerender = () => renderFx(container);

  container.querySelectorAll("[data-range]").forEach((b) => {
    b.addEventListener("click", () => { range = Number(b.dataset.range); rerender(); });
  });

  const retry = container.querySelector("#retry");
  if (retry) retry.addEventListener("click", () => doRefresh(container));

  container.querySelector("#use-live").addEventListener("change", (e) => {
    setUseLiveForGoals(e.target.checked);
    rerender();
    showToast(e.target.checked ? "Goals now follow the live rate" : "Goals back on your fixed rates");
  });

  container.querySelector("#save-alerts").addEventListener("click", () => {
    for (const ccy of TRACKED) {
      setAlert(ccy, {
        above: container.querySelector(`[data-alert-above="${ccy}"]`).value,
        below: container.querySelector(`[data-alert-below="${ccy}"]`).value
      });
    }
    showToast("Alerts saved");
  });

  container.querySelector("#backfill").addEventListener("click", async () => {
    if (loading) return;
    loading = true;
    const btn = container.querySelector("#backfill");
    const status = container.querySelector("#backfill-status");
    btn.disabled = true;
    btn.textContent = "Loading…";
    try {
      const res = await backfillHistory({
        days: range,
        onProgress: (done, total) => { status.textContent = `Fetched ${done} of ${total} dates…`; }
      });
      status.textContent = res.failed
        ? `Loaded, but ${res.failed} of ${res.requested} dates couldn't be fetched.`
        : `Loaded ${res.requested} dates.`;
    } catch (e) {
      status.textContent = "Couldn't load history.";
    } finally {
      loading = false;
      renderFx(container);
    }
  });

  // Fetch on open, at most once a day.
  if (!loading && fxState().lastFetch !== todayStr()) doRefresh(container, { silent: true });
}

async function doRefresh(container, { silent = false } = {}) {
  if (loading) return;
  loading = true;
  const res = await refreshRates({ force: true });
  loading = false;
  if (!silent) showToast(res.ok ? "Rates updated" : "Couldn't reach cbu.uz");
  renderFx(container);
}

function rateCard(ccy, f) {
  const r = f.rates[ccy];
  if (!r) return "";
  const up = r.diff > 0;
  const flat = !r.diff;
  const stale = f.lastFetch !== todayStr();
  return `
    <div class="card hero-balance">
      <div class="label">1 ${escapeHtml(ccy)}${stale ? " · cached" : ""}</div>
      <div class="amount">${Math.round(r.rate).toLocaleString("en-US")} <small>UZS</small></div>
      <div class="sub" style="font-size:12px; color:${flat ? "var(--text-dim)" : up ? "var(--danger)" : "var(--accent)"};">
        ${flat ? "no change" : `${up ? "▲" : "▼"} ${Math.abs(r.diff).toLocaleString("en-US")} vs previous day`}
      </div>
      <div class="sub" style="font-size:11px; color:var(--text-dim); margin-top:4px;">as of ${fmtDate(r.date)}</div>
    </div>
  `;
}

function historyBlock(ccy) {
  const points = historyFor(ccy, range);
  if (points.length < 2) {
    return `<div style="margin-bottom:14px;">
      <div style="font-size:12px; color:var(--text-dim); margin-bottom:4px;">${ccy}</div>
      <div class="empty-state" style="padding:14px 8px; font-size:12px;">Not enough history yet — load it below.</div>
    </div>`;
  }
  const first = points[0].value;
  const last = points[points.length - 1].value;
  const change = last - first;
  const pct = first ? (change / first) * 100 : 0;
  const up = change > 0;
  return `
    <div style="margin-bottom:16px;">
      <div style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom:4px;">
        <span style="font-size:12px; color:var(--text-dim);">${ccy} · last ${range} days</span>
        <span style="font-size:12px; color:${up ? "var(--danger)" : "var(--accent)"};">
          ${up ? "+" : ""}${Math.round(change).toLocaleString("en-US")} (${pct.toFixed(1)}%)
        </span>
      </div>
      ${svgSparkline(points.map((p) => ({ value: p.value })), { height: 60, baseline: "auto", stroke: up ? "var(--danger)" : "var(--accent)", fill: "transparent" })}
      <div style="display:flex; justify-content:space-between; font-size:10px; color:var(--text-dim); margin-top:2px;">
        <span>${fmtDate(points[0].date)}</span><span>${fmtDate(points[points.length - 1].date)}</span>
      </div>
    </div>
  `;
}

// Shows what tracking the live rate actually does to the two USD-denominated
// goals, versus the fixed rate originally set.
function goalImpactHTML() {
  const live = liveUSD();
  if (!live) return `<p style="font-size:12px; color:var(--text-dim);">Load a rate to see the effect on your goals.</p>`;

  const rows = [
    { label: "Marriage reserve", usd: db.data.goals.marriage.reserveAnnualUSD, fixed: db.data.goals.marriage.fxRate },
    {
      label: "Umrah",
      usd: db.data.goals.umrah.amountUSD * db.data.goals.umrah.people + db.data.goals.umrah.bufferUSD,
      fixed: db.data.goals.umrah.fxRate
    }
  ];

  return `
    <table style="margin-top:6px;">
      <thead><tr><th>Goal</th><th class="num">At your rate</th><th class="num">At live rate</th></tr></thead>
      <tbody>
        ${rows.map((r) => {
          const atFixed = r.usd * r.fixed;
          const atLive = r.usd * live;
          const diff = atLive - atFixed;
          return `<tr>
            <td>${escapeHtml(r.label)}<br><span style="font-size:11px; color:var(--text-dim);">$${r.usd.toLocaleString("en-US")}</span></td>
            <td class="num" style="font-size:12px;">${fmtMoney(atFixed)}</td>
            <td class="num" style="font-size:12px; color:${diff > 0 ? "var(--danger)" : "var(--accent)"};">
              ${fmtMoney(atLive)}<br><span style="font-size:10px;">${diff > 0 ? "+" : ""}${fmtMoney(diff)}</span>
            </td>
          </tr>`;
        }).join("")}
      </tbody>
    </table>
    <p style="font-size:11px; color:var(--text-dim); margin-top:8px;">
      A higher UZS figure means the sum has weakened since you set your rate — the same dollar goal now costs more sum.
    </p>
  `;
}
