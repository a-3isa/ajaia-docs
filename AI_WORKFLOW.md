# AI workflow note

## Tools used

- **Claude (Anthropic)**, running as an agent in a sandboxed Linux workspace (via the Claude in Chrome side panel). I used it to read the brief, propose a requirements-to-implementation plan, scaffold the project, write the code and tests, run a headless browser for end-to-end checks, and draft these docs.
- **Playwright (headless Chrome)**, driven by the AI, for UI verification and screenshots.

## Where AI materially sped things up

- **Scaffolding and boilerplate:** the Express routes, SQLite schema, React components and CSS were produced in minutes instead of hours, which left time for access-control tests and polish.
- **Library specifics:** TipTap v3 API details (the StarterKit now bundles Underline and Link; `shouldRerenderOnTransaction` is needed for toolbar active states), plus mammoth/marked for import.
- **Test writing:** turning the sharing rules into a single readable access-control test.

## What was changed or rejected

- **Rejected an extra dependency.** The first install added `@tiptap/extension-underline`. TipTap v3's StarterKit already includes Underline, so registering both would duplicate the extension. It was removed.
- **Fixed an AI-introduced bug found by E2E testing.** The first version of the editor called `editor.setEditable(...)` after loading a document. In TipTap v3 that emits an update event by default, so *just opening* a doc queued an autosave. For viewers this produced a 403 on every open, and signing out quickly produced a 401. The browser test surfaced these as unexpected 4xx responses. Fix: `setEditable(role !== 'viewer', false)`, ignore updates while the editor is read-only, and flush pending saves *before* clearing the session on sign-out.
- **Scope choices made deliberately rather than accepting "build everything":** no real-time co-editing, no attachments, and a hash router instead of React Router. The reasons are in ARCHITECTURE.md.
- **Security review:** I made sure sanitization happens on the server (not only in the editor), and that no access returns 404 rather than 403.

## How correctness was verified

1. **Automated API tests** (`npm test`, 7 passing): auth, CRUD and formatting round-trip, title validation, XSS stripping, owner/editor/viewer/no-access rules, revoke, invalid share targets, .md import and unsupported type rejection.
2. **Headless browser run of the real UI** against a production build: create → format (H1, bold, underline, bullets) → "All changes saved" → reload and confirm the HTML persisted → share with Bob as editor → sign in as Bob → confirm the viewer doc is read-only (`contenteditable=false`) and the editor doc is editable → import .md → upload .png and get the expected error. Every non-2xx response was logged, and the run was repeated after the fix until the only one left was the intentional .png rejection.
3. **Manual checks:** a .docx import via curl (headings and bold preserved), data surviving a server restart, and a visual review of the screenshots.
