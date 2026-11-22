# CADify — Firebase + Stripe setup guide

Turns CADify into a subscription product: logins, per‑account isolated storage,
offline‑first sync, and Stripe billing. You do the account setup below (it needs
your secret keys); the app code is already written to plug straight in.

## What each piece does
- **Firebase Auth** — user logins (email/password + optional Google).
- **Cloud Firestore** — the database. Offline persistence is on, so the app works with no signal and syncs when back online. Data lives under `/users/{uid}` and is isolated by `firestore.rules`.
- **Firebase Hosting** — serves the installable PWA.
- **Stripe (Firebase extension)** — subscriptions; stamps each account with an active‑subscription claim the app and rules check.

---

## 1. Create the Firebase project
1. Go to console.firebase.google.com → **Add project** → name it (e.g. `cadify-app`).
2. **Build → Authentication → Get started** → enable **Email/Password** (and **Google** if you want one‑tap sign‑in).
3. **Build → Firestore Database → Create database** → Production mode → pick an Australian region (`australia-southeast1`).
4. **Project settings → General → Your apps → Web (`</>`)** → register an app. Copy the `firebaseConfig` block it shows you — that's the config you paste into the app:

```js
const FIREBASE_CONFIG = {
  apiKey: "…", authDomain: "cadify-app.firebaseapp.com",
  projectId: "cadify-app", storageBucket: "cadify-app.appspot.com",
  messagingSenderId: "…", appId: "…"
};
```
(These are public client keys — safe to ship in the app. Security comes from the rules, not from hiding these.)

## 2. Deploy the isolation rules
Install the CLI once: `npm i -g firebase-tools`, then `firebase login`.
In the project folder (containing `firestore.rules`):
```
firebase init firestore      # point it at the existing project, keep firestore.rules
firebase deploy --only firestore:rules
```
This is the guarantee that one account can't read another's data.

> **Dev tip:** the rules gate *writes* on an active subscription. While building
> before billing is live, open `firestore.rules` and remove `&& hasActiveSub()`
> from the `/users/{uid}/{document=**}` write rule, then redeploy. Put it back
> before launch.

## 3. Add Stripe billing
1. Create a **Stripe** account. In Stripe → **Products**, create your CADify plan(s) (e.g. “CADify Pro — $X/month”) and copy each **Price ID** (`price_…`).
2. In Firebase → **Extensions** → install **“Run Payments with Stripe”** (by Invertase/Stripe). During setup give it your Stripe secret key and set the “sync” options; it creates the `customers/`, `products/`, and `subscriptions/` collections the app reads, and writes the `stripeRole` claim on active subscribers.
3. Configure the extension's webhook in Stripe as its install screen instructs (copy the signing secret back in).

## 4. Wire the config into the app
In `CADify.html` (and each calculator page), the bridge is loaded like this:
```html
<script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js"></script>
<script src="cadify-bridge.js"></script>
<script>CADify.init(FIREBASE_CONFIG);</script>
```
Paste your `FIREBASE_CONFIG` from step 1. Set your `price_…` id where the subscribe button calls `CADify.startCheckout('price_…')`.

## 5. Deploy the app
```
firebase init hosting        # public dir = the folder with CADify.html + /calculators
firebase deploy --only hosting
```
Your app is live at `https://cadify-app.web.app` (or your custom domain). Because
it's one origin, the hub and all calculators share the signed‑in account's data,
and the PWA offline cache works.

---

## How the code already fits
- `cadify-bridge.js` exposes the same `CADify.file() / clients() / activeClient() / setActiveClient()` the calculators call — now backed by Firestore. **No calculator changes.**
- It adds `CADify.auth.*` (signup/login/reset/logout), `CADify.subscription()` and `CADify.startCheckout()` for the login + paywall shell.
- `firestore.rules` enforces per‑account isolation and the subscription gate.
- Results file into `/users/{uid}/clients/{clientId}.results`. Large drawing SV*/PDFs are kept out of the 1MB Firestore doc automatically (`_drawingsOmitted`) — the next step is a Cloud Storage bucket for those, linked from the record.

## Rough running cost
Firebase Auth + Firestore + Hosting have a free tier that comfortably covers early
users; you pay for reads/writes/storage as you grow (cents per thousand). Stripe
takes its standard per‑transaction fee. No fixed server cost.
