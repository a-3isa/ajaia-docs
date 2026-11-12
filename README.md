# Ajaia Docs: a lightweight collaborative document editor

A small full-stack document editor loosely inspired by Google Docs. You can create, edit and format documents, import files, and share documents with other users as a viewer or an editor.

**Live demo:** `<add your Render URL here>`
**Demo accounts** (password for all: `demo1234`). The login screen also has one-click buttons for each.

| User | Email | Seeded data |
|---|---|---|
| Alice Owner | `alice@ajaia.test` | Owns "Welcome to Ajaia Docs", shared with Bob as a viewer |
| Bob Reviewer | `bob@ajaia.test` | Sees the welcome doc under **Shared with me** (view-only) |
| Carol Editor | `carol@ajaia.test` | Starts with no docs. Use her to test editor access. |

## Features

- **Documents:** create, rename (click the title), edit in a rich-text editor, autosave (0.8 s debounce, with a "Saving… / All changes saved / Save failed + Retry" indicator), and reopen.
- **Formatting:** bold, italic, underline, strikethrough, Normal/H1/H2/H3, bulleted and numbered lists, quote, undo/redo. Keyboard shortcuts work (Ctrl/Cmd+B/I/U).
- **File import:** upload a **`.txt`, `.md` or `.docx`** file (max 5 MB) and it becomes a new editable document. Headings, bold/italic and lists carry over. Any other file type is rejected with a clear message. Sample files are in [`samples/`](samples).
- **Sharing:** every document has one **owner**. The owner shares by email as a **Viewer** (read-only) or an **Editor** (can edit), and can change roles or revoke access. The home screen splits **My documents** from **Shared with me**, with role badges.
- **Persistence:** SQLite stores users, sessions, documents and shares. Content is stored as sanitized HTML, so formatting survives a refresh or a server restart.
- **Stretch:** role-based permissions (viewer/editor) and **Export to Markdown**.

## Run locally

Requirements: Node.js 20+ (22 recommended).

```bash
npm install
npm run build      # builds the React frontend into dist/
npm start          # serves API + frontend on http://localhost:3000
```

For development with hot reload, run `npm run dev`. The API runs on :3000 and Vite on http://localhost:5173, which proxies `/api` to the API.

Run the tests with `npm test`.

The database is created automatically at `data/app.db` and seeded with the demo users. Set `DB_FILE=/path/to.db` to use a different location. Delete `data/` to reset everything.

## Deploy (Render free tier)

The repo includes a `render.yaml` blueprint.

1. Push this repo to GitHub.
2. On https://render.com, choose **New > Blueprint** and select the repo. Or create a **Web Service** with build command `npm ci --include=dev && npm run build` and start command `npm start`.
3. Open the URL Render gives you. The demo users are seeded on startup.

> **Free-tier note:** Render's free instances have an ephemeral filesystem, so the SQLite file is reset when the service redeploys or restarts after idling. The seeded demo data always comes back. Within a session, documents and shares persist across refreshes, logins and users. For durable hosting, attach a Render persistent disk and set `DB_FILE` to a path on it, or swap the storage layer for Postgres (see ARCHITECTURE.md).

## Project layout

```
server/        Express API (app.js), SQLite schema + seed (db.js), entry (index.js)
client/src/    React app: Login, DocList, Editor (TipTap), ShareDialog, api helper
test/          API tests (Vitest + Supertest)
samples/       Example .md / .txt / .docx files for the import feature
screenshots/   UI screenshots
```

## API overview

All routes except `POST /api/login` require `Authorization: Bearer <token>`.

| Method | Path | Access |
|---|---|---|
| POST | `/api/login`, `/api/logout` | public / signed in |
| GET | `/api/documents` | own + shared lists |
| POST | `/api/documents` | create |
| GET / PATCH / DELETE | `/api/documents/:id` | viewer / editor / owner |
| GET / POST | `/api/documents/:id/shares` | viewer / owner |
| DELETE | `/api/documents/:id/shares/:userId` | owner |
| POST | `/api/import` (multipart `file`) | creates a new doc |

## What's incomplete / next 2–4 hours

- **Working:** everything listed under Features, end to end, plus the tests.
- **Not built (deliberately):** real-time co-editing, comments, version history, password reset/sign-up, PDF export. If two people edit the same doc at once, the last save wins.
- **Next:** (1) optimistic-concurrency check using `updated_at`, so a stale save is rejected instead of overwriting; (2) simple version history (a snapshot table written on save, capped per doc); (3) presence indicators via polling or SSE; (4) Postgres plus a persistent host for durable demo data.
