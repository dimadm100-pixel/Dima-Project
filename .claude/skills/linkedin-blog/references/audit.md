# The audit pass

Before delivery, every post gets an independent verification pass over its facts.
This is separate from the voice edit in Step 4 and must not be merged into it -
the two passes ask different questions, and doing them together means the fact
check gets skipped in favour of the more enjoyable wordsmithing.

The author is a financial analyst and an ACCA candidate writing for an audience
of the same. A post that misstates a policy rate or attributes a survey figure to
the wrong body damages him specifically, because his standing rests on getting
numbers right. Treat a factual error as a more serious failure than a clumsy
sentence.

The framing below is deliberately the one the author already works in. It is not
decoration: audit methodology is a well-tested procedure for exactly this problem
- confirming that assertions made in a document are supported by evidence - so
borrowing it gives the pass a structure rather than leaving it as "read it again
carefully."

## Contents

1. The claim ledger
2. The five assertions
3. Materiality
4. Evidence and its quality
5. Independence
6. The opinion
7. What goes in the delivery block

## 1. The claim ledger

The research step (Step 1) records every fact as it is gathered, before any
drafting happens. Write it to `ledger.json` in the working directory:

```json
{
  "window": { "start": "2026-08-21", "end": "2026-08-27" },
  "claims": [
    {
      "id": "C1",
      "fact": "CBU held the policy rate at 14%",
      "value": "14%",
      "source": "Central Bank of Uzbekistan press release",
      "url": "https://cbu.uz/en/press_center/releases/4256855/",
      "published": "2026-07-29",
      "quote": "the Board decided to keep the policy rate unchanged at 14 percent per annum",
      "evidence": "opened"
    }
  ]
}
```

`evidence` takes one of three values, and the distinction matters more than
anything else in this file:

- **opened** - the source page was actually fetched and read. Strongest.
- **corroborated** - the page could not be fetched, but the figure appeared
  identically in results from two or more independent searches or outlets.
- **unverified** - a single unconfirmed appearance. A claim at this level does
  not go in the post. Drop it or downgrade the sentence so it no longer depends
  on the number.

Building the ledger during research rather than reconstructing it afterwards is
the whole point. Reconstructing invites the draft to justify itself - you go
looking for support for what you already wrote, which is backwards and is how
plausible-sounding wrong numbers survive.

## 2. The five assertions

Test every factual statement in the post against these. They are borrowed from
the assertions used over transactions and balances, and they map onto the ways a
news claim actually goes wrong.

**Occurrence** - did this happen at all, and is the event described the event
that happened? The common failure is a proposal or a forecast reported as a
decision. "The central bank will cut" and "the governor said a cut is possible"
are different claims and only one is supportable.

**Accuracy** - is the figure stated exactly as the source states it? Check the
number, the unit, the period, and the direction. 6.4% year-on-year is not 6.4%
month-on-month. A rise from 58% to 76% is not "a 76% rise."

**Cut-off** - does the item fall inside the seven-day window, and is any date
stated in the post the correct one? Where a source is older than the window but
justified (see `research.md`), the post must make the timing clear rather than
implying it is news from this week.

**Completeness** - is any context omitted that would change how a reader reads
the number? This is the assertion most often failed, because omission does not
look like an error on the page. A survey statistic without its sample base, a
growth rate without the base period, a rate without saying whether it is nominal
or real. Ask what a well-informed reader in the comments would immediately point
out is missing.

**Presentation** - is the claim attributed to the right body, and is opinion
separated from fact? The author's own view must be recognisable as his view, not
smuggled in as though the source said it.

## 3. Materiality

Not every imprecision is worth holding the post for. Judge by whether correcting
it would change what a reader does or concludes.

**Material** - always fix before posting:
- a headline figure stated wrongly (a rate, an inflation print, a survey
  percentage)
- a claim attributed to the wrong institution or person
- a forecast or a possibility described as a decision
- a date that puts an event in the wrong week, or in the wrong order relative to
  another event in the post
- anything presented as the author's own experience that did not happen

**Not material** - note but do not block:
- rounding consistent with the source (6.4 versus 6.44)
- a publication named by its common short form
- a currency converted approximately where the exact rate is not the point

Where materiality is genuinely unclear, treat it as material. The cost of an
unnecessary check is a minute; the cost of a wrong number under the author's name
is his credibility with an audience of people who check.

## 4. Evidence and its quality

Rank what you are relying on, and prefer the higher rank whenever both are
available:

1. The primary document - the central bank release, the filing, the regulator's
   own page, the survey report itself
2. A named report of it by an outlet with editorial standards, dated
3. An aggregator or a search summary

Level 3 is not sufficient evidence on its own for a material figure. It is enough
to establish that a story exists and to tell you what to go and confirm. When
level 3 is all that is available - a blocked network, a paywall - the claim is at
best `corroborated`, never `opened`, and the delivery note has to say so.

Two sources that both trace back to the same press release are one source, not
two. Check whether apparent corroboration is genuinely independent before
counting it.

## 5. Independence

Re-derive each figure from the ledger, not from the draft. Read the claim in the
ledger, then find where the post states it, then compare. Doing it the other way
round - reading the post and asking "does this look right" - is the failure mode
this pass exists to prevent, because a number that survived into the draft
already looked right once.

If the same agent drafted and audits, be deliberate about the switch: the drafter
wants the post to work, the auditor does not care whether the post works. Where
the tooling allows it, running the audit as a separate subagent that sees the
ledger and the post but not the drafting reasoning is stronger, and is worth
doing when the post carries several load-bearing numbers.

## 6. The opinion

Conclude with one of four, and state it plainly:

- **Unqualified** - every material claim traces to adequate evidence. Ready to
  post.
- **Qualified** - the post is sound except for specific identified items. Name
  them and what would resolve each. This is the normal outcome when the network
  blocks source fetching: the argument holds, particular figures need the
  author's confirmation.
- **Adverse** - a material claim is wrong. The post does not go out until it is
  fixed. Say what is wrong rather than silently correcting and re-delivering, so
  the author knows the draft had an error in it.
- **Disclaimer** - verification was not possible to a level that supports any
  opinion. Deliver the draft explicitly as unverified, and say what the author
  must check before it can be published at all.

Never issue an unqualified opinion on a post containing a figure whose evidence
level is `corroborated`. That is what the qualified opinion is for, and using it
honestly is what makes the unqualified one mean something.

## 7. What goes in the delivery block

Keep it short - three or four lines, not a report. The author needs to know the
opinion, what to check, and nothing else:

```
Audit: Qualified.
- 6.4% June inflation, core PCE 3.3%, and the 58%->76% forecasting figure are
  corroborated across independent searches but no source page could be opened.
  Confirm against the primary release before posting.
- Everything else traces to a source named below.
```

Run `scripts/audit_post.py` first to catch the mechanical failures - length,
stray URLs, hashtags, and numbers in the post that appear nowhere in the ledger.
It cannot judge occurrence, completeness or materiality, so its clean result is a
starting point for the pass, not a substitute for it.
