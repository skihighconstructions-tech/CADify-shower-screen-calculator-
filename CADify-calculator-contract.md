# CADify — Calculator Integration Contract (v1)

The pattern every calculator follows so all seven (glass / steel / aluminium
balustrade, shower screen, three pool‑fence variants) drop into CADify identically.

## Packaging
- **One self‑contained offline HTML file per calculator** — engine + UI + drawings inline. No split engine/UI.
- **Vanilla JavaScript** (ES5/ES6, IIFE modules). No framework, no TypeScript build, no dependencies. If authored in TS, ship compiled JS.
- Lives in `/calculators/<name>.html` beside `CADify.html`.
- Naming: `calculators/shower-screen.html`, `calculators/glass-balustrade.html`, `calculators/pool-fence-flat.html`, etc.

## Mounting
- The hub loads each calculator in a **same‑origin iframe** — full CSS/JS isolation, shared storage automatically.
- No cross‑file JS globals required; the only contract surface is `window.CADify` (from `cadify-bridge.js`), which the iframe inherits by including the bridge script.

## Drawings
- Raw **SVG strings** are the accepted format — keep as‑is. No component rendering.
- PNG / PDF / JSON export stays in the calculator.
- Optionally pass SVG strings into the folder record (`drawings` field) so they travel with the client file.

## Styling — shared tokens
Reference these CSS custom properties instead of hard‑coded hexes:

```css
:root{
  --concrete-1:#dcd9d1;  /* card face */
  --concrete-2:#c4c0b7;  /* page */
  --concrete-3:#efece5;  /* inset / segment face */
  --paper:#faf8f3;       /* input face */
  --paper-dim:#6b685f;
  --line:#a8a49a;        /* borders */
  --txt:#1b1a17;  --dim:#5f5c53;
  --brand:#141312; --accent:#1a1917; --accent-dim:#000000;  /* black brand */
  --good:#3f7d38;  --warn:#a8471f;  --bad:#a8471f;
  --off-black:#1a1917;
}
```
House signatures: 3–4px corners, uppercase letter‑spaced section headers, black
skeuomorphic primary buttons (paper text), segmented controls for choices.

## State & persistence
- **No own localStorage.** One shared store, key `cadify.v1`.
- Talk to it only through `cadify-bridge.js`:

```js
CADify.clients()            // [{id, name, suburb, ...}]
CADify.activeClient()       // {id, name, ...} | null
CADify.setActiveClient(id)  // change active client
CADify.file(record)         // write a result into the active client's folder → returns record | null
```
- In‑session/unsaved state may stay in memory; persistence goes through `CADify.file`.
- **Same origin required.** Serve the folder or package a **PWA** for offline field use — loose `file://` files do not reliably share storage.

## Canonical result record
Every calculator returns the same shape:

```js
CADify.file({
  module: 'Shower Screen',      // tool name — folder label + tile
  icon:   '🚿',                  // optional emoji
  title:  '90° corner return — ensuite',
  summary:'A 742.5 · B 690.0 · gaps 6.0',   // one line for the folder list
  compliance: 'pass',           // 'pass' | 'fail' | omit when N/A
  issues: [],                   // strings when compliance === 'fail'
  data:   {                     // full structured payload (calculator‑specific)
    config, panels, gaps, glassSchedule, hardwareSchedule
  },
  drawings: {                   // optional SVG strings
    setout: '<svg…>', production: '<svg…>'
  }
});
```

`module` + `compliance` drive the dashboard's "Calculations saved" and
"Compliance flags" counters. `title` + `summary` render in the client folder list.
`data` and `drawings` are stored verbatim for export/reopen.

## Per‑calculator compliance mapping (NSW)
- Shower screen → **AS 1288** (Grade A safety glass, human‑impact glazing).
- Glass balustrade → **NCC / AS 1170.1 + AS 1288**.
- Steel / aluminium balustrade → **NCC / AS 1170.1** (height ≥1000, ≤125 gaps, non‑climbable 150–760).
- Pool fence variants → **AS 1926.1** (≥1200 barrier, ≤100 gaps, 900 NCZ, gate, latch ≥1500, CPR sign).

Emit `compliance: 'pass'|'fail'` + `issues[]` where the standard gives measurable checks.
