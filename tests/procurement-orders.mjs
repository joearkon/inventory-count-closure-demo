import assert from 'node:assert/strict';

const base = (process.env.BASE_URL || 'http://127.0.0.1:8788').replace(/\/$/, '');
const nativeFetch = globalThis.fetch;
const loginResponse = await nativeFetch(`${base}/api/auth/login`, { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({ email:'wangmin@demo.local', password:'HqAdmin123!' }) });
assert.equal(loginResponse.status, 200, 'HQ login failed');
const authCookie = (loginResponse.headers.get('set-cookie') || '').split(';')[0];
globalThis.fetch = (input, options = {}) => { const headers = new Headers(options.headers || {}); headers.set('cookie', authCookie); return nativeFetch(input, { ...options, headers }); };
const mobileLoginResponse = await nativeFetch(`${base}/api/auth/demo-login`, { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({ account_id:'ACC-STORE-LI', portal:'mobile' }) });
assert.equal(mobileLoginResponse.status, 200, 'mobile demo login failed');
const mobileCookie = (mobileLoginResponse.headers.get('set-cookie') || '').split(';')[0];
async function call(path, options = {}, expected = 200) {
  const response = await fetch(`${base}${path}`, options), body = await response.json().catch(() => ({}));
  assert.equal(response.status, expected, `${path}: ${response.status} ${body.error || ''}`);
  return body;
}
const post = (path, body, expected = 200) => call(path, { method:'POST', headers:{ 'content-type':'application/json' }, body:JSON.stringify(body) }, expected);

for (const path of ['/purchase-orders/', '/receipt-orders/', '/procurement-detail/?type=purchase&id=missing']) {
  const response = path.startsWith('/procurement-detail/')
    ? await nativeFetch(`${base}${path}`, { headers:{ cookie:mobileCookie } })
    : await fetch(`${base}${path}`);
  assert.equal(response.status, 200, `${path} page missing`);
  const html = await response.text(); assert.match(html, /procurement|订货|收货/i);
}

const before = await call('/api/state?view=procurement');
const eventBefore = (await call('/api/state?view=documents')).materialEvents.length;
const suffix = Date.now();
const created = await post('/api/purchase-orders', {
  store_code:'STORE001', business_date:'2026-09-17', supplier_name:`QA供应商${suffix}`,
  urgency:'urgent', source_type:'work_order', source_work_order_id:'OPT-QA-PROCUREMENT',
  lines:[{ material_name:'牛奶', unit:'L', qty:5 }, { material_name:'黑糖珍珠', unit:'g', qty:2000 }]
}, 201);
assert.equal(created.order.status, 'draft'); assert.equal(created.order.lines.length, 2);
assert.equal((await call('/api/state?view=documents')).materialEvents.length, eventBefore, 'purchase draft wrote inventory');

const submitted = await post(`/api/purchase-orders/${created.order.id}/submit`, {});
assert.equal(submitted.order.status, 'pending_receipt');

const firstDraft = await post('/api/receipt-orders', {
  order_id:created.order.id, store_code:'STORE001', business_date:'2026-09-17',
  lines:[{ material_name:'牛奶', unit:'L', qty:2 }], operator:'QA门店'
}, 201);
assert.equal(firstDraft.receipt.status, 'draft');
assert.equal((await call('/api/state?view=documents')).materialEvents.length, eventBefore, 'receipt draft wrote inventory');

const firstConfirmed = await post(`/api/receipt-orders/${firstDraft.receipt.id}/confirm`, { operator:'QA门店' });
assert.equal(firstConfirmed.receipt.status, 'received'); assert.equal(firstConfirmed.events.length, 1);
assert.equal(firstConfirmed.purchase_order.status, 'partially_received');
await post(`/api/receipt-orders/${firstDraft.receipt.id}/confirm`, { operator:'QA门店' }, 409);

const secondDraft = await post('/api/receipt-orders', { order_id:created.order.id, store_code:'STORE001', business_date:'2026-09-17' }, 201);
assert.equal(secondDraft.receipt.lines.length, 2, 'remaining order lines not prefilled');
assert.equal(secondDraft.receipt.source_type, 'work_order', 'receipt did not inherit purchase source');
assert.equal(secondDraft.receipt.source_work_order_id, 'OPT-QA-PROCUREMENT', 'receipt did not inherit source work order');
const secondConfirmed = await post(`/api/receipt-orders/${secondDraft.receipt.id}/confirm`, { operator:'QA门店' });
assert.equal(secondConfirmed.purchase_order.status, 'received'); assert.equal(secondConfirmed.events.length, 2);

const detail = await call(`/api/purchase-orders/${created.order.id}`);
assert.equal(detail.receipts.length, 2); assert.equal(detail.record.status, 'received');
assert.equal((await call('/api/state?view=documents')).materialEvents.length, eventBefore + 3);

const independent = await post('/api/receipt-orders', { store_code:'STORE001', business_date:'2026-09-17', lines:[{ material_name:'茶叶', unit:'kg', qty:1 }], source_type:'manual' }, 201);
const cancelled = await post(`/api/receipt-orders/${independent.receipt.id}/cancel`, { operator:'QA门店' });
assert.equal(cancelled.receipt.status, 'cancelled');
assert.equal((await call('/api/state?view=documents')).materialEvents.length, eventBefore + 3, 'cancelled draft wrote inventory');

console.log(JSON.stringify({ ok:true, previous_purchase_orders:before.purchaseOrders.length, purchase_order:created.order.order_no, receipts:[firstDraft.receipt.receipt_no, secondDraft.receipt.receipt_no], event_delta:3 }, null, 2));
