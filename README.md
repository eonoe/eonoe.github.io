# eonoe.github.io

The whole site. Static HTML, no framework and no build step. The only external dependency is Google Fonts, loaded over HTTPS.

| File | Live URL | What it is |
|---|---|---|
| `index.html` | <https://eonoe.github.io/> | **Coding Agents 101** — the free live workshop. This is the landing page. |
| `es.html` | <https://eonoe.github.io/es.html> | Same workshop page, Spanish |
| `course/index.html` | <https://eonoe.github.io/course/> | **Tech Lead 2.0** — the deeper, project-based course |
| `apps-script/Code.gs` | — | the Google Apps Script web app that receives signups |

The workshop page is the front door; the course page is where people go when they want the deep track. All three post signups to the same Google Apps Script endpoint — its source is `apps-script/Code.gs`, with setup notes in [`apps-script/README.md`](apps-script/README.md). The script is deployed from your Google account, not from this repo.

[eonoe/ai-tech-lead](https://github.com/eonoe/ai-tech-lead) served these pages until they moved here. It now holds only redirect stubs so the old URLs still work.

Internal links between the pages are path-absolute (`/course/`, `/#get`), so they only resolve correctly when served from a web root — not over `file://`.

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

The workshop date appears both in the countdown target in `index.html` and in copy on `course/index.html` — keep the two in sync when a session moves. `es.html` is a hand-maintained translation of `index.html`; changes to one usually need porting to the other.

## Deploy

GitHub Pages builds from `master` at the repo root and redeploys on its own after a merge.
