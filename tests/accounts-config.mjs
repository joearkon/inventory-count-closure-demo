import assert from 'node:assert/strict';

const base = (process.env.BASE_URL || 'http://127.0.0.1:8788').replace(/\/$/, '');
const nativeFetch = globalThis.fetch;
const unauthenticated = await nativeFetch(`${base}/api/state`);
assert.equal(unauthenticated.status, 401, 'API must reject unauthenticated requests');
const credentials = [
  ['xiaoli@demo.local', 'Store001!'],
  ['manager.store001@demo.local', 'Manager001!'],
  ['rina@demo.local', 'RinaArea123!'],
  ['wangmin@demo.local', 'HqAdmin123!']
];
for (const [email, password] of credentials) {
  const response = await nativeFetch(`${base}/api/auth/login`, { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({ email, password }) });
  assert.equal(response.status, 200, `credential failed for ${email}`);
}
const wrongPassword = await nativeFetch(`${base}/api/auth/login`, { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({ email:'wangmin@demo.local', password:'wrong-password' }) });
assert.equal(wrongPassword.status, 401, 'wrong password must be rejected');
const publicOptions = await nativeFetch(`${base}/api/auth/options`).then((response) => response.json());
assert.ok(!JSON.stringify(publicOptions).includes('password_hash') && !JSON.stringify(publicOptions).includes('password_salt'), 'credential hash leaked from login options');
let authCookie = '';
async function login(email, password) {
  const response = await nativeFetch(`${base}/api/auth/login`, { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({ email, password }) });
  assert.equal(response.status, 200, `login failed for ${email}`);
  authCookie = (response.headers.get('set-cookie') || '').split(';')[0];
  return response.json();
}
await login('wangmin@demo.local', 'HqAdmin123!');
globalThis.fetch = (input, options = {}) => { const headers = new Headers(options.headers || {}); if (authCookie) headers.set('cookie', authCookie); return nativeFetch(input, { ...options, headers }); };
const qaEmail = `qa.store.staff.${Date.now()}@example.com`;
async function call(path, options = {}, expected = 200) {
  const response = await fetch(`${base}${path}`, options);
  const body = await response.json().catch(() => ({}));
  assert.equal(response.status, expected, `${path}: ${response.status} ${body.error || ''}`);
  return body;
}
const post = (path, body, expected = 200) => call(path, { method:'POST', headers:{ 'content-type':'application/json' }, body:JSON.stringify(body) }, expected);

const page = await fetch(`${base}/accounts/`);
assert.equal(page.status, 200, 'accounts page missing');
assert.match(await page.text(), /账户与角色/);

const initial = await call('/api/accounts/config');
assert.ok(!JSON.stringify(initial).includes('password_hash') && !JSON.stringify(initial).includes('password_salt'), 'credential hash leaked from account config');
assert.equal(initial.enforcement.api_authorization_enabled, true);
assert.ok(initial.accounts.length >= 4, 'seed accounts missing');
assert.ok(initial.roles.some((role) => role.id === 'area_supervisor'), 'supervisor role missing');
assert.ok(initial.active_account, 'active demo account missing');

await post('/api/accounts', {
  display_name:'QA 店员', email:qaEmail, password:'QaStore123!', identity_provider:'email_demo',
  role_ids:['store_staff'], org_scope_type:'all', store_codes:[], org_ids:['ORG-HQ'], status:'active'
}, 400);

const created = await post('/api/accounts', {
  display_name:'QA 店员', email:qaEmail, password:'QaStore123!', identity_provider:'email_demo',
  role_ids:['store_staff'], org_scope_type:'stores', store_codes:['STORE003'], org_ids:['STORE003'], status:'active'
}, 201);
const account = created.accounts.find((item) => item.email === qaEmail);
assert.ok(account, 'account not created');
assert.deepEqual(account.store_codes, ['STORE003']);

const switched = await post('/api/accounts/active', { account_id:account.id });
assert.equal(switched.active_account_id, account.id);
assert.equal(switched.active_account.display_name, 'QA 店员');

await post('/api/accounts', { ...account, status:'disabled' }, 400);
await post('/api/accounts/active', { account_id:initial.active_account_id });

await login('xiaoli@demo.local', 'Store001!');
const storeState = await call('/api/state');
assert.ok(storeState.storeMasters.every((item) => item.store_code === 'STORE001'), 'store account leaked another store');
await call('/api/accounts/config', {}, 403);
await post('/api/material-events', { store_code:'STORE001', business_date:'2026-09-18', material_name:'牛奶', unit:'L', qty:1, type:'receipt' }, 403);

await login('wangmin@demo.local', 'HqAdmin123!');

console.log(JSON.stringify({ ok:true, seeded_accounts:initial.accounts.length, created_account:account.id, api_auth:true, store_scope:true, active_restored:initial.active_account_id }, null, 2));
