import { db } from "./db.js";
import { renderDashboard } from "./pages/dashboard.js";
import { renderCashPosition } from "./pages/cashPosition.js";
import { renderCashFlow } from "./pages/cashFlow.js";
import { renderAccCashFlow } from "./pages/accCashFlow.js";
import { renderInsights } from "./pages/insights.js";
import { renderAssistant } from "./pages/assistant.js";
import { renderPlanner } from "./pages/planner.js";
import { renderFx } from "./pages/fx.js";
import { renderSearch } from "./pages/search.js";
import { renderPnl } from "./pages/pnl.js";
import { renderBalanceSheet } from "./pages/balanceSheet.js";
import { renderGoals } from "./pages/goals.js";
import { renderTargets } from "./pages/targets.js";
import { renderSpecifications } from "./pages/specifications.js";
import { renderCreditRating } from "./pages/creditRating.js";
import { renderSettings } from "./pages/settings.js";
import { renderHelp } from "./pages/help.js";
import { openTransactionModal } from "./pages/transactionForm.js";
import { openSpecEditor } from "./pages/specifications.js";
import { needsOnboarding, renderOnboarding } from "./pages/onboarding.js";
import { openSheet, closeSheet } from "./ui.js";
import { t as T, onLangChange, getLang } from "./i18n.js";

// `primary` decides what gets a slot in the phone's bottom bar; everything
// else lives on the More sheet (and the full desktop nav).
// `label` is a translation key, resolved every time the nav is drawn so it
// follows the chosen language rather than being baked in at load.
const ROUTES = [
  { key: "cashposition", label: "nav.cashposition", icon: "💵", render: renderCashPosition, primary: true },
  { key: "cashflow", label: "nav.cashflow", icon: "📅", render: renderCashFlow, primary: true },
  { key: "dashboard", label: "nav.dashboard", icon: "🏠", render: renderDashboard, primary: true },
  { key: "planner", label: "nav.planner", icon: "🧭", render: renderPlanner, primary: true },
  { key: "insights", label: "nav.insights", icon: "💡", render: renderInsights, primary: true },
  { key: "fx", label: "nav.fx", icon: "💱", render: renderFx },
  { key: "assistant", label: "nav.assistant", icon: "🤖", render: renderAssistant },
  { key: "search", label: "nav.search", icon: "🔍", render: renderSearch },
  { key: "acccashflow", label: "nav.acccashflow", icon: "🧮", render: renderAccCashFlow },
  { key: "pnl", label: "nav.pnl", icon: "📈", render: renderPnl },
  { key: "balancesheet", label: "nav.balancesheet", icon: "⚖️", render: renderBalanceSheet },
  { key: "goals", label: "nav.goals", icon: "🎯", render: (c, sub) => renderGoals(c, sub) },
  { key: "targets", label: "nav.targets", icon: "🏁", render: renderTargets },
  { key: "specifications", label: "nav.specifications", icon: "🧾", render: renderSpecifications },
  { key: "creditrating", label: "nav.creditrating", icon: "💳", render: renderCreditRating },
  { key: "settings", label: "nav.settings", icon: "⚙️", render: renderSettings },
  { key: "help", label: "nav.help", icon: "❓", render: renderHelp }
];

const view = document.getElementById("view");
const bottomNav = document.getElementById("bottom-nav");
const desktopNav = document.getElementById("desktop-nav");

function buildNav() {
  const primary = ROUTES.filter((r) => r.primary);
  bottomNav.innerHTML =
    primary.map((r) => `<a href="#${r.key}" data-nav="${r.key}"><span class="nav-icon">${r.icon}</span>${T(r.label)}</a>`).join("") +
    `<a href="#" id="more-nav"><span class="nav-icon">⋯</span>${T("nav.more")}</a>`;
  desktopNav.innerHTML = ROUTES.map((r) => `<a href="#${r.key}" data-nav="${r.key}">${r.icon} ${T(r.label)}</a>`).join("");

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
      ${r.icon}&nbsp;&nbsp;${T(r.label)}
    </button>`).join("");
  wrap.querySelectorAll("[data-go]").forEach((b) => {
    b.addEventListener("click", () => {
      closeSheet();
      window.location.hash = `#${b.dataset.go}`;
    });
  });
  openSheet(T("nav.more"), wrap);
}

function currentRoute() {
  const raw = window.location.hash.replace(/^#\/?/, "") || "dashboard";
  const [key, sub] = raw.split("/");
  return { key, sub };
}

function render() {
  if (needsOnboarding()) {
    view.innerHTML = "";
    view.dataset.page = "onboarding";
    renderOnboarding(view, render);
    document.querySelectorAll("[data-nav]").forEach((a) => a.classList.remove("active"));
    return;
  }
  const { key, sub } = currentRoute();
  const route = ROUTES.find((r) => r.key === key) || ROUTES.find((r) => r.key === "dashboard");
  view.innerHTML = "";
  // Every page draws into this one element. A page that finishes a network
  // request after you have already navigated away must not repaint over
  // whatever you are now looking at, so record who owns the view and let
  // those late callbacks check it first.
  view.dataset.page = route.key;
  route.render(view, sub);
  document.querySelectorAll("[data-nav]").forEach((a) => {
    a.classList.toggle("active", a.dataset.nav === route.key);
  });
  window.scrollTo(0, 0);
}

// Text that lives in index.html rather than in a page.
function applyShellText() {
  document.documentElement.lang = getLang();
  const set = (sel, text) => { const n = document.querySelector(sel); if (n) n.textContent = text; };
  set(".page-switch a[href='./index.html']", `💰 ${T("shell.finance")}`);
  set(".page-switch a[href='./personal.html']", `🗓️ ${T("shell.personal")}`);
  const install = document.getElementById("install-btn");
  if (install) install.title = T("shell.install");
  const settings = document.getElementById("settings-link");
  if (settings) settings.title = T("nav.settings");
  const fab = document.getElementById("fab");
  if (fab) fab.title = T("shell.addTransaction");
}

function init() {
  buildNav();
  applyShellText();
  // Redraw everything on a language change: the nav labels, the shell text
  // and whichever page is open.
  onLangChange(() => { buildNav(); applyShellText(); render(); });
  window.addEventListener("hashchange", render);
  db.onChange(() => {
    // Re-render current page whenever data changes from elsewhere (e.g. import).
  });
  render();

  // The + adds whatever the current page is about: a breakdown on
  // Specifications, a transaction everywhere else.
  document.getElementById("fab").addEventListener("click", () => {
    if (currentRoute().key === "specifications") {
      openSpecEditor(null, render);
    } else {
      openTransactionModal({ onSaved: render });
    }
  });

  document.getElementById("settings-link").addEventListener("click", () => {
    window.location.hash = "#settings";
  });
}

init();

// ---- PWA install + service worker ----
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
