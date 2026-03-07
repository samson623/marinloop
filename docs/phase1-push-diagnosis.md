# Phase 1: Push notification diagnosis

Use this to find the exact failure point before applying Phase 2 fixes.

## Local setup

- **Dev:** `npm run dev` → open **http://localhost:5173**
- **Preview (production build):** `npm run preview` → http://localhost:4173

## Checks (in order)

### 1.1 SW reachable

**What:** `GET /sw.js` must return the service worker script, not HTML.

**How:**

- Open the app (e.g. http://localhost:5173).
- DevTools → Network → reload. Find `sw.js` (or open `https://your-app-url/sw.js` in a new tab).
- **Pass:** Status 200, Type `application/javascript` or `text/javascript`, body starts with `// MarinLoop` (JS), not `<!doctype html>`.

**Note:** On Vite dev (5173) and Vite preview (4173), `/sw.js` is served from `public/sw.js` and passes. On **Vercel**, the rewrite `"/(.*)" -> "/index.html"` in `vercel.json` can cause `/sw.js` to return `index.html`; if so, 1.1 fails in production and Phase 2.1 (rewrite exception for `/sw.js`) is required.

---

### 1.2 Controller

**What:** After a full reload, the page must be controlled by the service worker.

**How:**

- Reload the app (full reload, not HMR).
- DevTools → Console, run:  
  `navigator.serviceWorker.controller !== null`
- **Pass:** Result is `true`.

---

### 1.3 SW registration

**What:** At least one service worker is registered and active.

**How:**

- DevTools → Application → Service Workers.
- **Pass:** One worker for `/sw.js` (or your origin), state **activated**.

---

### 1.4 Subscription (browser)

**What:** After enabling push in Profile, the browser has a push subscription.

**How:**

- Log in (non-demo), go to Profile, turn push **On** and allow when prompted.
- Console:  
  `(await navigator.serviceWorker.ready).pushManager.getSubscription()`
- **Pass:** Non-null object with an `endpoint` property.

**Or:** Run the script `scripts/phase1-push-diagnostic.js` in the console (paste and Enter); it prints 1.2–1.4 and reminds you of 1.5–1.7.

---

### 1.5 Subscription in DB

**What:** The subscription is stored in Supabase.

**How:**

- Supabase Dashboard → Table Editor → `push_subscriptions`.
- **Pass:** At least one row for your `user_id` with `endpoint`, `p256dh`, `auth` populated.

---

### 1.6 send-push response

**What:** The Test Push request succeeds and returns delivery counts.

**How:**

- Profile → **Send test notification** (with push enabled).
- Network tab → select the `send-push` request → Response.
- **Pass:** Body has `sent >= 1`, `total >= 1`. If `total > 0` and `sent === 0`, read `pushResults` and Edge Function logs (VAPID or endpoint issues).

---

### 1.7 Delivery

**What:** The device shows the notification and click opens the app.

**How:**

- Trigger Test Push; optionally switch to another tab or minimize.
- **Pass:** Notification appears; clicking it focuses/opens the app and navigates to the payload URL.

---

## Automated script (1.2–1.4)

In the browser console at http://localhost:5173 (or your deployed URL), paste and run:

```js
// From scripts/phase1-push-diagnostic.js
async function runPhase1() {
  const out = (label, pass, detail) =>
    console.log(pass ? '[PASS]' : '[FAIL]', label, detail != null ? detail : '');
  const r = {};
  console.log('--- 1.2 Controller ---');
  if (!('serviceWorker' in navigator)) {
    out('1.2 SW supported', false, 'no navigator.serviceWorker');
    r['1.2'] = false;
  } else {
    r['1.2'] = navigator.serviceWorker.controller != null;
    out('1.2 controller not null', r['1.2'], r['1.2'] ? 'OK' : 'null');
  }
  console.log('--- 1.3 Registration ---');
  if (!('serviceWorker' in navigator)) r['1.3'] = false;
  else {
    const regs = await navigator.serviceWorker.getRegistrations();
    const active = regs.find((x) => x.active);
    r['1.3'] = !!active;
    out('1.3 active SW', r['1.3'], active ? active.scope : 'none');
  }
  console.log('--- 1.4 Subscription ---');
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    r['1.4'] = false;
    out('1.4 getSubscription', false, 'SW or PushManager missing');
  } else {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    r['1.4'] = !!sub;
    out('1.4 getSubscription()', r['1.4'], sub ? sub.endpoint.slice(0, 50) + '...' : 'null');
  }
  console.log('--- Summary ---', r);
  return r;
}
runPhase1();
```

---

## Interpreting the first failure

| First failing check | Likely cause | Phase 2 fix |
|---------------------|--------------|------------|
| 1.1                 | `/sw.js` returns HTML (e.g. Vercel rewrite) | 2.1: Add rewrite for `/sw.js` in `vercel.json` |
| 1.2 or 1.3          | SW not controlling / not active (often after 1.1) | Fix 1.1; hard reload; if still fail, check SW script errors |
| 1.4                 | Subscribe failed (missing VAPID key, permission denied, or key format) | 2.2 + 2.3: applicationServerKey as Uint8Array, VAPID keys aligned |
| 1.5                 | DB write failed (RLS, conflict, or subscribe failed before upsert) | Fix 1.4; check Supabase logs and RLS |
| 1.6                 | send-push returns `sent === 0` (VAPID, stale endpoint) | 2.3 VAPID alignment; check `pushResults` and Edge Function logs |
| 1.7                 | Server says sent but no notification | OS/browser permissions, Do Not Disturb, or foreground tab behavior |

Phase 1 stops here. After you have the first failure and (optionally) applied the corresponding Phase 2 fix, re-run the checklist and proceed to the next phase when all pass.
