import { escapeHtml } from "../utils.js";
import { storageKey } from "../config.js";

// A guide that travels with the app, so it is there on the phone when
// something is unclear rather than in a message that scrolled away.
//
// Written for someone opening the app for the first time, in both languages,
// because the two people using it read different ones.

const LANG_KEY = storageKey("help_lang");

function getLang() {
  try {
    const stored = localStorage.getItem(LANG_KEY);
    if (stored === "uz" || stored === "en") return stored;
  } catch (e) { /* private window, blocked storage */ }
  return "uz";
}

function setLang(lang) {
  try { localStorage.setItem(LANG_KEY, lang); } catch (e) { /* not essential */ }
}

const CONTENT = {
  uz: {
    title: "Qo'llanma",
    sub: "Har bir sahifa nima qilishi, qisqacha.",
    firstTitle: "Avval shuni bil",
    first: [
      "Hamma ma'lumot <strong>faqat shu telefonda</strong> turadi. Server yo'q, hech narsa hech qayerga yuborilmaydi, hech kim ko'rmaydi.",
      "Shuning uchun <strong>Settings → Export data</strong> ni vaqti-vaqti bilan bosib, faylni saqlab qo'y. Boshqa zaxira nusxa yo'q.",
      "Pastdagi <strong>+</strong> tugmasi — kirim yoki chiqim qo'shadi. Qaysi kartadan ekanini albatta ko'rsat.",
      "Internetsiz ham ishlaydi. Faqat FX Rates va Assistant internet talab qiladi."
    ],
    mainLabel: "Pastki menyu",
    moreLabel: "More (⋯) ichida",
    pages: [
      { group: "main", icon: "💵", name: "Position", text: "Haqiqatda bo'lgan pul. Har bir karta va naqd pulning qoldig'i, va hamma kirim-chiqim ro'yxati. Eng pastdagi <strong>Opening balance</strong> qatoridagi Edit — boshlang'ich summani o'zgartirish." },
      { group: "main", icon: "📅", name: "Cash Flow", text: "Reja. Kelajakdagi kirim-chiqimni kun bo'yicha yozasan. Qatorlarni qo'shish, o'zgartirish, o'chirish mumkin. Oylik PLAN va FAKT solishtiriladi." },
      { group: "main", icon: "🏠", name: "Home", text: "Bir qarashda hammasi: qancha pul bor va necha kunga yetadi, shu oydagi kirim-chiqim, balans grafigi, ogohlantirishlar va maqsadlar." },
      { group: "main", icon: "🧭", name: "Planner", text: "Kelasi 12 oylik byudjetni o'zi tuzadi — takrorlanuvchi to'lovlaring va haqiqiy xarajatlaring medianasi asosida. Ko'rib chiqasan, summalarni o'zgartirasan, keyin Apply. <strong>AI emas: bepul va internetsiz ishlaydi.</strong>" },
      { group: "main", icon: "💡", name: "Insights", text: "Sening raqamlaring tahlili: jamg'arish foizi, qayerda pul oqib ketyapti, maqsadga qachon yetasan. <strong>Bu ham AI emas.</strong> API key qo'shsang, qo'shimcha matnli AI tahlil ham chiqadi — ixtiyoriy." },
      { group: "more", icon: "💱", name: "FX Rates", text: "Markaziy bank kursi (USD, EUR). \"Load past 30/90/180 days\" — ilovani o'rnatgandan oldingi tarixni ham yuklaydi. Xohlasang, Marriage va Umrah maqsadlari jonli kurs bo'yicha qayta hisoblanadi." },
      { group: "more", icon: "🤖", name: "Assistant", text: "Ilova ichidagi AI. O'zgartirishni faqat <em>taklif</em> qiladi, sen tasdiqlaysan. <strong>Anthropic API key kerak</strong> (Settings'da) — server olish kerak emas. Ishlatmasang ham bo'ladi." },
      { group: "more", icon: "🔍", name: "Search", text: "Istalgan xarajat, kirim yoki byudjet qatorini matn yoki summa bo'yicha qidirish." },
      { group: "more", icon: "🧮", name: "Acc. Cash", text: "Kun bo'yicha: reja bo'yicha qancha puling bo'lishi kerak va aslida qancha. Kelajakdagi \"teshik\" ni oldindan ko'rsatadi." },
      { group: "more", icon: "📈", name: "P&L", text: "Oylik kirim, chiqim va sof foyda. Pastida xarajatlar kategoriyalar bo'yicha." },
      { group: "more", icon: "⚖️", name: "Balance", text: "Aktivlar (naqd, investitsiya, qarzga berganlaring), majburiyatlar (qarz, kredit) va net worth = aktivlar − majburiyatlar." },
      { group: "more", icon: "🎯", name: "Goals", text: "3 ta maqsad: Marriage, Home, Umrah — har birining o'z kalkulyatori bilan. Yig'ilgan summani yozib borasan, foiz o'zi hisoblanadi." },
      { group: "more", icon: "🏁", name: "Targets", text: "O'zing belgilagan sanalarda (chorak oxiri, yil oxiri) qancha sof pul bo'lishi kerak edi va qancha bo'ldi." },
      { group: "more", icon: "🧾", name: "Specs", text: "Bitta summaning ichi. \"Oziq-ovqat 200,000\" → non 20,000, yog' 30,000... <strong>+ New breakdown</strong> tugmasi bilan qo'shiladi." },
      { group: "more", icon: "💳", name: "Credit", text: "KATM dan ko'rgan kredit reytingni yozib borasan, ball va trend ko'rinadi." },
      { group: "more", icon: "⚙️", name: "Settings", text: "Boshlang'ich balans, har oy takrorlanadigan to'lovlar (va ularni 12 oylik byudjetga bir bosishda joylash), API key, va eng muhimi — <strong>Export / Import</strong>." },
      { group: "more", icon: "🗓️", name: "Personal", text: "Yuqoridagi 💰 ⇄ 🗓️ tugmalari orqali. Pul emas: bugungi reja, ertangi reja, haftalik routine va deadline'lar. Ma'lumoti alohida saqlanadi." }
    ],
    faqTitle: "Savollar",
    faq: [
      { q: "Play Market'da bormi?", a: "Yo'q. Brauzerdan to'g'ridan-to'g'ri o'rnatiladi. Shuning uchun yangilanish o'zi keladi — ilovani ochsang, eng yangi versiyasi yuklanadi." },
      { q: "Ma'lumotlarimiz aralashib ketmaydimi?", a: "Yo'q. Har bir nusxa butunlay alohida saqlanadi — bitta telefonda ikkalasini ochsang ham bir-birini ko'rmaydi." },
      { q: "Pul to'lanadimi?", a: "Yo'q. Faqat Assistant va Insights'dagi AI tahlil uchun API key kerak — ixtiyoriy. Qolgan hammasi bepul." },
      { q: "Yangi telefonga qanday ko'chiraman?", a: "Eskisida Settings → Export data, faylni saqlaysan. Yangisida ilovani o'rnatib, Settings → Import data." }
    ]
  },

  en: {
    title: "Guide",
    sub: "What each page does, briefly.",
    firstTitle: "Read this first",
    first: [
      "All your data stays <strong>on this phone only</strong>. There is no server, nothing is uploaded, nobody else can see it.",
      "So press <strong>Settings → Export data</strong> now and then and keep the file. There is no other backup.",
      "The <strong>+</strong> button adds income or an expense. Always say which account it came from.",
      "It works offline. Only FX Rates and the Assistant need a connection."
    ],
    mainLabel: "Bottom bar",
    moreLabel: "Under More (⋯)",
    pages: [
      { group: "main", icon: "💵", name: "Position", text: "What actually happened. The balance of each card and your cash, plus the full ledger. The <strong>Edit</strong> button on the Opening balance row at the bottom sets what you started with." },
      { group: "main", icon: "📅", name: "Cash Flow", text: "The plan. Enter expected income and expenses by date; lines can be added, edited and deleted. Compares PLAN against FACT each month." },
      { group: "main", icon: "🏠", name: "Home", text: "Everything at a glance: how much you have and how long it lasts, this month's income and expenses, the balance trend, alerts and goal progress." },
      { group: "main", icon: "🧭", name: "Planner", text: "Builds a 12-month budget from your recurring items and the median of your real spending. Review it, change any amount, then Apply. <strong>Not AI: free and works offline.</strong>" },
      { group: "main", icon: "💡", name: "Insights", text: "Analysis of your own numbers: savings rate, where money leaks, when each goal lands. <strong>Also not AI.</strong> Add an API key and an extra written AI review appears — optional." },
      { group: "more", icon: "💱", name: "FX Rates", text: "Central Bank rates (USD, EUR). \"Load past 30/90/180 days\" fetches history from before you installed the app. Optionally, Marriage and Umrah targets can follow the live rate." },
      { group: "more", icon: "🤖", name: "Assistant", text: "The in-app AI. It only <em>proposes</em> changes; you approve them. <strong>Needs an Anthropic API key</strong> (Settings) — no server required. You can ignore it entirely." },
      { group: "more", icon: "🔍", name: "Search", text: "Find any expense, income or budget line by text or amount." },
      { group: "more", icon: "🧮", name: "Acc. Cash", text: "Day by day: how much you should have per the budget, and how much you really do. Shows a future cash hole before you reach it." },
      { group: "more", icon: "📈", name: "P&L", text: "Monthly income, expenses and net profit, with expenses broken down by category." },
      { group: "more", icon: "⚖️", name: "Balance", text: "Assets (cash, investments, money owed to you), liabilities (debts, loans), and net worth = assets − liabilities." },
      { group: "more", icon: "🎯", name: "Goals", text: "Three goals — Marriage, Home, Umrah — each with its own calculator. Record what you have saved and the percentage works itself out." },
      { group: "more", icon: "🏁", name: "Targets", text: "The dates you care about (quarter ends, year end): how much net cash you planned to have by then, and how much you had." },
      { group: "more", icon: "🧾", name: "Specs", text: "What a single figure is made of. \"Food 200,000\" → bread 20,000, oil 30,000… Add one with <strong>+ New breakdown</strong>." },
      { group: "more", icon: "💳", name: "Credit", text: "Record the score you see on KATM over time, and watch the trend." },
      { group: "more", icon: "⚙️", name: "Settings", text: "Opening balance, monthly recurring payments (and filling a year of budget from them in one press), API key, and most importantly <strong>Export / Import</strong>." },
      { group: "more", icon: "🗓️", name: "Personal", text: "Through the 💰 ⇄ 🗓️ switcher at the top. Not money: today's plan, tomorrow's, your weekly routine and deadlines. Stored separately." }
    ],
    faqTitle: "Questions",
    faq: [
      { q: "Is it on the Play Store?", a: "No. It installs straight from the browser. That is also why updates arrive on their own — open the app and you have the newest version." },
      { q: "Can two copies mix up each other's data?", a: "No. Each copy is stored entirely separately — open both on one phone and neither can see the other." },
      { q: "Does it cost anything?", a: "No. Only the Assistant and the AI review in Insights need an API key, and both are optional. Everything else is free." },
      { q: "How do I move to a new phone?", a: "On the old one: Settings → Export data, and keep the file. On the new one: install the app, then Settings → Import data." }
    ]
  }
};

function pageRows(pages, group) {
  return pages
    .filter((p) => p.group === group)
    .map((p) => `
      <div style="display:flex; gap:12px; margin-bottom:16px;">
        <div style="font-size:20px; line-height:1.2; flex:0 0 26px;">${p.icon}</div>
        <div>
          <div style="font-weight:700; font-size:14px; margin-bottom:3px;">${escapeHtml(p.name)}</div>
          <div style="font-size:13px; color:var(--text-dim); line-height:1.55;">${p.text}</div>
        </div>
      </div>`)
    .join("");
}

export function renderHelp(container) {
  const lang = getLang();
  const c = CONTENT[lang];

  container.innerHTML = `
    <div class="page-title">${escapeHtml(c.title)}</div>
    <p class="page-sub">${escapeHtml(c.sub)}</p>

    <div class="segmented" style="margin-bottom:16px;">
      <button data-lang="uz" class="${lang === "uz" ? "active" : ""}">O'zbekcha</button>
      <button data-lang="en" class="${lang === "en" ? "active" : ""}">English</button>
    </div>

    <div class="card" style="border-color:var(--accent);">
      <h2>${escapeHtml(c.firstTitle)}</h2>
      <ul style="margin:0; padding-left:18px; font-size:13px; line-height:1.65; color:var(--text-dim);">
        ${c.first.map((line) => `<li style="margin-bottom:8px;">${line}</li>`).join("")}
      </ul>
    </div>

    <div class="card">
      <h2>${escapeHtml(c.mainLabel)}</h2>
      ${pageRows(c.pages, "main")}
    </div>

    <div class="card">
      <h2>${escapeHtml(c.moreLabel)}</h2>
      ${pageRows(c.pages, "more")}
    </div>

    <div class="card">
      <h2>${escapeHtml(c.faqTitle)}</h2>
      ${c.faq.map((f) => `
        <div style="margin-bottom:14px;">
          <div style="font-size:13px; font-weight:600; margin-bottom:4px;">${escapeHtml(f.q)}</div>
          <div style="font-size:13px; color:var(--text-dim); line-height:1.55;">${escapeHtml(f.a)}</div>
        </div>`).join("")}
    </div>
  `;

  container.querySelectorAll("[data-lang]").forEach((btn) => {
    btn.addEventListener("click", () => {
      setLang(btn.dataset.lang);
      renderHelp(container);
      window.scrollTo(0, 0);
    });
  });
}
