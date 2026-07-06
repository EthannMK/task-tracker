# Task Tracker

A small, free, single-page task tracker for Personal / Learning / Company work.
No backend, no build step, no paid hosting. Data lives in your browser
(`localStorage`), with optional Google Calendar sync and JSON export/import
for backup.

## Run it locally

Just open `index.html` in a browser, or serve the folder with any static
server (e.g. `npx serve .`).

## Host it free on GitHub Pages

1. Create a new GitHub repo (public or private — Pages works on both if you
   have GitHub Pro, public repos work on the free plan).
2. Push these files (`index.html`, `style.css`, `app.js`) to the repo's
   default branch.
3. In the repo: **Settings → Pages → Build and deployment → Source: Deploy
   from a branch**, pick `main` / root, save.
4. Your app will be live at `https://<your-username>.github.io/<repo-name>/`.

Note the exact URL — you'll need it in the next step.

## Set up Google Calendar sync (optional, free)

Because this is a static site with no server, Calendar sync uses Google's
client-side OAuth (Google Identity Services). You need your own free OAuth
Client ID:

1. Go to [Google Cloud Console](https://console.cloud.google.com/) and
   create a new project (or reuse one).
2. **APIs & Services → Library** → enable the **Google Calendar API**.
3. **APIs & Services → OAuth consent screen** → choose **External**, fill in
   an app name/email, and under **Test users** add your own Google account
   (this keeps the app in "Testing" mode, which is free and fine for
   personal use — no Google review needed).
4. **APIs & Services → Credentials → Create Credentials → OAuth client ID**
   → Application type: **Web application**.
   - Under **Authorized JavaScript origins**, add your GitHub Pages origin,
     e.g. `https://<your-username>.github.io`.
   - Also add `http://localhost:5000` (or whatever port you use) if you
     want to test locally via a static server.
   - No redirect URI is needed.
5. Copy the generated **Client ID** (ends in `.apps.googleusercontent.com`).
6. In the app, go to **Settings**, paste the Client ID, save, then go to
   **Agenda** and click **Connect Google Calendar**.

Tasks with a due date are created as all-day events on your primary Google
Calendar; editing a task's due date updates the event, deleting the task
deletes the event. This is one-way (task → calendar) — changes made
directly in Google Calendar won't flow back into a task, but Google Calendar
events also show up read-only in the Agenda view for context.

## Features

- Tasks tagged **Personal / Learning / Company / Meeting**, with status
  (to do / doing / done) and priority
- Filter by category, status, and free-text search
- Optional project path/link per task (opens a local folder/file or URL)
- **Meeting** tasks get extra fields — start time, duration, and
  participant emails. These sync to Google Calendar as a real timed
  event with attendees invited (`sendUpdates=all`), instead of an
  all-day placeholder
- Agenda view combining task due dates with upcoming Google Calendar
  events; any Google Calendar event can be pulled in with **+ Add as
  task**, which captures its time, duration, and attendees automatically
- Export/import all tasks as JSON for backup or moving between machines
- Everything else works fully offline with zero setup

## Data & privacy

All task data stays in your browser's `localStorage` — nothing is sent
anywhere except the Google Calendar API calls you explicitly opt into.
Because storage is local to one browser/device, use **Export/Import JSON**
in Settings to move data between machines or back it up.
