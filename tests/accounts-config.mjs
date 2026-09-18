import assert from 'node:assert/strict';

const base = (process.env.BASE_URL || 'http://127.0.0.1:8788').replace(/\/$/, '');
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
assert.equal(initial.enforcement.api_authorization_enabled, false);
assert.ok(initial.accounts.length >= 4, 'seed accounts missing');
assert.ok(initial.roles.some((role) => role.id === 'area_supervisor'), 'supervisor role missing');
assert.ok(initial.active_account, 'active demo account missing');

await post('/api/accounts', {
  display_name:'QA 店员', email:'qa.store.staff@example.com', identity_provider:'email_demo',
  role_ids:['store_staff'], org_scope_type:'all', store_codes:[], org_ids:['ORG-HQ'], status:'active'
}, 400);

const created = await post('/api/accounts', {
  display_name:'QA 店员', email:'qa.store.staff@example.com', identity_provider:'email_demo',
  role_ids:['store_staff'], org_scope_type:'stores', store_codes:['STORE003'], org_ids:['STORE003'], status:'active'
}, 201);
const account = created.accounts.find((item) => item.email === 'qa.store.staff@example.com');
assert.ok(account, 'account not created');
assert.deepEqual(account.store_codes, ['STORE003']);

const switched = await post('/api/accounts/active', { account_id:account.id });
assert.equal(switched.active_account_id, account.id);
assert.equal(switched.active_account.display_name, 'QA 店员');

await post('/api/accounts', { ...account, status:'disabled' }, 400);
await post('/api/accounts/active', { account_id:initial.active_account_id });

console.log(JSON.stringify({ ok:true, seeded_accounts:initial.accounts.length, created_account:account.id, active_restored:initial.active_account_id }, null, 2));
