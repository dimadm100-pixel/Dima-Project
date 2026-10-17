import { t as T } from "../i18n.js";

// A guide that travels with the app, so it is there on the phone when
// something is unclear rather than in a message that scrolled away.
//
// It has no language toggle of its own any more: it follows the app's
// language like every other page, so there is one setting rather than two
// that can disagree.

const PAGES = [
  { group: "main", icon: "💵", key: "position" },
  { group: "main", icon: "📅", key: "cashflow" },
  { group: "main", icon: "🏠", key: "dashboard" },
  { group: "main", icon: "🧭", key: "planner" },
  { group: "main", icon: "💡", key: "insights" },
  { group: "more", icon: "💱", key: "fx" },
  { group: "more", icon: "🤖", key: "assistant" },
  { group: "more", icon: "🔍", key: "search" },
  { group: "more", icon: "🧮", key: "acccashflow" },
  { group: "more", icon: "📈", key: "pnl" },
  { group: "more", icon: "⚖️", key: "balancesheet" },
  { group: "more", icon: "🎯", key: "goals" },
  { group: "more", icon: "🏁", key: "targets" },
  { group: "more", icon: "🧾", key: "specifications" },
  { group: "more", icon: "💳", key: "creditrating" },
  { group: "more", icon: "⚙️", key: "settings" },
  { group: "more", icon: "🗓️", key: "personal" }
];

const FIRST = ["onDevice", "backup", "plusButton", "offline"];
const FAQ = ["store", "mix", "cost", "move"];

function pageRows(group) {
  return PAGES
    .filter((p) => p.group === group)
    .map((p) => `
      <div style="display:flex; gap:12px; margin-bottom:16px;">
        <div style="font-size:20px; line-height:1.2; flex:0 0 26px;">${p.icon}</div>
        <div>
          <div style="font-weight:700; font-size:14px; margin-bottom:3px;">${T(`help.name.${p.key}`)}</div>
          <div style="font-size:13px; color:var(--text-dim); line-height:1.55;">${T(`help.page.${p.key}`)}</div>
        </div>
      </div>`)
    .join("");
}

export function renderHelp(container) {
  container.innerHTML = `
    <div class="page-title">${T("help.title")}</div>
    <p class="page-sub">${T("help.sub")}</p>

    <div class="card" style="border-color:var(--accent);">
      <h2>${T("help.firstTitle")}</h2>
      <ul style="margin:0; padding-left:18px; font-size:13px; line-height:1.65; color:var(--text-dim);">
        ${FIRST.map((k) => `<li style="margin-bottom:8px;">${T(`help.first.${k}`)}</li>`).join("")}
      </ul>
    </div>

    <div class="card">
      <h2>${T("help.mainLabel")}</h2>
      ${pageRows("main")}
    </div>

    <div class="card">
      <h2>${T("help.moreLabel")}</h2>
      ${pageRows("more")}
    </div>

    <div class="card">
      <h2>${T("help.faqTitle")}</h2>
      ${FAQ.map((k) => `
        <div style="margin-bottom:14px;">
          <div style="font-size:13px; font-weight:600; margin-bottom:4px;">${T(`help.faq.${k}.q`)}</div>
          <div style="font-size:13px; color:var(--text-dim); line-height:1.55;">${T(`help.faq.${k}.a`)}</div>
        </div>`).join("")}
    </div>

    <div class="card">
      <h2>${T("settings.languageTitle")}</h2>
      <p style="color:var(--text-dim); font-size:13px; margin-top:-6px;">${T("help.changeLanguage")}</p>
      <button class="btn secondary small" id="help-settings">${T("insights.openSettings")}</button>
    </div>
  `;

  container.querySelector("#help-settings").addEventListener("click", () => {
    window.location.hash = "#settings";
  });
}
