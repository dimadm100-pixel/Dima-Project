# Dima Finance Tracker

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
