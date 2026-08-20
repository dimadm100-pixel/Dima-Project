// Date helpers operate purely on "YYYY-MM-DD" strings using UTC arithmetic
// so calendar math never drifts a day due to the browser's local timezone.

export function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

export function daysBetween(a, b) {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  const ta = Date.UTC(ay, am - 1, ad);
  const tb = Date.UTC(by, bm - 1, bd);
  return Math.round((tb - ta) / 86400000);
}

export function monthKey(dateStr) {
  return dateStr.slice(0, 7);
}

export function addMonths(monthOrDate, n) {
  const [y, m] = monthOrDate.split("-").map(Number);
  const total = (y * 12 + (m - 1)) + n;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${ny}-${String(nm).padStart(2, "0")}`;
}

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export function fmtDate(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return `${d} ${MONTH_NAMES[m - 1]} ${y}`;
}

export function fmtMonth(monthKey_) {
  const [y, m] = monthKey_.split("-").map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
}

export function fmtMoney(amount, currency = "UZS") {
  const n = Math.round(Number(amount) || 0);
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${sign}${abs} ${currency}`;
}

export function fmtMoneyShort(amount) {
  const n = Number(amount) || 0;
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_000_000_000) return `${sign}${(abs / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(0)}K`;
  return `${sign}${abs}`;
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

export function capitalize(s) {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else if (k === "html") node.innerHTML = v;
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v !== undefined && v !== null && v !== false) node.setAttribute(k, v);
  }
  const kids = Array.isArray(children) ? children : [children];
  for (const c of kids) {
    if (c === null || c === undefined || c === false) continue;
    node.appendChild(typeof c === "string" || typeof c === "number" ? document.createTextNode(String(c)) : c);
  }
  return node;
}

// Overlays two balance trajectories that share the same start date and daily step
// (e.g. full budget projection vs. actual-so-far) on one shared scale, with a zero
// baseline so a dip below zero -- a cash hole -- is visible at a glance.
export function svgDualLine(seriesLong, seriesShort, {
  width = 340, height = 150,
  colorLong = "var(--accent-2)", colorShort = "var(--accent)", zeroColor = "var(--danger)"
} = {}) {
  if (!seriesLong.length) return `<svg width="${width}" height="${height}"></svg>`;
  const allValues = [...seriesLong, ...seriesShort].map((p) => p.balance);
  const min = Math.min(...allValues, 0);
  const max = Math.max(...allValues, 0);
  const range = max - min || 1;
  const n = seriesLong.length;
  const stepX = width / Math.max(n - 1, 1);
  const yFor = (v) => height - ((v - min) / range) * (height - 10) - 5;
  const pathFor = (series) => series.map((p, i) => `${i === 0 ? "M" : "L"}${(i * stepX).toFixed(1)},${yFor(p.balance).toFixed(1)}`).join(" ");
  const zeroY = yFor(0);
  return `<svg viewBox="0 0 ${width} ${height}" width="100%" height="${height}" preserveAspectRatio="none">
    ${min < 0 ? `<line x1="0" y1="${zeroY.toFixed(1)}" x2="${width}" y2="${zeroY.toFixed(1)}" stroke="${zeroColor}" stroke-width="1" stroke-dasharray="4 3"></line>` : ""}
    <path d="${pathFor(seriesLong)}" fill="none" stroke="${colorLong}" stroke-width="2" stroke-dasharray="5 3" stroke-linecap="round" stroke-linejoin="round"></path>
    ${seriesShort.length > 1 ? `<path d="${pathFor(seriesShort)}" fill="none" stroke="${colorShort}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"></path>` : ""}
  </svg>`;
}

export function svgSparkline(points, { width = 300, height = 80, stroke = "var(--accent)", fill = "var(--accent-fade)" } = {}) {
  if (!points.length) return `<svg width="${width}" height="${height}"></svg>`;
  const values = points.map((p) => p.balance ?? p.value ?? p);
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 0);
  const range = max - min || 1;
  const stepX = width / Math.max(values.length - 1, 1);
  const coords = values.map((v, i) => {
    const x = i * stepX;
    const y = height - ((v - min) / range) * (height - 8) - 4;
    return [x, y];
  });
  const linePath = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L${width},${height} L0,${height} Z`;
  return `<svg viewBox="0 0 ${width} ${height}" width="100%" height="${height}" preserveAspectRatio="none">
    <path d="${areaPath}" fill="${fill}" stroke="none"></path>
    <path d="${linePath}" fill="none" stroke="${stroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
  </svg>`;
}

export function svgBars(items, { width = 300, height = 120, barColor = "var(--accent)", negColor = "var(--danger)" } = {}) {
  if (!items.length) return `<svg width="${width}" height="${height}"></svg>`;
  const values = items.map((i) => i.value);
  const max = Math.max(...values.map(Math.abs), 1);
  const gap = 6;
  const bw = (width - gap * (items.length - 1)) / items.length;
  const mid = height / 2;
  let bars = "";
  items.forEach((it, i) => {
    const x = i * (bw + gap);
    const h = (Math.abs(it.value) / max) * (height / 2 - 6);
    const y = it.value >= 0 ? mid - h : mid;
    const color = it.value >= 0 ? barColor : negColor;
    bars += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="3" fill="${color}"></rect>`;
  });
  return `<svg viewBox="0 0 ${width} ${height}" width="100%" height="${height}" preserveAspectRatio="none">
    <line x1="0" y1="${mid}" x2="${width}" y2="${mid}" stroke="var(--border)" stroke-width="1"></line>
    ${bars}
  </svg>`;
}

export function svgDonut(items, { size = 140, thickness = 18 } = {}) {
  const total = items.reduce((s, i) => s + i.value, 0) || 1;
  const r = (size - thickness) / 2;
  const cx = size / 2, cy = size / 2;
  const circumference = 2 * Math.PI * r;
  let offset = 0;
  let circles = "";
  items.forEach((it) => {
    const frac = it.value / total;
    const dash = frac * circumference;
    circles += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${it.color}" stroke-width="${thickness}" stroke-dasharray="${dash.toFixed(2)} ${(circumference - dash).toFixed(2)}" stroke-dashoffset="${(-offset).toFixed(2)}" transform="rotate(-90 ${cx} ${cy})"></circle>`;
    offset += dash;
  });
  return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">${circles}</svg>`;
}

export const CATEGORY_COLORS = [
  "#38bd94", "#5b9bd5", "#f2c14e", "#e07a5f", "#9b5de5",
  "#00bbf9", "#f15bb5", "#fee440", "#00f5d4", "#ff6b6b",
  "#4ea8de", "#b8bb26"
];

export function colorForIndex(i) {
  return CATEGORY_COLORS[i % CATEGORY_COLORS.length];
}
