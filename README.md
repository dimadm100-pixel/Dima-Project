# Tama・Dilmurod 🧸

A little virtual pet website, made by Dilmurod for Zubayda. The pet is modeled
on Dilmurod himself — she can feed him, play with him, put him to sleep,
dress him up, decorate his room, and unlock little memories/items by
completing quests. If she doesn't visit for a while, he lets her know he's
feeling neglected.

It's a single static page (`index.html`) — no build step, no server, no
account required to use it. All progress is saved locally in the visitor's
own browser (`localStorage`), so nothing is uploaded anywhere.

## Making it public on a phone with no setup

This repo includes `.github/workflows/pages.yml`, which auto-deploys the
site to **GitHub Pages** on every push to `main`. One-time setup (takes ~30
seconds):

1. Go to the repo on GitHub → **Settings → Pages**.
2. Under "Build and deployment", set **Source** to **GitHub Actions**.
3. Push (or re-run the "Deploy site to GitHub Pages" workflow under the
   **Actions** tab). The URL will appear at
   **Settings → Pages** and in the workflow run summary — something like
   `https://<username>.github.io/Dima-Project/`.
4. Send that link to Zubayda — it works on any phone browser, no Claude
   account, no app install.

## Personalizing it

Open `index.html` and search for the `CONFIG` object near the top of the
`<script>` tag. Everything there is meant to be edited:

- `memories` — five unlockable notes. The first is filled in; the rest are
  placeholders (`[Dilmurod: write about...]`) — replace them with real
  memories, inside jokes, or a real letter for the last one.
- `quizQuestions` — the "just for fun" quiz questions used as one of the
  quests to earn hearts.
- `outfits`, `accessories`, `decor` — names/emoji/costs for closet and room
  items, if you want to change what's unlockable.
- `neglectTiers` — the escalating "your boyfriend is feeling neglected"
  messages.

No build tools needed — it's plain HTML/CSS/JS, so any edit just needs a
save and a push.
