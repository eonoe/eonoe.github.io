# eonoe.github.io

The whole site. Static HTML, no framework and no build step. The only external dependency is Google Fonts, loaded over HTTPS.

| File | Live URL | What it is |
|---|---|---|
| `index.html` | <https://eonoe.github.io/> | **Coding Agents 101** — the free live workshop. This is the landing page. |
| `es.html` | <https://eonoe.github.io/es.html> | Same workshop page, Spanish |
| `course/index.html` | <https://eonoe.github.io/course/> | **Tech Lead 2.0 — Founding Spanish Cohort**, the paid enrollment page (English) |
| `course/es.html` | <https://eonoe.github.io/course/es.html> | Same enrollment page, Spanish. The link for DMs and LinkedIn |
| `guides/intro-coding-agents/index.html` | <https://eonoe.github.io/guides/intro-coding-agents/> | **Guides** — long-form pieces, one folder each. This is the first one |
| `guides/intro-coding-agents/es.html` | <https://eonoe.github.io/guides/intro-coding-agents/es.html> | Same guide, Spanish |
| `guides/index.html` | <https://eonoe.github.io/guides/> | redirect stub to the Guides section on the landing page |
| `apps-script/Code.gs` | — | the Google Apps Script web app that receives signups |

The workshop page is the front door; the course page is where people go when they want the deep track. All three post signups to the same Google Apps Script endpoint — its source is `apps-script/Code.gs`, with setup notes in [`apps-script/README.md`](apps-script/README.md). The script is deployed from your Google account, not from this repo.

[eonoe/ai-tech-lead](https://github.com/eonoe/ai-tech-lead) served these pages until they moved here. It now holds only redirect stubs so the old URLs still work.

Internal links between the pages are path-absolute (`/course/`, `/#get`), so they only resolve correctly when served from a web root — not over `file://`.

## Founding cohort page: what to edit

Both `course/index.html` and `course/es.html` carry the same constants near the bottom of the script. Edit them in **both** files:

- `PAYPAL_URL` — replace `{{PAYPAL_LINK}}`. Buttons do nothing until you do.
- `SEATS_LEFT` — lower by hand as seats sell. The seat bar and "N of 12 left" follow it.
- `DEADLINE` — enrollment close. After it, or at 0 seats, the page swaps the pay button for the list signup.
- `{{KICKOFF_DATE}}` appears in the perks section and the FAQ of both files.

Share links per channel: `?utm_source=dm`, `?utm_source=linkedin`, `?utm_source=workshop`.

## Run it locally

```bash
python3 -m http.server 8765
```

Then open <http://localhost:8765/>.

## Editing

`course/index.html` renders three of its sections from small JavaScript arrays near the bottom of the file:

- `phases` — the seven phases (number, tag, name, the learning, what you apply, what you ship)
- `fits` — the "Is this for you?" list
- `faqs` — the FAQ

Those strings use single quotes, so avoid apostrophes inside them or the script will break. Use "do not" instead of "don't", and so on.

## Adding a guide

Each guide is a self-contained page in its own folder under `guides/`, with its own inline `<style>` — they are articles, not landing pages, so they do not share the landing CSS. To publish one:

1. Create `guides/<slug>/index.html` (English) and `guides/<slug>/es.html` (Spanish). `guides/intro-coding-agents/` is the template: sidebar index with EN/ES toggle, tiered sections, "Example" callouts, footnotes. Like the landing, `index.html` redirects to `es.html` for Spanish browsers and `es.html` never redirects.
2. Add a card to the `#guides` section in **both** landing files: the English card links to `/guides/<slug>/`, the Spanish one to `/guides/<slug>/es.html`.

The workshop date appears both in the countdown target in `index.html` and in copy on `course/index.html` — keep the two in sync when a session moves. `es.html` is a hand-maintained translation of `index.html`; changes to one usually need porting to the other.

## Deploy

GitHub Pages builds from `master` at the repo root and redeploys on its own after a merge.
