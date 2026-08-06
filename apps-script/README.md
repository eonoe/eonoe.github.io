# Signup capture — setup

Email capture for the three pages of this site, backed by a Google Sheet. No server, no
database, no third-party form service. `Code.gs` in this folder is the source of truth for
what's deployed; the deployment itself lives in your Google account.

## One-time setup

**1. Create the Sheet**

New Google Sheet, name it whatever you like (e.g. "Coding Agents 101 — signups"). The
script creates the `signups` tab and its header row on the first submission, so there is
nothing to set up by hand.

Copy the sheet id out of the URL:

```
https://docs.google.com/spreadsheets/d/<THIS_PART_IS_THE_SHEET_ID>/edit
```

**2. Create the Apps Script**

In the Sheet: **Extensions → Apps Script**. Delete the placeholder `myFunction`, paste the
entire contents of [`Code.gs`](Code.gs), and set `SHEET_ID` at the top to the id you copied.
Save.

**3. Deploy it**

**Deploy → New deployment → Web app**:

| Setting | Value |
| --- | --- |
| Execute as | **Me** |
| Who has access | **Anyone** |

"Anyone" is required — visitors are not signed in to Google. Authorize when prompted; it
asks for Sheets access and permission to send mail as you. The "unverified app" warning is
expected for your own script: **Advanced → Go to (project) → Allow**.

Copy the **Web app URL**. It ends in `/exec`.

**4. Paste the URL into the pages**

Replace `PASTE_YOUR_APPS_SCRIPT_EXEC_URL_HERE` in all three:

- `index.html` — the workshop landing page
- `es.html` — its Spanish version
- `course/index.html` — the Tech Lead 2.0 waitlist

```bash
grep -rn PASTE_YOUR_APPS_SCRIPT_EXEC_URL_HERE ..
```

**5. Check it**

Open the `/exec` URL in a browser. You should see `{"ok":true,"ping":true}`.

## Changing the script later

Editing `Code.gs` in the Apps Script editor is not enough — the web app keeps serving the
old version. You must go to **Deploy → Manage deployments → (pencil icon) → Version: New
version → Deploy**. The `/exec` URL stays the same.

Keep this repo's `Code.gs` in sync when you edit it there.

## What lands in the Sheet

| Column | Notes |
| --- | --- |
| `timestamp` | server-side, not client clock |
| `email` | trimmed, lowercased |
| `source` | `workshop` (`/` and `/es.html`) or `techlead2` (the `/course/` waitlist) |
| `lang` | `en` / `es` |
| `page` | pathname the signup came from |
| `referrer` | `document.referrer`, blank on direct visits |
| `utm` | full query string, so `?utm_source=...` is preserved |
| `user_agent` | |
| `confirmed` | `yes`, `quota` (daily mail limit hit), or `failed` |

Signups are deduped on **(email, source)** — the same person can join the workshop and the
Tech Lead 2.0 waitlist, but can't create two rows for the same one. A duplicate submission
returns success to the visitor and writes nothing.

## Confirmation emails

Sent by `MailApp` from your own Gmail. Four variants: workshop and waitlist, each in EN and
ES. Copy lives in the `CONFIRMATION` and `WAITLIST` objects at the bottom of `Code.gs`.

A consumer Gmail account allows ~100 recipients/day (Workspace: ~1,500). When the quota is
gone the row is still written and `confirmed` reads `quota`, so you can filter that column
and follow up by hand. Set `SEND_CONFIRMATION = false` to log without emailing.

## Notes

- The `/exec` URL is public in the page source. Anyone can POST to it. A honeypot field,
  server-side validation, and dedupe keep the blast radius at junk rows. If it ever gets
  abused, add a shared secret to the payload and check it in `doPost`.
- Requests are sent as `Content-Type: text/plain;charset=utf-8` on purpose. That makes them
  "simple" requests, so the browser skips the CORS preflight that Apps Script cannot
  answer. Do not change it to `application/json` — every submission will fail.
- Apps Script execution logs (failed sends, quota warnings) are under **Executions** in the
  script editor.
