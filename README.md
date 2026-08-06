# eonoe.github.io

Main page for **Tech Lead 2.0** — a self-guided course on building with coding agents. Served at <https://eonoe.github.io/>.

It is one static HTML file, `index.html`. No framework, no build step. The only external dependency is Google Fonts, loaded over HTTPS.

The free **Coding Agents 101** workshop pages live in a separate repo, [eonoe/ai-tech-lead](https://github.com/eonoe/ai-tech-lead), and are served under <https://eonoe.github.io/ai-tech-lead/d/>. The workshop links on this page are path-absolute (`/ai-tech-lead/d/dayevent.html`) for that reason — keep them absolute when editing.

## Run it locally

Open `index.html` in a browser. The workshop links will 404 unless you serve both repos together — see the ai-tech-lead README.

## Editing

Everything lives in `index.html`. Three sections are rendered from small JavaScript arrays near the bottom of the file:

- `phases` — the seven phases (number, tag, name, the learning, what you apply, what you ship)
- `fits` — the "Is this for you?" list
- `faqs` — the FAQ

Those strings use single quotes, so avoid apostrophes inside them or the script will break. Use "do not" instead of "don't", and so on.

Pages redeploys from `master` on its own after a push.
