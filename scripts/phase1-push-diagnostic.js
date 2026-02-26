// Phase 1 Push Diagnostic - run in browser console at http://localhost:5173 (or your app URL)
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
  if (!('serviceWorker' in navigator)) {
    r['1.3'] = false;
  } else {
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

  console.log('--- 1.5-1.7: manual ---');
  console.log('1.5 Supabase -> push_subscriptions: row for this user?');
  console.log('1.6 Profile -> Send test notification -> Network send-push: sent, total, pushResults');
  console.log('1.7 Notification appears and click opens app');
  console.log('--- Summary ---', r);
  return r;
}
runPhase1();
