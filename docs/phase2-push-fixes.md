# Phase 2: Push notification fixes (applied)

Summary of what was changed and what you must configure.

## 2.1 Vercel: serve /sw.js as static (done)

**File:** [vercel.json](vercel.json)

A rewrite was added so `/sw.js` is served from the build output before the SPA catch-all:

- `{ "source": "/sw.js", "destination": "/sw.js" }` (first)
- `{ "source": "/(.*)", "destination": "/index.html" }` (unchanged)

After deploy, confirm in production: `GET /sw.js` returns 200 and JavaScript.

---

## 2.2 Client: applicationServerKey as Uint8Array (done)

**File:** [src/shared/services/push.ts](src/shared/services/push.ts)

`applicationServerKey` now passes the `Uint8Array` from `urlBase64ToUint8Array(vapidKey)` directly instead of `.buffer as ArrayBuffer`.

---

## 2.3 VAPID key alignment (done)

Completed: one VAPID key pair was generated and set everywhere so client and server match.

- **Supabase** (project `lcbdafnxwvqbziootvmi`): `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT=mailto:admin@marinloop.com` are set via `supabase secrets set`.
- **Local:** `.env.local` has `VITE_VAPID_PUBLIC_KEY` set to the same public key (do not commit `.env.local`).
- **Vercel:** `VITE_VAPID_PUBLIC_KEY` was set for production (and is available to all environments).

If you ever rotate keys: generate a new pair with `npx web-push generate-vapid-keys`, then set the **same** public key in Vercel and `.env.local`, and the same pair (public + private) plus `VAPID_SUBJECT` in Supabase.

---

## 2.4 Dev-only logging (done)

**Files:** [src/shared/services/push.ts](src/shared/services/push.ts), [public/sw.js](public/sw.js)

- **push.ts:** All `console.log` / `console.warn` / `console.error` are guarded with `if (DEBUG)` where `DEBUG = import.meta.env.DEV`.
- **sw.js:** All `console.log` / `console.warn` are guarded with `if (DEBUG)` where `DEBUG = self.location && self.location.hostname === 'localhost'`.

Production builds do not emit these logs.

---

## 2.5 Test notification title (done)

**File:** [src/shared/services/push.ts](src/shared/services/push.ts)

The test push title was changed from `'🧪 MarinLoop Test'` to `'MarinLoop Test'` (no emoji) to match the clinical UI rule.

---

## Verification after Phase 2

Re-run the [Phase 1 checklist](phase1-push-diagnosis.md): 1.1–1.7. All should pass after you complete 2.3 (VAPID alignment) and deploy.
