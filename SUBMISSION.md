# Submission: AI-Native Full Stack Developer Assignment

**Candidate:** Ahmed Ibrahim Hussein Eisa
**Live product URL:** `<add your Render URL here>`
**Walkthrough video:** see `VIDEO_URL.txt`
**Demo accounts:** `alice@ajaia.test`, `bob@ajaia.test`, `carol@ajaia.test`. Password: `demo1234` (one-click buttons are on the login screen).

## Included

| Item | Location |
|---|---|
| Source code | `server/`, `client/`, `test/`, `package.json`, `vite.config.js`, `render.yaml` |
| Setup and run instructions | `README.md` |
| Architecture note | `ARCHITECTURE.md` |
| AI workflow note | `AI_WORKFLOW.md` |
| This file | `SUBMISSION.md` |
| Walkthrough video link | `VIDEO_URL.txt` |
| Screenshots | `screenshots/` (login, document list, editor, share dialog, shared-with-me view, view-only mode) |
| Sample import files | `samples/` (`.md`, `.txt`, `.docx`) |
| Automated tests | `test/api.test.js` (run with `npm test`) |

## Status

- **Working end to end:** login with seeded users; create, rename, edit and autosave documents; rich-text formatting (bold, italic, underline, strikethrough, headings, bulleted/numbered lists, quote); reopening with formatting preserved; .txt/.md/.docx import into a new document; sharing by email with viewer/editor roles, role changes and revoke; separate owned vs shared lists; view-only enforcement (UI and server); Markdown export.
- **Incomplete / intentionally cut:** real-time co-editing (last write wins), comments, version history, sign-up, durable storage on the free host (resets on redeploy).
- **Next 2–4 hours:** stale-write protection via `updated_at`, version history snapshots, presence indicators, and moving to Postgres with persistent hosting.
