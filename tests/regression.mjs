const base = (process.env.BASE_URL || 'http://127.0.0.1:8787').replace(/\/$/, '');
const mutationTests = process.env.MUTATION_TESTS === '1';
const results = [];
const session = (name) => `qa-${name}-${Date.now()}`.replace(/[^A-Za-z0-9_-]/g, '-').slice(0, 80);

async function json(path, options = {}) {
  const response = await fetch(`${base}${path}`, options);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${path}: ${response.status} ${body.error || 'request failed'}`);
  return body;
}

async function check(name, task) {
  try { const detail = await task(); results.push({ name, ok: true, detail }); }
  catch (error) { results.push({ name, ok: false, detail: error.message }); }
}

async function ask({ message, lang = 'zh-CN', session_id = session(lang), draft = null }) {
  return json('/api/store-agent', { method:'POST', headers:{ 'content-type':'application/json' }, body:JSON.stringify({ message, lang, store_code:'STORE001', session_id, draft }) });
}

await check('storage health', async () => {
  const value = await json('/api/system/storage-health');
  if (!value.r2 && !value.storage) throw new Error('missing R2 health result');
  return value;
});

await check('master data and daily count range', async () => {
  const state = await json('/api/state');
  const stores = state.storeMasters || [], products = state.productCatalog || [], materials = state.materialCatalog || [];
  if (stores.length !== 6) throw new Error(`expected 6 stores, got ${stores.length}`);
  if (products.length < 18) throw new Error(`expected >=18 products, got ${products.length}`);
  if (materials.length !== 20) throw new Error(`expected 20 materials, got ${materials.length}`);
  const optional = materials.filter((item) => (item.count_policy || (item.daily_count_enabled === false ? 'optional' : 'daily')) === 'optional');
  if (optional.length !== 8) throw new Error(`expected 8 optional-count materials, got ${optional.length}`);
  return { stores:stores.length, products:products.length, materials:materials.length, daily:materials.length-optional.length, optional:optional.length };
});

await check('new pages are served', async () => {
  const paths = ['/count-plans/', '/documents/', '/knowledge/', '/knowledge/库存异常判定常用-Knowhow.md', '/store/?store=STORE001'];
  for (const path of paths) {
    const response = await fetch(`${base}${path}`);
    if (!response.ok) throw new Error(`${path}: ${response.status}`);
  }
  return paths;
});

if (mutationTests) {
  await check('count policy can change and restore', async () => {
    const changed = await json('/api/material-catalog/count-policy', { method:'POST', headers:{ 'content-type':'application/json' }, body:JSON.stringify({ material_name:'牛奶', count_policy:'optional' }) });
    const selected = changed.material_catalog.find((item) => item.material_name === '牛奶');
    if (selected?.count_policy !== 'optional') throw new Error('policy was not updated');
    const restored = await json('/api/material-catalog/count-policy', { method:'POST', headers:{ 'content-type':'application/json' }, body:JSON.stringify({ material_name:'牛奶', count_policy:'daily' }) });
    if (restored.material_catalog.find((item) => item.material_name === '牛奶')?.count_policy !== 'daily') throw new Error('policy was not restored');
    return { changed:'optional', restored:'daily' };
  });

  await check('manual count plan can be issued', async () => {
    const date = new Intl.DateTimeFormat('en-CA', { timeZone:'Asia/Shanghai' }).format(new Date());
    const value = await json('/api/count-plans/manual', { method:'POST', headers:{ 'content-type':'application/json' }, body:JSON.stringify({ store_code:'STORE001', business_date:date, material_names:['牛奶','黑糖珍珠'], source_type:'work_order', source_work_order_id:'QA-WO-001', instruction:'自动回归：仅本地状态' }) });
    if (value.plan?.material_count !== 2 || value.plan?.plan_type !== 'work_order_material_set') throw new Error(JSON.stringify(value.plan));
    return { plan_no:value.plan.plan_no, materials:value.plan.material_count };
  });
}

await check('Chinese transfer intent', async () => {
  const value = await ask({ message:'调 2kg 黑糖珍珠去 STORE002' });
  if (value.action?.type !== 'open_transfer') throw new Error(JSON.stringify(value.action));
  return value.action;
});

await check('English transfer intent', async () => {
  const value = await ask({ message:'Transfer 2 kg of brown sugar pearls to STORE002', lang:'en-US' });
  if (value.action?.type !== 'open_transfer') throw new Error(JSON.stringify(value.action));
  if (value.action.prefill?.material_name !== '黑糖珍珠') throw new Error('material alias not resolved');
  if (value.action.prefill?.unit !== 'g' || Number(value.action.prefill?.qty) !== 2000) throw new Error('2kg was not converted to 2000g');
  return value.action;
});

await check('Indonesian transfer intent', async () => {
  const value = await ask({ message:'Pindahkan 2 kg mutiara gula merah ke STORE002', lang:'id-ID' });
  if (value.action?.type !== 'open_transfer') throw new Error(JSON.stringify(value.action));
  if (value.action.prefill?.material_name !== '黑糖珍珠') throw new Error('material alias not resolved');
  if (value.action.prefill?.unit !== 'g' || Number(value.action.prefill?.qty) !== 2000) throw new Error('2kg was not converted to 2000g');
  return value.action;
});

await check('English inventory query', async () => {
  const value = await ask({ message:'Check milk inventory', lang:'en-US' });
  if (value.action?.type !== 'show_inventory') throw new Error(JSON.stringify(value.action));
  return value.action;
});

await check('Indonesian inventory query', async () => {
  const value = await ask({ message:'Cek stok susu', lang:'id-ID' });
  if (value.action?.type !== 'show_inventory') throw new Error(JSON.stringify(value.action));
  return value.action;
});

await check('Multi-turn transfer context', async () => {
  const session_id = session('multi-transfer');
  const first = await ask({ message:'我要做调拨到 STORE002', session_id });
  const second = await ask({ message:'黑糖珍珠 2kg', session_id });
  if (first.action?.type !== 'open_transfer' || second.action?.type !== 'open_transfer') throw new Error('intent was not retained');
  if (second.action.prefill?.to_store_code !== 'STORE002' || second.action.prefill?.material_name !== '黑糖珍珠' || second.action.prefill?.unit !== 'g' || Number(second.action.prefill?.qty) !== 2000 || Number(second.action.prefill?.destinations?.[0]?.qty) !== 2000) throw new Error(JSON.stringify(second.action.prefill));
  return second.action;
});

await check('Indonesian multi-turn scrap context', async () => {
  const session_id = session('multi-scrap-id');
  const first = await ask({ message:'Saya mau mencatat barang rusak', lang:'id-ID', session_id });
  const second = await ask({ message:'susu 2 L, kedaluwarsa', lang:'id-ID', session_id });
  if (first.action?.type !== 'open_scrap' || second.action?.type !== 'open_scrap') throw new Error('scrap intent was not retained');
  if (second.action.prefill?.material_name !== '牛奶' || Number(second.action.prefill?.qty) !== 2 || second.action.prefill?.reason !== '过期') throw new Error(JSON.stringify(second.action.prefill));
  return second.action;
});

await check('Ambiguous sentence does not write inventory', async () => {
  const before = await json('/api/state');
  const eventCount = (before.materialEvents || []).length;
  const value = await ask({ message:'maybe we should think about milk tomorrow', lang:'en-US' });
  const after = await json('/api/state');
  if ((after.materialEvents || []).length !== eventCount) throw new Error('assistant wrote inventory without confirmation');
  return { action:value.action?.type || 'none', unchanged_events:eventCount };
});

const failed = results.filter((item) => !item.ok);
console.log(JSON.stringify({ base, passed:results.length-failed.length, failed:failed.length, results }, null, 2));
process.exitCode = failed.length ? 1 : 0;
