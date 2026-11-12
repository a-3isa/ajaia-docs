# Submission: AI-Native Full Stack Developer Assignment

**Candidate:** Ahmed Ibrahim Hussein Eisa
**Live product URL:** https://ajaia-docs-mhb9.onrender.com
**Source code (GitHub):** https://github.com/a-3isa/ajaia-docs
**Walkthrough video:** https://drive.google.com/file/d/11zehJDYmB6-T18vabjFeCW23oM6Zc-n6/view?usp=sharing (also in `VIDEO_URL.txt` and as `ajaia-docs-walkthrough.mp4` in the Drive folder)
**Google Drive folder:** https://drive.google.com/drive/folders/1RHB6ZvTMGhzWA21rK73PBFRAFauUGhTR
**Demo accounts:** `alice@ajaia.test`, `bob@ajaia.test`, `carol@ajaia.test`. Password: `demo1234` (one-click buttons are on the login screen).

## Included

| Item | Location |
|---|---|
| Source code | `ajaia-docs-source.zip` in the Drive folder (`server/`, `client/`, `test/`, `package.json`, `vite.config.js`, `render.yaml`). Also on GitHub. |
| Setup and run instructions | `README.md` |
| Architecture note | `ARCHITECTURE.md` |
| AI workflow note | `AI_WORKFLOW.md` |
| This file | `SUBMISSION.md` |
| Walkthrough video | `VIDEO_URL.txt` (link) + `ajaia-docs-walkthrough.mp4` (captioned screen recording, 3:42) |
| Screenshots | `screenshots/` (login, document list, editor, share dialog, shared-with-me view, view-only mode) |
| Sample import files | `samples/` (`.md`, `.txt`, `.docx`) |
| Automated tests | `test/api.test.js` (run with `npm test`) + `test/e2e_ui.py` (Playwright UI run) |

## Status

- **Working end to end:** login with seeded users; create, rename, edit and autosave documents; rich-text formatting (bold, italic, underline, strikethrough, headings, bulleted/numbered lists, quote); reopening with formatting preserved; .txt/.md/.docx import into a new document; sharing by email with viewer/editor roles, role changes and revoke; separate owned vs shared lists; view-only enforcement (UI and server); Markdown export.
- **Incomplete / intentionally cut:** real-time co-editing (last write wins), comments, version history, sign-up, durable storage on the free host (resets on redeploy).
- **Next 2–4 hours:** stale-write protection via `updated_at`, version history snapshots, presence indicators, and moving to Postgres with persistent hosting.
