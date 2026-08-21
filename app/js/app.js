import { db } from "./db.js";
import { renderDashboard } from "./pages/dashboard.js";
import { renderCashPosition } from "./pages/cashPosition.js";
import { renderCashFlow } from "./pages/cashFlow.js";
import { renderAccCashFlow } from "./pages/accCashFlow.js";
import { renderInsights } from "./pages/insights.js";
import { renderAssistant } from "./pages/assistant.js";
import { renderPlanner } from "./pages/planner.js";
import { renderSearch } from "./pages/search.js";
import { renderPnl } from "./pages/pnl.js";
import { renderBalanceSheet } from "./pages/balanceSheet.js";
import { renderGoals } from "./pages/goals.js";
import { renderTargets } from "./pages/targets.js";
import { renderSpecifications } from "./pages/specifications.js";
import { renderCreditRating } from "./pages/creditRating.js";
import { renderSettings } from "./pages/settings.js";
import { openTransactionModal } from "./pages/transactionForm.js";
import { openSheet, closeSheet } from "./ui.js";

// `primary` decides what gets a slot in the phone's bottom bar; everything
// else lives on the More sheet (and the full desktop nav).
const ROUTES = [
  { key: "cashposition", label: "Position", icon: "💵", render: renderCashPosition, primary: true },
  { key: "cashflow", label: "Cash Flow", icon: "📅", render: renderCashFlow, primary: true },
  { key: "dashboard", label: "Home", icon: "🏠", render: renderDashboard, primary: true },
  { key: "planner", label: "Planner", icon: "🧭", render: renderPlanner, primary: true },
  { key: "insights", label: "Insights", icon: "💡", render: renderInsights, primary: true },
  { key: "assistant", label: "Assistant", icon: "🤖", render: renderAssistant },
  { key: "search", label: "Search", icon: "🔍", render: renderSearch },
  { key: "acccashflow", label: "Acc. Cash", icon: "🧮", render: renderAccCashFlow },
  { key: "pnl", label: "P&L", icon: "📈", render: renderPnl },
  { key: "balancesheet", label: "Balance", icon: "⚖️", render: renderBalanceSheet },
  { key: "goals", label: "Goals", icon: "🎯", render: (c, sub) => renderGoals(c, sub) },
  { key: "targets", label: "Targets", icon: "🏁", render: renderTargets },
  { key: "specifications", label: "Specs", icon: "🧾", render: renderSpecifications },
  { key: "creditrating", label: "Credit", icon: "💳", render: renderCreditRating },
  { key: "settings", label: "Settings", icon: "⚙️", render: renderSettings }
];

const view = document.getElementById("view");
const bottomNav = document.getElementById("bottom-nav");
const desktopNav = document.getElementById("desktop-nav");

function buildNav() {
  const primary = ROUTES.filter((r) => r.primary);
  bottomNav.innerHTML =
    primary.map((r) => `<a href="#${r.key}" data-nav="${r.key}"><span class="nav-icon">${r.icon}</span>${r.label}</a>`).join("") +
    `<a href="#" id="more-nav"><span class="nav-icon">⋯</span>More</a>`;
  desktopNav.innerHTML = ROUTES.map((r) => `<a href="#${r.key}" data-nav="${r.key}">${r.icon} ${r.label}</a>`).join("");

  bottomNav.querySelector("#more-nav").addEventListener("click", (e) => {
    e.preventDefault();
    openMoreSheet();
  });
}

function openMoreSheet() {
  const rest = ROUTES.filter((r) => !r.primary);
  const wrap = document.createElement("div");
  wrap.innerHTML = rest.map((r) => `
    <button class="btn secondary" style="justify-content:flex-start; margin-bottom:8px;" data-go="${r.key}">
      ${r.icon}&nbsp;&nbsp;${r.label}
    </button>`).join("");
  wrap.querySelectorAll("[data-go]").forEach((b) => {
    b.addEventListener("click", () => {
      closeSheet();
      window.location.hash = `#${b.dataset.go}`;
    });
  });
  openSheet("More", wrap);
}

function currentRoute() {
  const raw = window.location.hash.replace(/^#\/?/, "") || "dashboard";
  const [key, sub] = raw.split("/");
  return { key, sub };
}

function render() {
  const { key, sub } = currentRoute();
  const route = ROUTES.find((r) => r.key === key) || ROUTES.find((r) => r.key === "dashboard");
  view.innerHTML = "";
  route.render(view, sub);
  document.querySelectorAll("[data-nav]").forEach((a) => {
    a.classList.toggle("active", a.dataset.nav === route.key);
  });
  window.scrollTo(0, 0);
}

function init() {
  buildNav();
  window.addEventListener("hashchange", render);
  db.onChange(() => {
    // Re-render current page whenever data changes from elsewhere (e.g. import).
  });
  render();

  document.getElementById("fab").addEventListener("click", () => {
    openTransactionModal({ onSaved: render });
  });

  document.getElementById("settings-link").addEventListener("click", () => {
    window.location.hash = "#settings";
  });
}

init();

// ---- PWA install + service worker ----
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}

let deferredInstallPrompt = null;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  const installBtn = document.getElementById("install-btn");
  if (installBtn) installBtn.style.display = "flex";
});

const installBtn = document.getElementById("install-btn");
if (installBtn) {
  installBtn.addEventListener("click", async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    installBtn.style.display = "none";
  });
}
