---
name: linkedin-blog
description: Writes a ready-to-post LinkedIn mini-blog in the user's own voice, built around three real stories, news items or developments from the past week that matter to their specific audience. Use this whenever the user types "LINKEDIN BLOG" in any casing, and also whenever they ask for a LinkedIn post, a weekly LinkedIn update, a post about what happened this week, content for their followers, or say things like "write me something for LinkedIn" or "I need a post for this week" - even when they never say the trigger phrase. Also use it when they hand over an existing LinkedIn draft and want it reworked so it reads as human-written rather than AI-generated.
---

# LinkedIn mini-blog

Produce one LinkedIn post: a short blog, not a news roundup and not a one-liner. Three real things that happened in the past week, tied together by a point of view the reader could disagree with, written so that nobody reading it thinks "an AI wrote this."

Two things make or break the output, and both are easy to get wrong:

**The reader must not smell a machine.** LinkedIn is saturated with AI-written posts and its audience has become very good at spotting them. A post that trips the usual tells costs the user credibility, which is worse than posting nothing. `references/human-voice.md` is the single most important file in this skill. Read it before drafting, every time.

**The facts must be real.** The user's name goes on this. Never invent a statistic, a company announcement, a client anecdote, a conversation, or an opinion the user has not expressed. Everything factual traces back to a source you actually opened.

## Step 0 - Load the profile

Read these three files before anything else:

- `profile/audience.md` - who the user writes for, what they care about, which topics are in and out of scope
- `profile/voice-profile.md` - the distilled fingerprint of how the user writes
- `profile/past-posts.md` - the raw sample posts the fingerprint came from

If any of them still carries the `STATUS: NOT CALIBRATED` marker, stop and ask the user for what's missing before writing anything. Specifically: 5 or more of their recent LinkedIn posts pasted in full (more is better, and recent beats old), plus a couple of sentences on who follows them and what they want those people to think. Guessing here produces a post in a generic LinkedIn voice, which is exactly the failure mode this skill exists to prevent.

Once the user provides samples, write them verbatim into `profile/past-posts.md`, then derive the fingerprint into `profile/voice-profile.md` using the procedure in `references/human-voice.md` under "Building the voice fingerprint", and remove the `STATUS` markers. This is a one-time cost that every future post benefits from.

Whenever the user gives feedback on a draft ("too formal", "I'd never use that word", "I always end with a question"), fold it back into `profile/voice-profile.md` so the correction sticks. A skill that has to be corrected the same way twice is a skill that isn't learning.

## Step 1 - Research the week

"This week" means the seven days ending today. Get today's date from the system rather than assuming it.

Search for candidate items using the topics and sources listed in `profile/audience.md`. Cast wider than the obvious headlines: regulation and rule changes, a notable company result or failure, a product or platform shift, a research finding or data release, a shift in what practitioners are actually doing. Read `references/research.md` for how to search, what counts as a usable item, and how to verify.

Open every source before using it. Search snippets misdate things, compress numbers, and sometimes describe articles that say something different. An item is usable only when you have read the piece and can state its publication date, the outlet, and one concrete fact from it.

Aim to surface eight to twelve candidates before narrowing. Choosing three out of four is how the post ends up covering something the audience doesn't care about.

## Step 2 - Pick three and find the throughline

Three items, each of which the audience would plausibly not have seen, and each carrying a concrete detail worth repeating - a number, a name, a date, a decision.

The throughline is what makes this a mini-blog instead of a bulletin. Ask what these three items say when placed next to each other, and whether that is a claim someone could reasonably argue with. "Three interesting things happened in fintech" is not a throughline. "Regulators are moving faster than the products they're regulating, and this week gave three examples of the gap" is.

If the three best items genuinely have nothing in common, that is fine and worth saying plainly in the post rather than manufacturing a false connection. Forced synthesis reads as insincere, which is one of the ways AI writing gives itself away.

## Step 3 - Draft

Read `references/human-voice.md` and `references/post-craft.md`, then write.

Length comes from `profile/voice-profile.md`, which records the range the user actually writes in. Use that. Where the profile gives no figure, 1,300 to 2,100 characters is a reasonable default - long enough that each item gets a real thought rather than a headline, short enough that a reader on a phone finishes it. LinkedIn hard-caps at 3,000 characters; never approach that.

Match the fingerprint on the things a reader actually registers: sentence rhythm, paragraph shape, section headers, how lists are formatted, level of formality and jargon, how they open, how they close, whether they use emoji or hashtags at all.

**When the fingerprint and `references/human-voice.md` disagree, the fingerprint wins, every time.** That file catalogues habits that commonly signal machine-written text, but plenty of real people write with em dashes, emoji headers, tidy lists and a closing question. If those appear in the samples, they are this person's voice and removing them makes the post less authentic, not more. The failure to guard against is not "the post broke a style rule" - it is "this doesn't sound like me." Apply `human-voice.md` only where the samples are silent.

Where the post would be stronger with something only the user knows - what they saw in their own work this week, a client situation, their real position on a contested point - do not invent it. Write the post so it stands without it, and flag the opportunity in the "Before you post" note.

## Step 4 - Edit like it's going out under your own name

Run the checklist at the end of `references/human-voice.md` against the draft. Most first drafts fail two or three items on it, so expect to rewrite rather than tidy.

Then read the post beside two or three of the samples in `profile/past-posts.md`. If a stranger could tell which one was written by a different author, keep working. The most common giveaway is that the drafted post is tidier and more balanced than the user's real writing - real posts have uneven paragraphs, a favourite construction used twice, and an opinion that isn't hedged on both sides.

Count characters before delivering.

## Step 5 - Deliver

Output exactly this shape, so the post can be copied without editing:

```
=== POST ===
[the post text, plain, no markdown formatting - LinkedIn renders none of it]
=== END POST ===

Length: [N] characters

Sources
1. [Headline] - [Outlet], [date] - [URL]
2. ...
3. ...

Before you post
- [anything the user should check, add, or decide - or "nothing, this is ready" if so]
```

Keep URLs out of the post body. LinkedIn suppresses reach on posts with outbound links, so sources go under the post for the user's reference and, if they want them public, in the first comment. Say so in the "Before you post" note when the sources are worth linking.

Never present the post as an artifact, a document, or a file. It gets pasted into a text box, so plain text in the conversation is the useful form.

## Reference files

- `references/human-voice.md` - how AI writing gives itself away and how to write like a person. Read before every draft.
- `references/research.md` - finding, dating, and verifying the week's three items.
- `references/post-craft.md` - hook, structure, length, and LinkedIn's mechanics.
