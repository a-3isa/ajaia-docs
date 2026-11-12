# Architecture note

## Shape

```
Browser (React + TipTap) ──fetch /api──▶ Express (Node) ──▶ SQLite (better-sqlite3)
            ▲                                │
            └───── static dist/ ◀────────────┘   (one process, one deploy)
```

A **single Node service** serves both the API and the built frontend. I chose this to keep deployment to one free web service with no CORS, no separate frontend host and no paid database. It is the simplest setup reviewers can run locally with `npm install && npm run build && npm start`.

## Key decisions

| Area | Decision | Why |
|---|---|---|
| Editor | **TipTap (ProseMirror)** with StarterKit | Gives a structured document model, solid keyboard shortcuts, and lists, headings and marks out of the box. Building on `contenteditable` directly would cost the whole timebox. |
| Storage format | **Sanitized HTML** in a `TEXT` column | Round-trips losslessly with TipTap, is human-readable in the DB, and the import converters (mammoth for .docx, marked for .md) produce HTML anyway. TipTap JSON would be stricter but adds a conversion step for import and export. |
| Security of content | `sanitize-html` **server-side** allow-list on every write and import | Documents are shared between users, so stored XSS is the main real risk. The server is the only trust boundary. |
| Persistence | **SQLite** via better-sqlite3 | Zero-config, transactional, real SQL with foreign keys and cascades. The schema is four tables: `users`, `sessions`, `documents`, `document_shares(document_id, user_id, role)`. |
| Auth | Seeded users, bcrypt-hashed passwords, random bearer token stored in `sessions` | The brief allows mocked auth. This is still real enough that access control is enforced server-side per user, not just hidden in the UI. |
| Access control | One `loadDoc(minRole)` middleware ranks `viewer < editor < owner` | All permission logic lives in one place. No access returns **404** rather than 403, so document existence doesn't leak. |
| Saving | Debounced autosave (800 ms), PATCH only the changed fields, flush on navigation, tab close and sign-out, retry on failure | Feels like Docs (no Save button) while keeping writes cheap. Failed saves keep the pending changes so nothing is silently lost. |
| File upload | Import **.txt / .md / .docx into a new document** | It is the most product-relevant option ("bring my existing notes in"), and the result is fully editable rather than an inert attachment. Files are processed in memory (5 MB cap) and never written to disk, so there is no storage to manage. |
| Routing | Tiny hash router | Two screens don't justify a router dependency, and hash URLs work on any static host without rewrite rules. |

## What I prioritized

1. **The core loop working end to end** (create → format → autosave → reopen → share → the other user sees it with the right permissions), because that is what the brief evaluates.
2. **Access control correctness on the server**, covered by automated tests (`test/api.test.js`). The tests cover owner/editor/viewer/no-access, revoke, invalid shares, XSS stripping, import and unsupported file types.
3. **Editing feel**: a sticky toolbar with active states, a page-like canvas, a visible save status, and a view-only mode for viewers.

## Deliberate cuts

- **Real-time collaboration (CRDT/Yjs).** This is the biggest cut. It needs a websocket server and conflict-free document state, and doing it badly is worse than not doing it. The current behavior is last-write-wins. The next step would be an `updated_at` precondition on PATCH.
- **Sign-up, password reset, OAuth.** Seeded accounts cover the review flow.
- **Attachments, images, tables, comments, version history.** All are useful, but none is core to the brief.
- **Durable hosting.** Free hosting with an ephemeral disk. Swapping to Postgres only touches `server/db.js` and the prepared statements in `server/app.js`.

## Testing

- `npm test` runs 7 API tests in Vitest + Supertest against an in-memory SQLite DB.
- A headless-browser pass (Playwright) exercised the full UI flow: login, create, format, autosave, reload persistence, share as editor, sign in as Bob, view-only enforcement, .md import and rejection of a .png. It is how the autosave-on-load bug described in AI_WORKFLOW.md was found.
