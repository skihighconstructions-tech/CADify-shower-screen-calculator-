# CADify — Architecture & Build Spec (v1 prototype)

CADify ties your existing standalone calculators, a client filing system, a job
scheduler, live weather, and NSW compliance rules into one mobile-first app.

## 1. How it fits together

```
                 ┌─────────────────────────────────────────┐
                 │           CADify.html  (the hub)          │
                 │  Dashboard · Clients · Calc menu ·        │
                 │  Schedule · NSW Compliance                │
                 └───────────────┬───────────────────────────┘
                                 │  reads/writes
                     ┌───────────▼───────────┐
                     │  Client-folder store   │   key: "cadify.v1"
                     │  (localStorage + safe  │   { clients[], jobs[],
                     │   in-memory fallback)  │     settings, activity[] }
                     └───────────▲───────────┘
                                 │  CADify.file({...})
      ┌──────────────┬───────────┴───────────┬──────────────┐
      │ Pool Fence   │ Shower Screen         │ Balustrade   │ Illustrating
      │ (built-in    │ (your HTML +          │ (your HTML)  │ / Quote
      │  sample)     │  cadify-bridge.js)    │              │ (your HTML)
      └──────────────┴───────────────────────┴──────────────┘
```

Every calculator writes into the **same client folder** the dashboard reads,
so results, jobs and compliance flags all roll up per client.

## 2. Data model (`cadify.v1`)

```js
{
  clients: [{
    id, name, phone, email, address, suburb, postcode,
    lat, lon, geohash,          // geohash cached after first BOM lookup
    createdAt,
    results: [{                 // ← calculators file here
      id, module, icon, title, summary,
      compliance: 'pass'|'fail'|undefined,
      issues: [...], data: {...}, createdAt
    }]
  }],
  jobs: [{
    id, clientId, title, type:'outdoor'|'indoor',
    date:'YYYY-MM-DD', location,
    weather: { risk, chance, rainMax, label, source, checkedAt }
  }],
  settings: { activeClientId },
  activity: [{ text, at }]
}
```

## 3. Calculator integration contract

Two ways to plug each existing calculator in:

**A. Embedded (recommended for the final app).** Paste your calculator's HTML
into the hub as a module. Because it shares the page, it can call `App.fileResult({...})`
directly. This is rock-solid on mobile and needs no server.

**B. Standalone file + bridge.** Keep the calculator as its own HTML file, add
two lines, and it files into the same folder (works when both files are served
from the same origin — same folder on a web host):

```html
<script src="cadify-bridge.js"></script>
<script>
  // after your calculator computes a result:
  CADify.file({
    module: 'Shower Screen',
    title:  'Frameless screen — ensuite',
    summary:'10mm toughened · 900 x 2000',
    compliance: 'pass',            // optional: 'pass' | 'fail'
    issues: [],                    // optional
    data:   { width:900, height:2000 }
  });
</script>
```

`CADify.clients()`, `CADify.activeClient()` and `CADify.setActiveClient(id)`
are also available so a standalone calc can show its own client picker.

## 4. Bureau of Meteorology hook

- Location search: `GET https://api.weather.bom.gov.au/v1/locations?search={suburb|postcode|lat,lon}` → `data[0].geohash`
- Daily forecast: `GET https://api.weather.bom.gov.au/v1/locations/{geohash}/forecasts/daily`
- Rain risk read from `rain.chance` (%) and `rain.amount.max` (mm). CADify flags a job when `chance ≥ 50%` or `rainMax ≥ 1 mm`.
- The BOM endpoint sends no CORS headers, so a raw browser call is blocked off
  its own domain. CADify tries direct → public CORS proxy → and finally shows a
  clearly-labelled **demo** forecast so the flow always works. For production,
  host CADify on your own domain and add a tiny proxy (or a Cloudflare Worker)
  so the real forecast comes through cleanly.

## 5. NSW compliance reference (built in)

- **Pool fence** (Swimming Pools Act 1992 / AS 1926.1): ≥1200mm barrier, ≤100mm gap under, ≤100mm bar gaps, 900mm non-climbable zone, self-closing/self-latching gate opening away, latch ≥1500mm, CPR sign, pool register + Certificate of Compliance.
- **Balustrade** (NCC / AS 1170.1, glass AS 1288): required over 1m fall, ≥1000mm high, ≤125mm openings, no climbable elements 150–760mm below rail for falls >4m.
- **Shower screen** (AS 1288): Grade A safety glass (toughened/laminated), marked panes, ~10mm toughened for frameless.

These are quick-reference summaries — always confirm the current AS/NCC edition
and council requirements before certifying.

## 6. Roadmap (post-prototype)

1. Embed your four real calculators (send the HTML — Pool Fence sample shows the pattern).
2. Live BOM via a small proxy on your domain.
3. Auto-run compliance from calculator inputs (Balustrade & Shower Screen like Pool Fence already does).
4. PDF export of a client folder (quote + compliance certificate).
5. Optional: multi-device sync (swap the localStorage layer for a hosted DB) and PWA install so it runs like a native app.
