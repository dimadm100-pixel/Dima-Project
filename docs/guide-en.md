# Finance Tracker — full guide

## Read this first

**All your data lives only on your phone.** There is no server, no sign-up, and nothing is uploaded anywhere. Nobody else can see your numbers.

That is both the good part and the risk. If you clear your browser data or lose the phone, it is all gone. So:

> Press **Settings → Export data** now and then and keep the file somewhere safe (sending it to yourself on Telegram is fine). On a new phone, **Import data** brings everything back.

The app works offline. Only FX Rates and the Assistant need a connection.

## Installing

Open the link on your phone, then:

- **Android (Chrome):** ⋮ menu → **Install app**
- **iPhone (Safari):** Share icon → **Add to Home Screen**

After that it opens like a normal app — full screen, and it works without a connection.

⚠️ Never tap **Clear browsing data**, or clear this site's data in Chrome's site settings. That erases everything you have entered.

## First launch

A Welcome screen asks two things:

1. **Your language** — Uzbek, Russian or English.
2. **Where you keep your money** and **how much is on it right now** — your main card, or cash.
3. **The date your records start** — usually today.

That is all. You can change any of it later, so don't worry about getting it exactly right.

To add more cards: **Position → + Add account**.
To change the starting amount: the **Edit** button on the **Opening balance** row at the bottom of **Position**.

## Day-to-day use

The **+** button at the bottom adds income or an expense. It asks for the amount, date, category, and **which account** it came from.

Naming the account matters. If you skip it, Position shows a **"Ledger doesn't balance"** warning — meaning your total cash and your card balances no longer agree. The **"Assign them now"** button fixes them all in one screen.

---

# The pages

## 💵 Position — what actually happened

- Today's total balance at the top.
- **Accounts** — each card and your cash, with what is left on it. These figures are never typed in by hand: they are worked out from the starting amount plus everything assigned to that account.
- **Ledger** — every transaction, newest first, each showing the running balance at that moment.
- At the bottom, **Opening balance** — the money you began with. Tap **Edit** to set each account's starting amount; the total follows automatically.
- Transfers between your own accounts appear here for context (they don't change your total — the money just moved).

## 📅 Cash Flow — the plan

This is where the future goes: what you expect to come in or go out, and on which day.

- Budget lines can be **added, edited and deleted** — both the amount and whether it is income or an expense.
- Monthly **PLAN vs FACT** puts what you budgeted next to what you actually spent, per category.

If Position is "what happened", Cash Flow is "what is going to happen".

## 🏠 Home — the overview

Everything at a glance:

- How much you have now, and **how many days it lasts** at your current rate of spending.
- Income and expenses this month.
- **Balance trend** — the next 21 days: actual up to today, then projected from your budget.
- **Budget watch** — which categories are over budget, or burning through it too fast.
- Goal progress as percentages.
- Recent activity, upcoming budget lines, and your latest credit score.

## 🧭 Planner — the automatic budget

Builds a 12-month budget for you. It draws on, in order:

1. Your **recurring items** from Settings (rent, salary) — these are explicit intent, always honoured.
2. Your **actual spending** — the median monthly total for each category.
3. Your existing budget, only if there is no real spending to learn from.

Frequent costs like food get spread across the month; once-a-month items like rent or salary land on the day they usually land on.

You then **review the plan, change any amount**, pick how often each item should repeat, and press **Apply**.

> ⚠️ This is **not AI**. It is plain arithmetic over your own numbers. No API key, no connection, no cost.

## 💡 Insights — the analysis

Analysis of your own figures. **Also not AI, and works offline:**

- Your savings rate.
- Where money is leaking.
- When each goal lands at your current pace, and how many months that is.

Optional extra: if you add an Anthropic API key in Settings, an **AI review** button appears and writes the analysis out in prose. **It is not required** — the main part of the page works fully without a key.

## 💱 FX Rates

- Official Central Bank rates — currently **USD and EUR** — with the change against the previous day.
- **"Load past 30/90/180 days"** pulls real history from cbu.uz, so you see rates from before you installed the app, not only since.
- **"Track the live rate"** (off by default): turn it on and your **Marriage and Umrah** targets follow the live rate instead of the fixed one you set. If the sum weakens, you see the goal getting more expensive straight away.
- Rate alerts: set an upper or lower bound and Home tells you when it is crossed.

## 🤖 Assistant — the in-app AI

A chat window: ask questions about your money, or give it a task ("build next year's budget"). It reads your data and **proposes** changes — nothing is altered until you approve it.

> This needs an **Anthropic API key** (set in Settings) and is paid per use. **No server is needed** — there is no server anywhere in this app.
>
> You can ignore it entirely: everything else works without a key, Planner and Insights included.

## 🔍 Search

Find any expense, income or budget line by text or amount.

## 🧮 Acc. Cash — accumulated cash

A day-by-day table: how much you **should** have on each date according to the budget, and how much you **actually** do.

Its real value is spotting a hole before you reach it — you can see the day your cash would go negative while there is still time to do something about it.

## 📈 P&L — profit and loss

Monthly income, expenses and net profit, with expenses broken down by category underneath.

## ⚖️ Balance — the balance sheet

- **Assets:** cash, investments, money owed to you.
- **Liabilities:** debts and loans.
- **Equity / net worth** = assets − liabilities. What you are actually worth.

## 🎯 Goals

This version has three specific goals, each with its own calculator:

- **Marriage** — annual reserve in USD, and the rate.
- **Home** — square metres, price per m², deposit percentage, markup and term.
- **Umrah** — cost per person in USD, how many people, plus a buffer.

You record how much you have saved toward each, and the percentage works itself out.

> Note: these three are fixed in this version — you cannot add a new goal under your own name.

## 🏁 Targets — your checkpoints

The dates you care about (the end of each quarter, year-end). For each: how much net cash you **planned** to have by then, and how much you **actually** had.

It is the short version of Acc. Cash, showing only the dates that matter to you.

## 🧾 Specs — what a figure is made of

For breaking a single number down.

"Food — 200,000": bread 20,000, oil 30,000, butter 25,000, and so on. The total adds itself up.

Use the **+ New breakdown** button.

## 💳 Credit — credit rating

Record the score you see on KATM from time to time. KATM scores out of **500**, so the app shows your score against that scale, its band and letter grade (A–E), and a chart over time.

## ⚙️ Settings

Not just "basic settings" — the important things live here:

- **Language** — Uzbek, Russian or English. The whole app changes straight away.
- **Opening balance** — the starting amount and date.
- **Recurring transactions** — things you pay or earn every month. Set them once, then **"Generate into budget (12 months)"** fills a year of budget in one press.
- **AI features** — Anthropic API key and model.
- **Backup** — **Export data (.json)** and **Import data**. Don't forget this one.
- **Danger zone** — wipe everything.

## 🗓️ Personal — not about money

Reached through the **💰 Finance ⇄ 🗓️ Personal** switcher at the top. A separate page:

- **Today's Plan** — today's items, with times.
- **Tomorrow** — write it the night before; it moves into today's plan when the day starts.
- **Routine** — your standing weekly schedule, added to each day's plan automatically.
- **Deadlines** — dates coming up.

Its data is stored completely separately from your money data.

---

## Common questions

**Is it on the Play Store?**
No. It is a PWA — installed straight from the browser, no store involved. That is also why updates arrive on their own: open the app and you have the newest version. It could be packaged for the Play Store, but that needs extra work and buys you nothing right now.

**Can our two copies mix up each other's data?**
No. The two copies are stored entirely separately — open both in the same browser on the same phone and neither can see the other.

**Do I need a connection?**
Only for FX Rates and the Assistant. Everything else works offline.

**Does it cost anything?**
No. Only the Assistant and the "AI review" button in Insights need an Anthropic API key, which is optional and billed separately. The app itself, including Planner and the main part of Insights, is free.

**How do I move to a new phone?**
On the old one: Settings → Export data, and keep the file. On the new one: install the app, then Settings → Import data.
