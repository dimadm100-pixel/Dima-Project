# Dilmurod Finance Tracker

A personal finance tracking PWA (installable on your phone), built from the original "Personal Finance" Excel workbook. Lives entirely in `/app` — no build step, no server-side code, no external dependencies.

## What it does

One page per concern, all driven off a single transaction ledger so nothing can drift out of sync:

- **Dashboard** — current balance, this month's income/expenses, balance trend, goal progress, recent activity, credit score.
- **Cash Position** — the real, day-by-day ledger of actual money in/out, plus a manually-reconciled account snapshot (cards, cash, investments).
- **Cash Flow** — the budget: planned income/expenses by month, compared against actuals, with variance.
- **P&L** — income statement computed live from actual transactions only (the original sheet had hand-typed numbers disconnected from reality — this doesn't).
- **Balance Sheet** — assets, liabilities, and net worth, derived from the ledger plus any investments/debts you add.
- **Goals** — Marriage, Home, and Umrah planning calculators, each with a savings progress bar.
- **Targets** — checkpoint log of where you wanted to be vs where you are.
- **Specifications** — freeform expense/revenue breakdowns.
- **Credit Rating** — score history and trend.

## Also in `/app`: the Personal page

`app/personal.html` — same shell as the finance app (same dark navy, same fonts and spacing, same install/meta tags), with a gold accent so it's obvious which page you're on. The two are linked by the switcher at the top of both. Three sections, all saved to localStorage under their own key (`pft_dilmurod_personal_v1`), so finance data and personal data never touch:

- **Today's Plan** — today's tasks and appointments, each with an optional time or time range (11:30–12:30) and an optional note. Add, edit, delete, reorder, tick off. Nothing is ever removed on its own; **Clear** empties the list when you decide the day is done.
- **Tomorrow** — anything thought of tonight that belongs to tomorrow and isn't part of the routine. When the day starts it empties itself into Today's Plan, so nothing has to be retyped; the routine is added alongside it, so it never needs repeating here.
- **Routine** — your standing weekly template (gym Mon–Fri 07:00–08:00, study blocks, and so on), shown day by day with today highlighted, each item with an optional note. Each day's items are added to that day's plan automatically, the first time the page is opened that day — once only, so anything deleted stays deleted and a plan cleared later doesn't refill. **Copy today →** does it on demand for anything added since.
- **Notifications & Deadlines** — bills, exam dates, application deadlines. Sorted soonest-first, with a gold flag for anything inside 7 days and a red one for today or overdue.

### Installing it as its own app

The page ships its own `personal.webmanifest` and icons (`tools/make-personal-icons.py` draws them), so it installs to the home screen as a separate app from the tracker — its own gold checklist icon, opening straight to the Personal page. Like any PWA it has to be served over HTTPS for that, so install it from the deployed site, not from a local file:

- **Android (Chrome)**: open the Personal page → tap ⬇️ in the header, or the menu → "Install app".
- **iPhone (Safari)**: open the Personal page → Share → "Add to Home Screen".

### One-file version

`personal-standalone.html` at the repo root is the same page folded into a single file — stylesheets, scripts and icon all inlined — so it can be downloaded and opened on its own with no server. Generated, not hand-written; re-run `python3 tools/make-standalone-personal.py` after changing the page to bring it back in sync. It keeps its data separately from the hosted page, since a browser treats a local file as its own origin.

All data is stored locally on your device (localStorage) — nothing is sent anywhere. Use **Settings → Export data** regularly to back it up.

## Running it locally

```bash
cd app
python3 -m http.server 8080
```

Then open `http://localhost:8080` in a browser.

## Installing on your phone

The app needs to be served over **HTTPS** (or `localhost`) for "Add to Home Screen" / install to work — that's a browser requirement for PWAs, not something this app can bypass. Easiest free options, both give you HTTPS automatically:

1. **GitHub Pages**: enable Pages on this repo, set the source to the `app/` folder (or `/docs` if you rename it), push — you'll get a `https://<you>.github.io/...` URL.
2. **Netlify / Vercel** (drag-and-drop): drop the `app` folder in, get an instant HTTPS URL.

Once it's live on HTTPS:
- **Android (Chrome)**: open the URL → menu → "Install app" (or tap the install banner).
- **iPhone (Safari)**: open the URL → Share button → "Add to Home Screen".

It then behaves like a native app: own icon, full-screen, and it keeps working offline after the first load.

## Also in this repo: Don't Click The Button 🔴

A small, self-contained, playful/romantic game lives at the repo root in `index.html` (unrelated to the finance tracker above). Just open it in a browser — no build step, no dependencies. See the `messages` array and `WIN_CLICKS` constant near the top of its `<script>` section to customize the jokes or the finale message.
