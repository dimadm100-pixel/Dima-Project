import { db } from "./db.js";
import { renderDashboard } from "./pages/dashboard.js";
import { renderCashPosition } from "./pages/cashPosition.js";
import { renderCashFlow } from "./pages/cashFlow.js";
import { renderAccCashFlow } from "./pages/accCashFlow.js";
import { renderPnl } from "./pages/pnl.js";
import { renderBalanceSheet } from "./pages/balanceSheet.js";
import { renderGoals } from "./pages/goals.js";
import { renderTargets } from "./pages/targets.js";
import { renderSpecifications } from "./pages/specifications.js";
import { renderCreditRating } from "./pages/creditRating.js";
import { renderSettings } from "./pages/settings.js";
import { openTransactionModal } from "./pages/transactionForm.js";

const ROUTES = [
  { key: "dashboard", label: "Home", icon: "🏠", render: renderDashboard },
  { key: "cashposition", label: "Position", icon: "💵", render: renderCashPosition },
  { key: "cashflow", label: "Cash Flow", icon: "📅", render: renderCashFlow },
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
  const navItems = ROUTES.filter((r) => r.key !== "settings");
  bottomNav.innerHTML = navItems.map((r) => `<a href="#${r.key}" data-nav="${r.key}"><span class="nav-icon">${r.icon}</span>${r.label}</a>`).join("");
  desktopNav.innerHTML = ROUTES.map((r) => `<a href="#${r.key}" data-nav="${r.key}">${r.icon} ${r.label}</a>`).join("");
}

function currentRoute() {
  const raw = window.location.hash.replace(/^#\/?/, "") || "dashboard";
  const [key, sub] = raw.split("/");
  return { key, sub };
}

function render() {
  const { key, sub } = currentRoute();
  const route = ROUTES.find((r) => r.key === key) || ROUTES[0];
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
