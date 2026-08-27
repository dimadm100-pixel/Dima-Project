#!/usr/bin/env python3
"""Mechanical checks over a drafted LinkedIn post against its claim ledger.

Catches the failures that are tedious and easy to miss by eye: a number in the
post that appears nowhere in the ledger, a claim still marked unverified, a
source dated outside the week, a stray URL, length drift.

It cannot judge occurrence, completeness, materiality or tone. A clean run means
the post is ready for the human-judgement part of the audit in
references/audit.md, not that it is ready to publish.

Usage:
    python3 scripts/audit_post.py --post draft.txt --ledger ledger.json
    python3 scripts/audit_post.py --post draft.txt --ledger ledger.json \
        --min-chars 1800 --max-chars 2600 --allow "em-dash,emoji,closing-question"

Exit codes: 0 clean, 1 findings raised, 2 could not run.
"""

import argparse
import json
import re
import sys
import unicodedata
from datetime import date

# Phrases that read as machine-written regardless of whose voice it is. Habits
# that some real people genuinely have (em dashes, emoji, hashtags) are handled
# by --allow instead, because for those the voice profile is the authority.
BANNED = [
    "in today's fast-paced", "in an era of", "the landscape is shifting",
    "here's the thing", "let that sink in", "the bottom line", "at the end of the day",
    "key takeaway", "moving forward", "it's worth noting", "deep dive",
    "game-chang", "delve", "seamless", "robust", "unlock", "harness",
    "navigate the complexities", "paradigm shift", "actionable insight",
    "a stark reminder", "speaks volumes", "testament to", "tapestry",
    "cutting-edge", "best-in-class", "holistic", "synergy", "plethora", "myriad",
    "drop a comment", "thoughts?", "agree?", "what's your take",
]

NOT_X_BUT_Y = re.compile(
    r"(?:\b(?:is|are|was|were|does|do)n'?t|\b(?:is|are|was|were) not|'s not|'re not)"
    r"\s+(?:just\s+)?[^.!?\n]{2,60}[,.]\s*"
    r"(?:it'?s|this is|that'?s|they'?re|we'?re|it is)\b",
    re.I,
)

URL = re.compile(r"https?://\S+|\bwww\.\S+", re.I)
HASHTAG = re.compile(r"(?<!\w)#\w+")

# Figures worth tracing: percentages, decimals, thousands-separated amounts,
# 4-digit years, and bare integers of 2+ digits. Single digits are skipped -
# they are almost always prose ("three things", "one year") not evidence.
NUMBER = re.compile(r"\d+(?:[.,]\d+)*\s*%|\d+(?:[.,]\d{3})+(?:\.\d+)?|\d+\.\d+|\b\d{2,}\b")

MONTHS = ("january february march april may june july august september october "
          "november december").split()
DATE_PHRASE = re.compile(
    r"\b\d{1,2}\s*(?:[-–—]\s*\d{1,2}\s*)?(?:" + "|".join(MONTHS) + r")\b"
    r"|\b(?:" + "|".join(MONTHS) + r")\s+\d{1,2}\b",
    re.I,
)


def norm(s):
    """Fold dashes, quotes and separators so 58-76 matches 58 to 76."""
    s = unicodedata.normalize("NFKC", s)
    s = re.sub(r"[‐-―−]", "-", s)
    s = re.sub(r"[‘’“”]", "'", s)
    return s.lower()


def num_key(tok):
    """Comparable form of a numeric token: 30,000 -> 30000, 6.4% -> 6.4%."""
    t = norm(tok).replace(" ", "")
    pct = t.endswith("%")
    t = t.rstrip("%")
    if re.fullmatch(r"\d{1,3}(,\d{3})+(\.\d+)?", t):
        t = t.replace(",", "")
    t = t.replace(",", ".")
    t = t.rstrip("0").rstrip(".") if "." in t else t
    return t + ("%" if pct else "")


def emoji_count(s):
    return sum(
        1 for ch in s
        if unicodedata.category(ch) == "So"
        or 0x1F000 <= ord(ch) <= 0x1FAFF
        or ord(ch) in (0x20E3,)
    )


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--post", required=True)
    ap.add_argument("--ledger", required=True)
    ap.add_argument("--min-chars", type=int, default=1300)
    ap.add_argument("--max-chars", type=int, default=2100)
    ap.add_argument("--max-hashtags", type=int, default=0,
                    help="Hashtags the voice profile permits. Default 0.")
    ap.add_argument("--allow", default="",
                    help="Comma-separated habits the voice profile sanctions: "
                         "em-dash, emoji, closing-question.")
    args = ap.parse_args()

    allow = {a.strip() for a in args.allow.split(",") if a.strip()}

    try:
        post = open(args.post, encoding="utf-8").read().strip()
    except OSError as e:
        print(f"cannot read post: {e}", file=sys.stderr)
        return 2
    try:
        ledger = json.load(open(args.ledger, encoding="utf-8"))
    except (OSError, ValueError) as e:
        print(f"cannot read ledger: {e}", file=sys.stderr)
        return 2

    claims = ledger.get("claims", [])
    window = ledger.get("window", {})
    findings, notes = [], []

    # --- length -----------------------------------------------------------
    n = len(post)
    if n < args.min_chars:
        findings.append(f"Length {n} is below the target minimum {args.min_chars}.")
    elif n > args.max_chars:
        findings.append(f"Length {n} is above the target maximum {args.max_chars}.")
    else:
        notes.append(f"Length {n} chars, within {args.min_chars}-{args.max_chars}.")
    if n > 3000:
        findings.append(f"Length {n} exceeds LinkedIn's 3000-character hard limit.")

    # --- numbers trace to the ledger --------------------------------------
    blob = norm(" ".join(
        f"{c.get('fact','')} {c.get('value','')} {c.get('quote','')} "
        f"{c.get('published','')} {c.get('source','')}"
        for c in claims
    ))
    ledger_nums = {num_key(t) for t in NUMBER.findall(blob)}
    ledger_dates = {norm(d) for d in DATE_PHRASE.findall(blob)}
    # A claim's publication date is held as ISO, so also accept the prose forms
    # a post would actually use for it ("26 August", "August 26").
    for c in claims:
        try:
            d = date.fromisoformat(c.get("published", ""))
        except ValueError:
            continue
        m = MONTHS[d.month - 1]
        ledger_dates.update({f"{d.day} {m}", f"{m} {d.day}"})

    orphan_nums = sorted({
        tok.strip() for tok in NUMBER.findall(post)
        if num_key(tok) not in ledger_nums
    }, key=lambda s: (len(s), s))
    if orphan_nums:
        findings.append(
            "Figures in the post that appear nowhere in the ledger: "
            + ", ".join(orphan_nums)
            + ". Each needs a ledger entry or must come out of the post."
        )

    orphan_dates = sorted({
        d.strip() for d in DATE_PHRASE.findall(post) if norm(d) not in ledger_dates
    })
    if orphan_dates:
        findings.append(
            "Dates stated in the post but not in the ledger: "
            + ", ".join(orphan_dates) + ". Confirm each against its source."
        )

    # --- evidence quality --------------------------------------------------
    unverified = [c.get("id", "?") for c in claims
                  if c.get("evidence") == "unverified"]
    if unverified:
        findings.append(
            "Ledger claims still marked unverified: " + ", ".join(unverified)
            + ". These must not appear in the post."
        )
    corroborated = [c.get("id", "?") for c in claims
                    if c.get("evidence") == "corroborated"]
    if corroborated:
        notes.append(
            "Corroborated but not opened: " + ", ".join(corroborated)
            + ". The opinion cannot be unqualified; name these in the delivery note."
        )
    bad_ev = [c.get("id", "?") for c in claims
              if c.get("evidence") not in ("opened", "corroborated", "unverified")]
    if bad_ev:
        findings.append("Ledger entries with a missing or invalid evidence level: "
                        + ", ".join(bad_ev) + ".")

    # --- cut-off -----------------------------------------------------------
    start, end = window.get("start"), window.get("end")
    if start and end:
        try:
            s, e = date.fromisoformat(start), date.fromisoformat(end)
            for c in claims:
                p = c.get("published")
                if not p:
                    findings.append(f"Ledger claim {c.get('id','?')} has no publication date.")
                    continue
                try:
                    d = date.fromisoformat(p)
                except ValueError:
                    findings.append(f"Ledger claim {c.get('id','?')} has an unparseable date {p!r}.")
                    continue
                if not (s <= d <= e):
                    notes.append(
                        f"Claim {c.get('id','?')} dated {p} falls outside the window "
                        f"{start} to {end}. The post must make that timing explicit."
                    )
        except ValueError:
            findings.append("Ledger window dates are not valid ISO dates.")
    else:
        findings.append("Ledger has no window; cut-off cannot be tested.")

    if not claims:
        findings.append("Ledger contains no claims.")
    elif len(claims) < 3:
        notes.append(f"Only {len(claims)} claims in the ledger for a three-item post.")

    # --- presentation ------------------------------------------------------
    for u in URL.findall(post):
        findings.append(f"URL in the post body ({u}). Links belong in the first comment.")

    tags = HASHTAG.findall(post)
    if len(tags) > args.max_hashtags:
        findings.append(
            f"{len(tags)} hashtags ({' '.join(tags)}); the voice profile permits "
            f"{args.max_hashtags}."
        )

    low = norm(post)
    hits = [b for b in BANNED if b in low]
    if hits:
        findings.append("Phrases that read as machine-written: " + ", ".join(hits) + ".")
    if NOT_X_BUT_Y.search(post):
        findings.append("The \"it's not X, it's Y\" construction appears.")

    if "em-dash" not in allow and re.search(r"[—–]", post):
        findings.append("Em or en dashes present and not sanctioned by the voice profile.")
    if "emoji" not in allow and emoji_count(post):
        findings.append(f"{emoji_count(post)} emoji present and not sanctioned by the voice profile.")

    # --- report ------------------------------------------------------------
    print("AUDIT: mechanical checks\n" + "=" * 40)
    if findings:
        print(f"\n{len(findings)} finding(s):")
        for i, f in enumerate(findings, 1):
            print(f"  {i}. {f}")
    else:
        print("\nNo mechanical findings.")
    if notes:
        print(f"\n{len(notes)} note(s):")
        for i, m in enumerate(notes, 1):
            print(f"  {i}. {m}")
    print("\nStill to do by judgement (see references/audit.md): occurrence,")
    print("completeness, presentation, materiality, and the opinion.")
    return 1 if findings else 0


if __name__ == "__main__":
    sys.exit(main())
