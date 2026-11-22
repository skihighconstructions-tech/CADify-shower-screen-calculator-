# CADify — Master Build Prompt

> Hand this whole document to a capable coding assistant. It describes exactly what to build, the constraints, the brand, the architecture, the data model, every feature completed so far, and the roadmap of what's still to do. Build it to match this spec.

---

## 0. Your role

You are building **CADify**, a mobile‑first web app for a glass & fencing trade business in **New South Wales, Australia**. It assembles a set of on‑site "set‑out" calculators (balustrade, pool fencing, frameless shower screens, and more to come) into one app where every calculation is saved into a shared **client → job** filing system, with shop‑drawing exports. The end goal is a **subscription SaaS** with individual customer logins and isolated per‑account data.

Build in plain, dependency‑free web tech (see constraints). Preserve the exact brand system and data model below. Where a calculator's internal maths is provided, keep it byte‑faithful — only add the integration hooks described here.

---

## 1. Product overview

- **Users:** glaziers / fencing installers working on site (often on a phone, sometimes offline).
- **Core loop:** pick/create a client → run a calculator → get a set‑out with shop drawings → **save the run into a job** in that client's folder → later, open the job and export one combined PDF, or reopen any run to recover its drawing and numbers.
- **Region/compliance:** NSW. Pool fencing to **AS 1926.1**, glazing to **AS 1288**, balustrade to **NCC / AS 1170**.
- **Tone/brand:** rugged, on‑site, "concrete and steel" — off‑form concrete grey + true black, light theme for daylight readability. Not a glossy consumer app.

---

## 2. Non‑negotiable technical constraints

1. **No frameworks, no build step, no external dependencies.** Vanilla HTML/CSS/ES5–ES6 JavaScript only. It must run by opening a single file. (Deliberate: offline field use, easy hosting.)
2. **Two delivery formats, same source:**
   - **Multi‑file** (the real hosting structure): `CADify.html` (the hub) + `cadify-bridge.js` (data layer) + `calculators/*.html` (each calculator, self‑contained, mounted in an `<iframe>`), + `manifest.webmanifest` + `sw.js` (PWA).
   - **Single‑file standalone** (`index.html`): the hub with the bridge inlined and each calculator **base64‑embedded and mounted via `iframe.srcdoc`**. This is what gets deployed/handed around so it runs anywhere with no sibling files.
3. **Offline‑first.** Everything works with no network. PWA manifest + service worker for install‑to‑home‑screen.
4. **Must survive locked‑down environments.** Some sandboxes/file:// contexts throw on any `localStorage` access. The bridge and each embedded calculator must **lexically shadow `localStorage` with an in‑memory fallback** (a `try/probe/catch` shim using `let`/`var` at the right scope so it never assigns to `window.localStorage`, which throws when the property is getter‑only). The app must fully boot and function with storage blocked (data just won't persist between sessions).
5. **Mobile‑first**, single column, generous spacing, big tap targets (48px).
6. **Calculators are embedded verbatim.** Each calculator is its own complete HTML app. To integrate it, only: (a) replace its bridge include with a line that points its `window.CADify` at the parent app's bridge, and (b) add the save/capture hooks described in §6. Never rewrite a calculator's calculation or drawing engine.

---

## 3. Brand & design system (apply to hub, all calculators, and all exports)

**Core idea:** off‑form concrete grey + true black. Light theme only (lock it — remove any `prefers-color-scheme: dark` overrides so a phone in dark mode can't flip it). No colour except two functional accents on the drawings.

### App UI palette (exact hex)
| Token | Hex | Use |
|---|---|---|
| Page background | `#c4c0b7` | app background (concrete) |
| Card face | `#dcd9d1` | panels/cards (subtle top‑light gradient) |
| Inset / secondary button face | `#efece5` | input insets, secondary buttons, result boxes |
| Input / canvas surface | `#faf8f3` | text fields, lightest surface |
| Hairline / border | `#a8a49a` | all 1px borders and rules |
| Brand black | `#141312` | wordmark, brand accents |
| Accent / primary / focus | `#1a1917` | primary buttons, active states, focus outline |
| Accent deep | `#000000` | button shadow / gradient bottom |
| Body text | `#1b1a17` | primary ink |
| Secondary text | `#5f5c53` | labels, hints, captions |
| Success | `#3f7d38` | valid/"standard" states |
| Warning | `#a8471f` | warnings/"widened" states |

- Cards use a faint gradient `linear-gradient(180deg, rgba(255,255,255,0.45), rgba(0,0,0,0.02))` over `#dcd9d1`; a subtle 40px vertical pinstripe (`rgba(0,0,0,0.03)`) in the header only.
- Single "concrete grey" where needed: `#98968F`.

### Drawing / PNG‑export palette (exact hex — identical across every calculator)
| Token | Hex | Use |
|---|---|---|
| Sheet background | `#ffffff` | white paper |
| Primary ink | `#111111` | all linework, dims, outlines, text |
| Secondary text | `#54514b` | sub‑labels, notes |
| Extension / witness lines | `#9a9a9a` | thin dimension leaders |
| Glass fill | `#f6f8f9` | pale glass tint inside panels |
| **Gap‑dimension accent** | `#c0521c` | gap dims + datum marker (rust) |
| **Handrail‑bracket accent** | `#1f6f8b` | handrail holes + their dims (teal‑blue) |
| Header/label bands | `#211f1c` | BOM/run label bands |
| Band text | `#f4f2ec` | text on dark bands |

`#c0521c` and `#1f6f8b` are the **only** colours on a drawing — everything else is black on white.

### Typography
- **App UI font:** `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`.
- Sizes: H1 29px/800; card H2 12px/700, .16em, UPPERCASE; field label 12.5px/600; input 16px/400; hint 11.5px; primary button ~15px/800 .03em; secondary button 13.5px/700; stat number 22px/800; stat label 10px/UPPERCASE .08em; table header 10.5px/600 UPPERCASE .08em; tagline 9.5px/600 .18em UPPERCASE.
- **Drawings font:** **Arial** throughout (reliable on canvas). Titles bold 24–26px; section/BOM bands bold 13–16px; dimension values bold 9–12px; notes 10–14px. Keep dimension text bold so it reads zoomed on a phone.

### Components
- **Card:** face `#dcd9d1` + gradient, 1px `#a8a49a` border, radius **4px**; H2 has a 14×2px black tick before it.
- **Input/select:** surface `#faf8f3`, 1px `#a8a49a`, radius **3px**, padding 11×12px, 16px text; focus = 2px solid `#1a1917`, 1px offset.
- **Primary button:** gradient `#1a1917 → #000000`, text `#faf8f3`, radius 3px, weight 800, .03em; shadow `0 3px 0 #000, 0 6px 14px rgba(0,0,0,.28)`; drops 2px on press.
- **Secondary button:** transparent → `#efece5` face, 1px `#a8a49a`, `#1b1a17` text, radius 3px.
- **Tags:** valid `#3f7d38` on `rgba(127,174,106,.18)`; warn `#a8471f` on `rgba(168,71,31,.16)`; radius 2px.
- Radii ladder: cards 4px, everything else 3px, tags 2px. Borders always 1px `#a8a49a`. Flat; one soft shadow (primary button only).

### Logo
- Use the supplied **`cadify_logo.png`** (serif "CADify" wordmark in a black bracket‑frame on a light concrete card, tagline "On‑site Shop Drawings"). Primary logo; don't recolour/stretch. Min width 120px on screen; sits in the drawing title block. If unavailable, use a serif "CADify" wordmark (CAD caps, "ify" lowercase) in a bracket frame as a placeholder. Every export carries the CADify brand on the sheet.

### Export file naming
- Set‑out drawing: `<Job Name> CADify - <Run Label>.png`
- Project BOM: `<Job Name> CADify - Project BOM.png`
- Fallback with no job name: `CADify - <…>.png`

---

## 4. Architecture

### 4.1 The bridge (`cadify-bridge.js`) — one data + auth layer, dual‑mode
A single global `window.CADify` object used by the hub **and** every calculator, so the app never changes when the storage backend is swapped.

- **LOCAL mode (default, today):** `localStorage` + a stub auth (accounts stored locally) + a dev subscription toggle. Cross‑window sync between hub and calculator iframes via the `storage` event. Storage calls are wrapped in the in‑memory‑fallback shim (§2.4).
- **CLOUD mode (future):** Firebase Auth + Firestore + Stripe, enabled by passing a Firebase config to `CADify.init(config)`. Same public API in both modes.

**Public API (must exist in both modes):**
- `init(cfg?)` / `initLocal()`
- `auth.signUp(email,pw,name)`, `auth.signIn`, `auth.signInGoogle`, `auth.reset`, `auth.signOut`, `auth.currentUser()`, `auth.onUser(cb)`
- `subscription()`, `onSub(cb)`, `devSetSubscription(active)` (local only), `startCheckout(priceId)`
- `onData(cb)` — fires with the full mirror on every change
- `clients()`, `settings()`, `activeClient()`, `setActiveClient(id)`, `addClient(data)`, `updateClient(id,data)`, `removeClient(id)`
- `jobs()`, `addJob(data)` (returns id), `updateJob(id,data)`, `removeJob(id)`
- `file(record)` — files a calculation into the active client (returns the stored record with an id); `assignResult(clientId, resultId, jobId|null)`; `delResult(clientId, resultId)`
- `activity()`

### 4.2 Data model
```
client  = { id, name, phone, email, address, suburb, postcode, lat?, lon?, createdAt, results:[ result… ] }
job     = { id, clientId, title, date(YYYY-MM-DD), type:'indoor'|'outdoor', location, createdAt }
result  = { id, createdAt, icon, module, title, summary,
            jobId: <jobId> | null,          // null = "Unassigned" bucket
            sheet: <dataURL PNG/JPEG> | null,// the saved set-out drawing (for recovery + job PDF)
            compliance?: 'pass'|'fail',      // pool fence etc.
            issues?: [ string ],             // compliance failure notes
            data: { …calculator-specific structured values (panels, gaps, dimensions, finish…) } }
settings = { activeClientId }
activity = [ { text, at } ]                  // recent-activity feed (last 25)
```
Per‑account isolation (cloud): each user reads/writes only `/users/{uid}` in Firestore; enforced by security rules server‑side.

### 4.3 Embedding calculators
- Each calculator is a complete HTML app mounted in `#calcFrame`. Multi‑file: `iframe.src = calculators/<id>.html`. Standalone: `iframe.srcdoc = <decoded base64 of the calculator>`.
- The parent hub exposes `window.App = App;` so a calculator can call back into the hub (e.g. to open the "save to job" picker). Calculators reach the shared bridge via `window.parent.CADify`.
- Calculator↔hub sync: standalone shares one bridge instance (immediate); multi‑file uses separate instances synced via `storage` events (hub‑side callbacks retry briefly to absorb the async delay).

---

## 5. Completed features (build all of these)

### 5.1 Hub (`CADify.html`)
- **Login / paywall gate:** email+password sign‑up/sign‑in (local stub), then a subscription paywall; a dev toggle unlocks it in local mode. Routing: no user → login; no active sub → paywall; else boot the app.
- **Bottom nav:** Home (dash), Clients, Calc, Schedule, Rules(compliance).
- **Dashboard:** stat tiles (clients, calculations, compliance flags), recent activity, quick actions.
- **Clients:** list, create/edit/delete, active‑client picker in the top bar.
- **Client folder** (open a client) with tabs:
  - **Calculations** — flat list of every saved run for the client, each labelled with the job it's in.
  - **Jobs** — each job is a **container card** listing the calculations saved into it, with **Export job PDF** and Edit; plus an **Unassigned** group card for runs not yet assigned.
  - **Compliance** — pass/fail summary rolled up from the client's checked runs + link to the NSW rules reference.
- **Save‑to‑job flow:** at save time the calculator files the run, then the hub opens a **picker** to choose a job, **＋ New job…**, or leave **Unassigned**. Any run can be re‑assigned later via **Assign** / **Move to job**.
- **Open a saved run (recovery):** tapping a saved run opens a detail view showing its drawing image, a key/value dump of its stored data (panels, gaps, dimensions, finish, compliance), **⬇ Download drawing (PNG)**, **⬇ Data (JSON)**, and **Move to job**. Runs saved before drawing‑capture existed show data + JSON only.
- **Combined job PDF export** (dependency‑free PDF built by hand from rasterised SVG/canvas pages): a cover page (client + job details + numbered contents), then per calculation a summary page + its stored drawing page. Downloaded as `CADify-<Client>-<Job>.pdf`.
- **Job scheduler / calendar:** create jobs with date + indoor/outdoor + location; list/agenda view.
- **BOM weather:** for **outdoor** jobs, fetch the **Bureau of Meteorology** forecast (via `api.weather.bom.gov.au`, with a CORS‑proxy fallback and a demo fallback) and flag rain risk on the job day.
- **NSW compliance reference** (Rules tab): tabbed Pool Fence (AS 1926.1), Balustrade, Shower Screen (AS 1288) reference figures — barrier heights, gaps, NCZ, gate/latch rules, glazing grades, etc.
- **Export client folder** as JSON.

### 5.2 Calculators (all embedded, all on‑brand)
1. **Glass Setout** (`glass-setout.html`) — glass balustrade **and** glass pool fencing set‑out. Computes an equal‑panel run to a target gap; supports edge‑of‑glass vs standoff/spigot ends; a "custom glass width, equal, desired gap" mode. Canvas shop drawings (assembled elevation, spigot/standoff details, holes, running dimensions), a Bill of Materials, PNG export, "Add Run to Job List", Project BOM export.
2. **Pool Fence** (`pool-fence.html`) — AS 1926.1 pool barrier. Panels + gates (hinge panels at a 100mm increment), non‑climbable zone, gap/height compliance producing a **pass/fail** with itemised issues, canvas drawings + compliance block, PNG/BOM export.
3. **Shower Screen** (`shower-screen.html`) — frameless shower screen set‑out. Config catalogue (fixed panel, door only, fixed+door, hinge panel+door, 180° inline, 90° corner). Integer maths in **tenths of a millimetre**; out‑of‑plumb handling; hinge/handle/bracket cut‑outs; optimiser that hits a valid 5mm panel increment inside gap limits. SVG shop drawings (set‑out sheet + fully‑dimensioned production sheet), **DXF** for the glass shop, hand‑built **PDF**, PNG, a built‑in **12‑case self‑test** suite (must pass 12/12), and a **💾 Save to job** button that captures the set‑out image and opens the hub picker.

### 5.3 Panel‑placement rule (all run‑based calculators)
When one or more panels must be **widened/made‑up** to make a run's length work, place those odd panels **grouped at ONE end** of the run (currently the start), never in the centre or split across both ends. Example: `1150·1150·1150·1200·1150·1150` → `1200·1150·1150·1150·1150·1150`. (Make the end configurable.)

### 5.4 Drawing capture on save
Every calculator, when it saves a run, captures its current set‑out drawing (canvas → PNG, or SVG → JPEG) into `result.sheet`, size‑bounded (fall back to a downscaled JPEG if the PNG is large) so the run can be reopened and the drawing recovered, and so the combined job PDF can include it.

### 5.5 Standalone packaging (`index.html`)
A build step inlines the bridge, base64‑embeds each calculator (with its bridge include rewired to `window.parent.CADify` and its own `localStorage` shim injected), rewrites `openCalc` to mount via `srcdoc`, exposes `window.App`, and adds a small **auto‑demo bootstrap** (creates a demo account + active sample client + dev subscription) so the single file opens straight into a working, populated app. Must boot and run with `localStorage` fully blocked.

---

## 6. Integration hooks a calculator must add (and nothing else)
1. Replace the calculator's own bridge `<script src="../cadify-bridge.js">…CADify.init()</script>` with a line that sets `window.CADify = window.parent.CADify` (standalone) / includes the bridge (multi‑file).
2. At the top of the calculator's main script, inject the in‑memory `localStorage` shim (§2.4).
3. On "save/add run": build a `record` (`module, icon, title, summary, data{…}`, plus `compliance/issues` where relevant), capture the drawing into `record.sheet`, call `CADify.file(record)`, then (for the explicit picker) call `window.parent.App.assignRecordPicker(record.id)`.

---

## 7. Deployment
- **Now:** deploy the single `index.html` to free static hosting — e.g. **Netlify** drag‑and‑drop — to get an `https://…netlify.app` URL that runs on any phone/tablet. Optionally map a subdomain **`app.<yourdomain>.com.au`** via a **CNAME** in the domain's DNS (works even when the marketing site is on GoDaddy Website Builder — DNS is separate). It is a PWA, so "Add to Home Screen" gives an app icon and full‑screen/offline use.
- Note: GoDaddy's **Website Builder** cannot host a standalone app (no file access); use real hosting + a subdomain instead.

---

## 8. FUTURE COMPONENTS — not yet built (roadmap)

### 8.1 Backend: demo → real SaaS (the big one)
- **Firebase Auth** (email/password + Google) replacing the local stub.
- **Firestore** per‑account storage with **security rules** enforcing isolation (`/users/{uid}` only), and **offline persistence** for field use + cross‑device sync.
- **Stripe** subscription billing (via the Firebase "Run Payments with Stripe" extension pattern): `startCheckout(priceId)` creates a checkout session and gates the app on an active subscription (`status in ['trialing','active']`).
- **Cloud storage for drawing images:** move `result.sheet` PNGs from the browser to Firebase Storage (Firestore docs cap at ~1MB and browser storage is finite), storing a URL on the record. This removes the local‑storage limit.
- Flip is intended to be a config swap (`CADify.init(firebaseConfig)`), because the bridge is already dual‑mode.

### 8.2 Remaining calculators (currently placeholders/stubs)
- **Steel Balustrade** (NCC / AS 1170).
- **Aluminium Balustrade** (NCC / AS 1170).
- **Illustrating / Quote** — estimate & illustrate / quoting tool.
- (Provide each as its own self‑contained HTML app, then embed + hook per §6.)

### 8.3 Feature polish still open
- Embed the **real `cadify_logo.png`** into every calculator header, the hub header, and all export title blocks (currently a serif placeholder).
- Roll the explicit **"Save to job"** picker out to **Glass Setout** and **Pool Fence** (they currently auto‑file to Unassigned; shower screen already has the picker).
- Add the **production sheet + DXF** to the combined **job PDF** (currently the set‑out drawing per run).
- Make the **odd‑panel end** (start vs far end) a user setting.
- Broaden drawing capture to store **all** sheets per run (set‑out + production), not just the primary.
- Optional: multi‑run "whole project" export, client‑level export bundle (ZIP), and richer scheduler (recurring jobs, reminders).

---

## 9. Acceptance criteria
- Opens and is fully interactive from a **single `index.html`** in any modern browser, including where `localStorage` is blocked.
- All three calculators mount, compute, draw, and pass their self‑tests (shower screen: **12/12**).
- Save‑to‑job → picker → job grouping → **combined job PDF** works; a saved run reopens with its **drawing + downloadable PNG/JSON**.
- Widened/made‑up panels appear **grouped at one end** of the run in balustrade and pool fence.
- Every screen and export matches the **brand system** in §3 (concrete/black UI; white sheets with `#111111` ink and only the `#c0521c`/`#1f6f8b` accents).
- Mobile‑first, offline‑capable, no external dependencies.

---

*Build to this spec. Keep each calculator's calculation/drawing engine intact; only add the integration hooks. Preserve exact colours, the data model, and the dual‑mode bridge so the future Firebase + Stripe swap is a configuration change, not a rewrite.*
