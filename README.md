# CADify — Complete Source (everything built to date)

This folder is the REAL, exact app — not a description. It contains the actual
calculators, colour scheme, hub, and data layer.

## Deploy / run right now
- **index.html** — the entire app in ONE self-contained file (hub + data layer +
  all three real calculators + brand colours, embedded). Open it in any browser,
  or drag it onto Netlify to host. This is what you deploy.

## Editable multi-file source (the "real" project structure)
- **CADify.html**        — the hub (dashboard, clients, jobs, run recovery, job PDF, scheduler, compliance)
- **cadify-bridge.js**   — the dual-mode data + auth layer (local now, Firebase later)
- **calculators/glass-setout.html**   — Glass balustrade + pool fencing set-out (REAL engine + drawings)
- **calculators/pool-fence.html**     — AS 1926.1 pool fence + gates + compliance (REAL engine)
- **calculators/shower-screen.html**  — Frameless shower screen set-out, DXF/PDF, 12/12 self-tests (REAL engine)
- **manifest.webmanifest**, **sw.js** — PWA (install to home screen, offline)
- **firestore.rules**    — per-account isolation rules for the future Firebase backend

## Rebuilding index.html from the multi-file source
`index.html` is produced by inlining `cadify-bridge.js` and base64-embedding the
three calculators into `CADify.html` (each calculator's bridge include rewired to
`window.parent.CADify`, plus an in-memory localStorage shim). Edit the multi-file
source, then re-run that build step to regenerate the single file.

## Docs
- **CADify-Master-Build-Prompt.md** — full spec + roadmap (regenerates the design/architecture; the calculators here are the real code)
- **CADify-spec.md**, **CADify-calculator-contract.md**, **CADify-firebase-setup.md** — earlier design notes
