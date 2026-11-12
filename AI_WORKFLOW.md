# AI workflow note

## What I used

- **Claude (Anthropic)** as my main coding agent. It ran in a sandboxed workspace, and I worked with it from the Claude in Chrome side panel. I gave it the assignment brief and asked it to plan first: map every requirement to a concrete feature before writing any code. Then it built the app, wrote the tests and drafted the docs, while I made the product and scope calls.
- **Playwright (headless Chrome)** for an end-to-end check of the real UI, plus the screenshots and the walkthrough recording.
- **Render** for deployment.

## Where AI actually saved time

- **Boilerplate.** Express routes, the SQLite schema, React components and CSS took minutes instead of hours. That time went into the parts that matter for this brief: access control, the save behavior and testing.
- **Library details.** TipTap v3 changed a few things from earlier versions: StarterKit now includes Underline, and toolbar active states need `shouldRerenderOnTransaction`. The AI caught these quickly, and I didn't have to dig through changelogs.
- **Turning rules into tests.** I described the sharing rules (owner / editor / viewer / no access / revoke), and they became one readable test that proves the server enforces them, not just the UI.

## What I changed or rejected

- **An extra package.** The first install added `@tiptap/extension-underline`, but StarterKit already includes it, so it was removed to avoid registering the same extension twice.
- **A real bug in the first version.** After loading a document, the editor called `setEditable(...)`. In TipTap v3 that fires an update event by default, so just *opening* a doc triggered an autosave. For a viewer, that meant a 403 on every open, and signing out quickly gave a 401. Nobody would notice this by clicking around, but the browser test logs every failed request, and it showed up there. The fix: suppress that event, ignore updates while the editor is read-only, and save pending edits *before* clearing the session on sign-out. After the fix, the only failed request left in the run is the intentional ".png not supported" upload.
- **Scope.** I didn't let it build "everything Google Docs has". I cut real-time co-editing, comments, attachments and sign-up on purpose, and kept depth on editing, sharing and import. The reasons are in ARCHITECTURE.md.
- **Deployment.** The first plan was a Render Blueprint (`render.yaml`), but Blueprints ask for a card. I switched to a normal free Web Service with the same build and start commands, and documented that in the README.

## How I checked it works

1. **Automated tests** (`npm test`, 7 passing): login, create, edit and reopen with formatting preserved, title validation, XSS stripping, every sharing role including revoke, bad share targets, .md import, and rejected file types.
2. **A full browser run of the production build:** log in → create a doc → heading, bold, underline, bullets → wait for "All changes saved" → reload and confirm the formatting is still there → share with Bob as an editor → log in as Bob → confirm the viewer doc is read-only and the shared doc is editable → import a .md file → try a .png and get a clear error.
3. **Manual checks:** .docx import keeps headings and bold, data survives a server restart, and the live Render URL loads and serves the seeded demo data.
