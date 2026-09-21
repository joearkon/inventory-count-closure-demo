import { readFile } from 'node:fs/promises';

const base = (process.env.BASE_URL || 'http://127.0.0.1:8787').replace(/\/$/, '');
const nativeFetch = globalThis.fetch;
let authCookie = '';
const loginResponse = await nativeFetch(`${base}/api/auth/login`, { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({ email:'wangmin@demo.local', password:'HqAdmin123!' }) });
if (!loginResponse.ok) throw new Error(`QA login failed: ${loginResponse.status}`);
authCookie = (loginResponse.headers.get('set-cookie') || '').split(';')[0];
globalThis.fetch = (input, options = {}) => {
  const headers = new Headers(options.headers || {}); if (authCookie) headers.set('cookie', authCookie);
  return nativeFetch(input, { ...options, headers });
};
const mutationTests = process.env.MUTATION_TESTS === '1';
const results = [];
let manualPlan = null;
const session = (name) => `qa-${name}-${Date.now()}`.replace(/[^A-Za-z0-9_-]/g, '-').slice(0, 80);

async function json(path, options = {}) {
  const response = await fetch(`${base}${path}`, options);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${path}: ${response.status} ${body.error || 'request failed'}`);
  return body;
}

async function expectStatus(path, status, options = {}) {
  const response = await fetch(`${base}${path}`, options);
  const body = await response.json().catch(() => ({}));
  if (response.status !== status) throw new Error(`${path}: expected ${status}, got ${response.status} ${body.error || ''}`);
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
  const realProducts = products.filter((item) => item.data_classification === 'brand_real');
  const mockProducts = products.filter((item) => item.data_classification === 'mvp_mock');
  if (realProducts.length !== 6 || mockProducts.length !== 12) throw new Error(`unexpected product classification: real=${realProducts.length}, mock=${mockProducts.length}`);
  if (realProducts.some((item) => !item.product_name.startsWith('Brown Sugar Boba Milk Tea'))) throw new Error('non-Brown Sugar product marked as brand real');
  if (materials.length !== 20) throw new Error(`expected 20 materials, got ${materials.length}`);
  const optional = materials.filter((item) => (item.count_policy || (item.daily_count_enabled === false ? 'optional' : 'daily')) === 'optional');
  if (optional.length !== 8) throw new Error(`expected 8 optional-count materials, got ${optional.length}`);
  return { stores:stores.length, products:products.length, brand_real:realProducts.length, mvp_mock:mockProducts.length, materials:materials.length, daily:materials.length-optional.length, optional:optional.length };
});

await check('STORE001 safety stock scope and material conversions', async () => {
  const state = await json('/api/state');
  const policies = state.safetyStockPolicies || [];
  if (policies.length !== 4 || policies.some((item) => item.store_code !== 'STORE001')) throw new Error(`unexpected safety policies: ${JSON.stringify(policies)}`);
  const byName = new Map((state.materialCatalog || []).map((item) => [item.material_name, item]));
  const expected = { 杯子:['个','箱',100], 黑糖珍珠:['g','kg',1000], 吸管:['个','箱',5000], 双杯袋:['个','箱',4000], 四杯袋:['个','箱',3000] };
  for (const [name, [base, procurement, factor]] of Object.entries(expected)) {
    const item = byName.get(name);
    if (!item || item.base_unit !== base || item.procurement_unit !== procurement || Number(item.conversion_factor) !== factor) throw new Error(`${name} conversion mismatch`);
  }
  return { policy_count:policies.length, stores:[...new Set(policies.map((item) => item.store_code))], checked_conversions:Object.keys(expected) };
});

await check('brand BOM whitelist and mock coverage are explicit', async () => {
  const sync = await json('/api/feishu-sync/state');
  if (Number(sync.mapping?.product_skus || 0) !== 18 || Number(sync.mapping?.bom_skus || 0) !== 7 || Number(sync.mapping?.bom_lines || 0) !== 58 || Number(sync.mapping?.brand_real_skus || 0) !== 6 || Number(sync.mapping?.mvp_mock_bom_skus || 0) !== 1) throw new Error(`unexpected BOM mapping: ${JSON.stringify(sync.mapping)}`);
  return { product_master_skus:sync.mapping.product_skus, mapped_skus:sync.mapping.bom_skus, bom_lines:sync.mapping.bom_lines, brand_real_skus:sync.mapping.brand_real_skus, mvp_mock_bom_skus:sync.mapping.mvp_mock_bom_skus, products_without_bom:11 };
});

await check('master data quality gate distinguishes core readiness from brand process gaps', async () => {
  const sync = await json('/api/feishu-sync/state');
  const quality = sync.masterDataQuality;
  if (!quality?.inventory_core_ready) throw new Error(`inventory core should be ready: ${JSON.stringify(quality?.blocking_issues || [])}`);
  if (quality.brand_process_rules_ready) throw new Error('brand process rules must stay disabled until yield, loss and shelf-life are confirmed');
  if (Number(quality.counts?.daily_count) !== 12 || Number(quality.counts?.optional_count) !== 8) throw new Error(`unexpected count scope: ${JSON.stringify(quality.counts)}`);
  if ((quality.process_rule_gaps || []).length !== 3) throw new Error(`expected 3 process-rule gaps, got ${quality.process_rule_gaps?.length || 0}`);
  return { status:quality.status, core_ready:true, process_rules_ready:false, daily_count:quality.counts.daily_count, optional_count:quality.counts.optional_count, process_rule_gaps:quality.process_rule_gaps.map((item) => item.material_name) };
});

await check('new pages are served', async () => {
  const paths = ['/login/', '/hq-login/', '/count-plans/', '/documents/', '/flows/', '/diagnosis-v3/', '/purchase-orders/', '/receipt-orders/', '/procurement-detail/?type=purchase&id=preview', '/voice-qa/?store=STORE001', '/knowledge/', '/knowledge/库存异常判定常用-Knowhow.md', '/store/?store=STORE001', '/work-order/', '/sync/'];
  for (const path of paths) {
    const response = await fetch(`${base}${path}`);
    if (!response.ok) throw new Error(`${path}: ${response.status}`);
  }
  return paths;
});

await check('Feishu sync page exposes a non-blocking manual pipeline', async () => {
  const page = await fetch(`${base}/sync/`).then((response) => response.text());
  for (const token of ['手工同步管道', '立即从飞书同步', '/api/feishu-sync/jobs', 'pollSyncJob', '异步执行']) {
    if (!page.includes(token)) throw new Error(`missing manual sync token: ${token}`);
  }
  return { route:'/sync/', mode:'async_job', polling:true };
});

await check('four-rule showcase supports one prebuilt work order and three diagnosis-only cases', async () => {
  const [worker, workOrder] = await Promise.all([
    readFile(new URL('../src/worker.js', import.meta.url), 'utf8'),
    fetch(`${base}/work-order-page.js`).then((response) => response.text())
  ]);
  for (const token of ['prepare-four-case-showcase', 'PREPARE4:', 'SHOWCASE-FOUR-RULES', 'COUNT_VARIANCE', 'SELL_IN_IMBALANCE', 'D2 · 已创建工单', 'inventoryCases = []', 'materialAnomalies = []', 'inferred_from_legacy_demo', '采纳 D2 建议']) {
    if (!worker.includes(token)) throw new Error(`missing showcase worker token: ${token}`);
  }
  if (!workOrder.includes('执行清单')) throw new Error('work-order page must expose post-creation execution planning');
  return { cases:4, work_orders:1, diagnosis_only:3, rule_codes:['D2', 'D1', 'S1', 'T2'] };
});

await check('inventory V3 merges daily signals into persistent cases', async () => {
  const [page, script, shell, worker, lifecycle, payload] = await Promise.all([
    fetch(`${base}/diagnosis-v3/`).then((response) => response.text()),
    fetch(`${base}/diagnosis-v3-page.js`).then((response) => response.text()),
    fetch(`${base}/app-shell.js`).then((response) => response.text()),
    readFile(new URL('../src/worker.js', import.meta.url), 'utf8'),
    readFile(new URL('../src/diagnosis/lifecycle/inventory-cases.js', import.meta.url), 'utf8'),
    json('/api/inventory-cases')
  ]);
  for (const token of ['持续问题 V3', '一个持续问题只处理一次', '当前问题', '待验证', '历史观察']) if (!page.includes(token)) throw new Error(`missing V3 page token: ${token}`);
  for (const token of ['/api/inventory-cases', '跨营业日观察记录', 'data-toggle-case', 'data-case-id', 'requestedStore', '规则建议行动', '创建跟进工单', 'data-start-work-order', 'data-draft-suggestion', '完成创建工单', '/work-orders', 'portal=hq']) if (!script.includes(token)) throw new Error(`missing V3 interaction token: ${token}`);
  if (!shell.includes('href="/diagnosis-v3/"')) throw new Error('HQ inventory diagnosis navigation must point to V3');
  for (const token of ['refreshInventoryCases', 'existingCaseTask', 'r2AcceptInventoryCaseAction', 'r2CreateInventoryCaseWorkOrder', 'inventoryCaseActions', "searchParams?.get('portal') === 'hq'"]) if (!worker.includes(token)) throw new Error(`missing V3 worker integration token: ${token}`);
  for (const token of ['inventory-case-v3.0', 'recurrence_of_case_id', '|recurrence:', 'refreshInventoryCases']) if (!lifecycle.includes(token)) throw new Error(`missing V3 lifecycle token: ${token}`);
  if (/theoreticalQty < -negativeTolerance \|\| opening_qty/.test(worker)) throw new Error('D2 must not remain triggered only because a historical opening quantity was negative');
  if (payload.contract_version !== 'inventory-case-v3.0' || !Array.isArray(payload.cases)) throw new Error(`invalid V3 contract: ${JSON.stringify(payload).slice(0, 300)}`);
  const keys = payload.cases.map((item) => item.issue_key);
  if (new Set(keys).size !== keys.length) throw new Error('duplicate persistent issue keys returned');
  for (const item of payload.cases) {
    if (!item.id || !item.issue_key || !Array.isArray(item.observations) || !Array.isArray(item.signal_ids)) throw new Error(`invalid case item: ${JSON.stringify(item).slice(0, 300)}`);
    const dates = item.observations.map((observation) => observation.business_date);
    if (dates.some((date, index) => index > 0 && date > dates[index - 1])) throw new Error(`observations are not latest-first for ${item.id}`);
  }
  return { contract:payload.contract_version, cases:payload.cases.length, active:payload.summary?.active || 0, unique_issue_keys:true, recurrence_supported:true };
});

await check('mobile login has a dedicated touch layout', async () => {
  const page = await fetch(`${base}/login/`).then((r) => r.text());
  for (const token of ['viewport-fit=cover', '@media(max-width:720px)', 'min-height:100dvh', 'grid-template-columns:1fr', 'env(safe-area-inset-bottom)', '选择人物进入', 'enter-arrow']) {
    if (!page.includes(token)) throw new Error(`missing mobile login token: ${token}`);
  }
  if (!page.includes('touch-action:manipulation')) throw new Error('mobile login choices and submit action must be touch-friendly');
  if (page.includes('type="password"') || page.includes('账号邮箱')) throw new Error('mobile demo login must not ask for credentials');
  return { breakpoint:720, account_layout:'single-column', direct_identity_select:true, safe_area:true };
});

await check('demo identity selection creates a scoped server session', async () => {
  const optionsResponse = await nativeFetch(`${base}/api/auth/options?portal=mobile`);
  const options = await optionsResponse.json();
  if (!optionsResponse.ok || options.mode !== 'demo_identity_select') throw new Error(`unexpected auth mode: ${options.mode}`);
  const response = await nativeFetch(`${base}/api/auth/demo-login`, { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({ account_id:'ACC-STORE-LI', portal:'mobile' }) });
  const data = await response.json();
  if (!response.ok || !data.account?.role_ids?.includes('store_staff') || !String(data.home).startsWith('/store/')) throw new Error(`direct selection failed: ${JSON.stringify(data)}`);
  if (!(response.headers.get('set-cookie') || '').includes('HttpOnly')) throw new Error('direct selection must issue an HttpOnly session cookie');
  const denied = await nativeFetch(`${base}/api/auth/demo-login`, { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({ account_id:'ACC-HQ-WANG', portal:'mobile' }) });
  if (denied.status !== 403) throw new Error(`mobile portal accepted HQ identity: ${denied.status}`);
  return { mode:options.mode, identity:data.account.display_name, home:data.home, hq_mobile_denied:true };
});

await check('HQ and mobile sessions remain isolated in the same browser', async () => {
  const login = async (accountId, portal) => {
    const response = await nativeFetch(`${base}/api/auth/demo-login`, { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({ account_id:accountId, portal }) });
    if (!response.ok) throw new Error(`${portal} login failed: ${response.status}`);
    const cookie = (response.headers.get('set-cookie') || '').split(';')[0];
    if (!cookie.startsWith(`xlb_demo_${portal === 'hq' ? 'hq' : 'mobile'}_session=`)) throw new Error(`${portal} did not receive an isolated cookie: ${cookie}`);
    return cookie;
  };
  const mobileCookie = await login('ACC-STORE-LI', 'mobile');
  const hqCookie = await login('ACC-HQ-WANG', 'hq');
  const cookie = `${mobileCookie}; ${hqCookie}`;
  const hqRoutes = ['/', '/ledger/', '/flows/', '/diagnosis/', '/diagnosis-v3/', '/simulator/', '/count-plans/', '/purchase-orders/', '/receipt-orders/', '/documents/', '/transfers/', '/sync/', '/notifications/', '/accounts/'];
  for (const path of hqRoutes) {
    const response = await nativeFetch(`${base}${path}`, { headers:{ cookie }, redirect:'manual' });
    if (response.status !== 200) throw new Error(`HQ route ${path} redirected or failed: ${response.status} ${response.headers.get('location') || ''}`);
  }
  const storePage = await nativeFetch(`${base}/store/?store=STORE001`, { headers:{ cookie }, redirect:'manual' });
  if (storePage.status !== 200) throw new Error(`mobile route redirected or failed: ${storePage.status} ${storePage.headers.get('location') || ''}`);
  const hqSession = await nativeFetch(`${base}/api/auth/session`, { headers:{ cookie, referer:`${base}/diagnosis/` } }).then((response) => response.json());
  const mobileSession = await nativeFetch(`${base}/api/auth/session`, { headers:{ cookie, referer:`${base}/store/?store=STORE001` } }).then((response) => response.json());
  if (hqSession.account?.id !== 'ACC-HQ-WANG' || mobileSession.account?.id !== 'ACC-STORE-LI') throw new Error(`portal identity crossed: ${hqSession.account?.id}/${mobileSession.account?.id}`);
  authCookie = cookie;
  return { hq_routes:hqRoutes.length, hq_identity:hqSession.account.display_name, mobile_identity:mobileSession.account.display_name, simultaneous:true };
});

await check('store mobile header identifies the assistant', async () => {
  const [page, transferScript] = await Promise.all([fetch(`${base}/store/?store=STORE001`).then((r) => r.text()), fetch(`${base}/store-transfer-request.js`).then((r) => r.text())]);
  if (!/id="store-header-title"> · 门店助手</.test(page)) throw new Error('store header must identify the page as 门店助手');
  if (/\.header h1[^\n]+今日任务/.test(transferScript) || !/headerTitle\.textContent = ' · 门店助手'/.test(transferScript)) throw new Error('store runtime scripts must not overwrite 门店助手 with 今日任务');
  return { header:'STORE001 · 门店助手' };
});

await check('store vNext keeps reminders, operations and conversational assistant together', async () => {
  const [page, storeScript, appScript, bootstrap] = await Promise.all([
    fetch(`${base}/store/?store=STORE001`).then((r) => r.text()),
    fetch(`${base}/store-agent.js`).then((r) => r.text()),
    fetch(`${base}/app.js`).then((r) => r.text()),
    json('/api/store/bootstrap?store=STORE001')
  ]);
  for (const token of ['今天最重要', '需要你处理', '经营简报', '最近结果', 'data-reminder-filter="mine"', 'data-reminder-filter="result"']) if (!page.includes(token)) throw new Error(`missing store reminder token: ${token}`);
  for (const action of ['restock', 'receipt', 'count', 'transfer', 'scrap', 'inventory']) if (!page.includes(`data-common-action="${action}"`)) throw new Error(`missing store operation: ${action}`);
  if (!page.includes('id="store-agent-chat"') || !page.includes('id="store-agent-input"') || !page.includes('id="store-agent-mic"')) throw new Error('conversational assistant must be preserved');
  if (!storeScript.includes("action === 'inventory'") || !storeScript.includes("ask('查看当前库存')")) throw new Error('inventory query must enter the assistant flow');
  if (!appScript.includes("status === 'pending_store_submission'") || !appScript.includes('问门店助手') || !appScript.includes('window.storeAgentAsk(prompt)')) throw new Error('priority reminders must keep the store user inside the assistant workflow');
  if (appScript.includes('id="operation-ask-agent-btn" href="/work-order/')) throw new Error('store task assistant action must not navigate to the HQ work order page');
  if (!storeScript.includes('window.storeAgentAsk = async')) throw new Error('contextual store assistant entry is missing');
  for (const token of ['当前账号', '上级督导', 'summary-business-date', 'summary-data-note']) if (!page.includes(token)) throw new Error(`missing store accountability or date token: ${token}`);
  if (!appScript.includes("'尚未回传'") || !appScript.includes('available_for_business_date')) throw new Error('sales must not fall back to a misleading zero when the business day has no return');
  if (!appScript.includes('营业日 ${esc(task.business_date')) throw new Error('store work orders must show their business date');
  if (!page.includes('id="operation-task-secondary"') || !appScript.includes('actionableOperationTasks.slice(1)') || !appScript.includes('data-store-operation-submit')) throw new Error('all pending store work orders must render after the single priority task');
  if (bootstrap.businessCalendar?.time_zone !== 'Asia/Jakarta' || bootstrap.businessCalendar?.cutoff_hour !== 4 || bootstrap.businessDate !== bootstrap.businessCalendar.business_date) throw new Error(`invalid business calendar: ${JSON.stringify(bootstrap.businessCalendar)}`);
  if ((bootstrap.ledger || []).some((row) => row.as_of_business_date !== bootstrap.ledger_as_of_business_date || row.is_current_business_date !== bootstrap.ledger_is_current)) throw new Error('ledger freshness metadata is inconsistent');
  if (!bootstrap.feishuImport?.available_for_business_date && bootstrap.feishuImport?.latest_sales_qty !== null) throw new Error('stale sales quantity must be null');
  return { reminder_sections:4, operation_entries:6, conversation_preserved:true, store_assistant_handoff:true, business_date_visible:true, accountability_visible:true, stale_sales_suppressed:true, time_zone:bootstrap.businessCalendar.time_zone, cutoff:bootstrap.businessCalendar.cutoff_time, ledger_as_of:bootstrap.ledger_as_of_business_date, ledger_current:bootstrap.ledger_is_current };
});

await check('follow-up work orders use a traceable full detail page', async () => {
  const [hqPage, hqScript, page, script] = await Promise.all([fetch(`${base}/`).then((r) => r.text()), fetch(`${base}/app.js`).then((r) => r.text()), fetch(`${base}/work-order/`).then((r) => r.text()), fetch(`${base}/work-order-page.js`).then((r) => r.text())]);
  for (const token of ['审计记录与处理时间线', '新增处理记录', '当前操作人', '工单基础信息与判断来源', '关联单据与业务记录']) if (!`${page}\n${script}`.includes(token)) throw new Error(`missing work order detail token: ${token}`);
  for (const token of ['工单内容', '工单原因', '执行目标', '关联研判附件', '执行清单', '处理结果与验证', '完整研判记录', '处理前', '处理后', '实际处理动作', '系统验证', '修正后发现新的问题', 'data-followup-work-order', 'V2 重算记录', 'data-run-page', 'D1 · 理论与实盘差异', 'S1 · 安全库存预警', 'T2 · 销入比失衡', '人工闭环确认', '升级至总部运营', 'follow_up_action']) if (!script.includes(token)) throw new Error(`missing work order workflow token: ${token}`);
  if (/id="operation-drawer"/.test(hqPage)) throw new Error('work order side drawer must be removed from the HQ page');
  if (!/href="\/work-order\/\?portal=hq(?:&amp;|&)id=/.test(hqScript) || !/\/api\/operation-tasks\/\$\{encodeURIComponent\(data\.task\.id\)\}\/notes/.test(script)) throw new Error('HQ full detail navigation or progress note binding missing');
  if (!/class="note-form"/.test(script) || !/\.note-form\{display:grid;gap:13px\}/.test(page) || !/\.layout\{grid-template-columns:1fr\}/.test(page)) throw new Error('work order note form must have a responsive standalone layout');
  return { full_page:true, side_drawer_removed:true, timeline:true, optional_operator:true, progress_notes:true, linked_documents:true };
});

await check('D1/D2/S1/T2 V2 preview is a read-only shadow comparison', async () => {
  const [page, script, shadow] = await Promise.all([
    fetch(`${base}/diagnosis/`).then((r) => r.text()),
    fetch(`${base}/diagnosis-page.js`).then((r) => r.text()),
    json('/api/diagnosis-v2/shadow')
  ]);
  if (!page.includes('规则 V2 对照·预览') || !page.includes('v2-shadow-panel')) throw new Error('V2 preview entry is missing');
  if (!script.includes('查看 V2 推演') || !script.includes('/api/diagnosis-v2/shadow')) throw new Error('per-case V2 preview binding is missing');
  if (!script.includes('已有直接证据') || !script.includes('系统已接入，历史覆盖不完整') || !script.includes('evidence_gaps')) throw new Error('V2 user-facing enum translations or evidence gap classifications are missing');
  if (shadow.mode !== 'shadow' || shadow.writable !== false || shadow.creates_work_orders !== false) throw new Error(`unsafe shadow flags: ${JSON.stringify(shadow)}`);
  if (!Array.isArray(shadow.comparisons) || shadow.ruleset?.status !== 'shadow' || !['NEGATIVE_THEORETICAL','COUNT_VARIANCE','BELOW_SAFETY_STOCK','SELL_IN_IMBALANCE'].every((code) => code in (shadow.counts_by_rule || {}))) throw new Error('four-rule shadow response contract is incomplete');
  return { mode:shadow.mode, writable:shadow.writable, creates_work_orders:shadow.creates_work_orders, comparisons:shadow.comparison_count };
});

await check('dense operation pages use focused tabs and voice has an immersive overlay', async () => {
  const [counts, transfers, transferScript, store, storeScript] = await Promise.all([
    fetch(`${base}/count-plans/`).then((r) => r.text()), fetch(`${base}/transfers/`).then((r) => r.text()), fetch(`${base}/transfers-page.js`).then((r) => r.text()), fetch(`${base}/store/?store=STORE001`).then((r) => r.text()), fetch(`${base}/store-agent.js`).then((r) => r.text())
  ]);
  if ((counts.match(/data-count-tab=/g) || []).length !== 3 || !/data-count-panel="plans"/.test(counts)) throw new Error('count plans must use three focused tabs');
  if ((transfers.match(/data-transfer-tab=/g) || []).length !== 2 || !/data-transfer-source="demo"/.test(transfers)) throw new Error('transfer management tabs or source filter missing');
  if (/门店库存流水档案/.test(`${transfers}\n${transferScript}`) || /archive-rows/.test(transferScript)) throw new Error('duplicate transfer flow archive must be removed');
  if (!/agent-voice-overlay/.test(store) || !/voiceOverlay.*classList\.add\('show','recording'\)/s.test(storeScript)) throw new Error('store voice input needs an immersive recording overlay');
  if (!/\.agent-input-area\s*\{[^}]*position:fixed/s.test(store)) throw new Error('mobile assistant input must stay fixed above the bottom navigation');
  if (!/\.agent-voice-overlay\.show\s*\{[^}]*pointer-events:auto/s.test(store)) throw new Error('voice overlay must intercept touches while visible');
  if (!/store-agent-voice-cancel/.test(store) || !/store-agent-voice-finish/.test(store)) throw new Error('voice overlay needs explicit cancel and finish actions');
  if (!/voicePermissionPending/.test(storeScript) || /stopVoiceRequested/.test(storeScript)) throw new Error('voice permission flow can stop recording prematurely');
  if (!/requestMicrophone\(timeoutMs = 12000\)/.test(storeScript) || !/TimeoutError/.test(storeScript)) throw new Error('microphone permission request must have a timeout fallback');
  if (!/if \(speaking\) \{ if \(voicePermissionPending\) cancelVoice\(\); else stopVoice\(\); \}/.test(storeScript)) throw new Error('pending microphone permission must be cancellable from the microphone control');
  if (/mic\.addEventListener\('pointerdown'/.test(storeScript)) throw new Error('voice recording should not rely on press-and-release timing');
  if ((store.match(/class="agent-icon-btn/g) || []).length < 2 || (store.match(/class="agent-icon-btn[^>]*>[\s\S]*?<svg/g) || []).length < 2) throw new Error('voice and send controls must share the same icon system');
  if (!/voiceOverlay\?\.classList\.remove\('show','recording'\); releaseVoiceStream\(\);\s*await ask\(transcript,/s.test(storeScript)) throw new Error('voice overlay must close before waiting for the assistant response');
  return { count_tabs:3, transfer_tabs:2, transfer_archive_removed:true, immersive_voice:true, mobile_input_fixed:true, permission_flow_guarded:true, consistent_input_icons:true, prompt_overlay_dismissal:true };
});

await check('growing lists use pagination and lightweight API views', async () => {
  const [shell, flowsPage, documentsPage, plansPage, diagnosisPage, simulatorPage, transfersPage, purchasePage, receiptPage] = await Promise.all([
    fetch(`${base}/app-shell.js`).then((r) => r.text()), fetch(`${base}/flows/`).then((r) => r.text()),
    fetch(`${base}/documents/`).then((r) => r.text()), fetch(`${base}/count-plans/`).then((r) => r.text()),
    fetch(`${base}/diagnosis/`).then((r) => r.text()), fetch(`${base}/simulator/`).then((r) => r.text()),
    fetch(`${base}/transfers/`).then((r) => r.text()), fetch(`${base}/purchase-orders/`).then((r) => r.text()), fetch(`${base}/receipt-orders/`).then((r) => r.text())
  ]);
  if (!shell.includes('window.ListPager')) throw new Error('shared pager is missing');
  for (const [name, html, marker] of [['flows',flowsPage,'flow-pager'],['documents',documentsPage,'document-pager'],['plans',plansPage,'count-plan-pager'],['diagnosis',diagnosisPage,'diagnosis-pager'],['simulator',simulatorPage,'simulator-pager'],['transfers',transfersPage,'demo-transfer-pager'],['purchase',purchasePage,'id="pager"'],['receipt',receiptPage,'id="pager"']]) if (!html.includes(marker)) throw new Error(`${name} pagination marker missing`);
  const [plans, documents, flows, diagnosis, simulator, transfers, ledger, hqInventory] = await Promise.all([
    json('/api/state?view=count-plans'), json('/api/state?view=documents'), json('/api/feishu-sync/state?view=flows'),
    json('/api/feishu-sync/state?view=diagnosis'), json('/api/feishu-sync/state?view=simulator'), json('/api/feishu-sync/state?view=transfers'),
    json('/api/feishu-sync/state?view=ledger'), json('/api/feishu-sync/state?view=hq-inventory')
  ]);
  if (!Array.isArray(plans.countPlans) || !Array.isArray(documents.materialEvents)) throw new Error('state projections missing required collections');
  if (!Array.isArray(ledger.storeViews) || !Array.isArray(hqInventory.storeViews)) throw new Error('inventory projections missing store views');
  if ('productCatalog' in documents || 'documents' in documents || 'storeViews' in diagnosis || 'materialAnomalies' in flows || 'ledgerSnapshots' in simulator || 'materialEvents' in ledger || 'r2Import' in hqInventory && 'sales' in (hqInventory.r2Import || {})) throw new Error('projection leaked unrelated heavyweight collections');
  const sizes = Object.fromEntries(Object.entries({ plans,documents,flows,diagnosis,simulator,transfers,ledger,hqInventory }).map(([key,value]) => [key, JSON.stringify(value).length]));
  return { paged_pages:8, projection_sizes:sizes };
});

await check('store HTML exposes three speech languages and safe fallback', async () => {
  const [page, script, voiceQaScript] = await Promise.all([fetch(`${base}/store/?store=STORE001`).then((r) => r.text()), fetch(`${base}/store-agent.js`).then((r) => r.text()), fetch(`${base}/voice-qa-page.js`).then((r) => r.text())]);
  for (const token of ['agent-language', 'value="auto" selected', 'zh-CN', 'en-US', 'id-ID']) if (!page.includes(token)) throw new Error(`missing ${token} in store page`);
  if (!/id="store-agent-settings-toggle"/.test(page) || !/id="store-agent-voice-settings" hidden/.test(page)) throw new Error('voice language selection must live in a hidden assistant-header settings panel');
  if (/class="agent-helper"/.test(page) || /语音自动识别中文、English 和 Bahasa Indonesia/.test(page)) throw new Error('legacy scrolling voice settings must be removed from the store UI');
  if (!/voiceSettingsToggle\?\.addEventListener/.test(script) || !/voiceSettings\.hidden/.test(script)) throw new Error('assistant-header voice settings must support explicit open and close interactions');
  if (!/MediaRecorder/.test(script) || !/\/api\/voice-transcribe/.test(script) || !/selectedLang !== 'auto'/.test(script)) throw new Error('store assistant must use recorded audio and automatic server ASR by default');
  if (!/不可用|unavailable|tidak tersedia/i.test(`${page}\n${script}`)) throw new Error('speech fallback message missing');
  if (!/not-allowed/.test(script) || !/no-speech/.test(script) || !/Akses mikrofon belum diizinkan/.test(script)) throw new Error('localized speech error handling missing');
  if (!/probeMicrophone/.test(voiceQaScript) || !/TimeoutError/.test(voiceQaScript) || !/Chrome 或 Edge/.test(voiceQaScript)) throw new Error('microphone capability check needs a bounded timeout and browser fallback');
  if (!/MediaRecorder/.test(voiceQaScript) || !/\/api\/voice-transcribe/.test(voiceQaScript) || !/停止并转写/.test(voiceQaScript) || !/whisper-large-v3-turbo/.test(voiceQaScript)) throw new Error('voice QA must use recorded audio and server ASR');
  if (!/播放标准读音/.test(voiceQaScript) || !/stor nol nol dua/.test(voiceQaScript) || !/speechSynthesis/.test(voiceQaScript)) throw new Error('Indonesian QA must provide a standard pronunciation aid');
  const shortAudio = await fetch(`${base}/api/voice-transcribe?lang=en-US`, { method:'POST', headers:{ 'content-type':'audio/webm' }, body:new Uint8Array([1,2,3]) });
  const shortAudioPayload = await shortAudio.json();
  if (shortAudio.status !== 400 || !/过短/.test(shortAudioPayload.error || '')) throw new Error(`voice endpoint validation failed: ${shortAudio.status} ${JSON.stringify(shortAudioPayload)}`);
  return { languages:['auto','zh-CN','en-US','id-ID'], default_language:'auto', speech_binding:true, text_fallback:true, localized_errors:true, microphone_probe_timeout:true, server_asr:true };
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
    const date = (await json('/api/store/bootstrap?store=STORE001')).businessDate;
    const value = await json('/api/count-plans/manual', { method:'POST', headers:{ 'content-type':'application/json' }, body:JSON.stringify({ store_code:'STORE001', business_date:date, material_names:['牛奶','黑糖珍珠'], source_type:'work_order', source_work_order_id:'QA-WO-001', instruction:'自动回归：仅本地状态' }) });
    if (value.plan?.material_count !== 2 || value.plan?.plan_type !== 'work_order_material_set') throw new Error(JSON.stringify(value.plan));
    manualPlan = value.plan;
    return { plan_no:value.plan.plan_no, materials:value.plan.material_count };
  });

  await check('count photo review requires confirmation and completes plan', async () => {
    if (!manualPlan?.plan_no) throw new Error('manual plan was not created');
    const uploaded = await json('/api/count-photo-recognition', { method:'POST', headers:{ 'content-type':'application/json' }, body:JSON.stringify({ planNo:manualPlan.plan_no, filename:'qa-count.png', previewData:'data:image/png;base64,iVBORw0KGgo=' }) });
    if (!uploaded.review?.id || uploaded.review.lines?.length !== 2 || uploaded.review.needs_confirmation_count !== 2) throw new Error(JSON.stringify(uploaded.review));
    const actuals = Object.fromEntries(uploaded.review.lines.map((line, index) => [`${line.material_name}|${line.unit}`, index + 1]));
    const confirmed = await json('/api/count-photo-recognition/confirm', { method:'POST', headers:{ 'content-type':'application/json' }, body:JSON.stringify({ reviewId:uploaded.review.id, actuals }) });
    const plan = (confirmed.countPlans || []).find((item) => item.plan_no === manualPlan.plan_no);
    const document = (confirmed.documents || []).find((item) => item.count_plan_no === manualPlan.plan_no);
    if (plan?.status !== 'pending_hq_review' || !document || document.lines?.length !== 2) throw new Error(`plan=${JSON.stringify(plan)} document=${JSON.stringify(document)}`);
    return { plan_no:plan.plan_no, status:plan.status, document_id:document.id, line_count:document.lines.length };
  });

  await check('receipt and scrap flows create traceable documents and can be reverted', async () => {
    const date = (await json('/api/store/bootstrap?store=STORE001')).businessDate;
    const receiptState = await json('/api/material-events', { method:'POST', headers:{ 'content-type':'application/json' }, body:JSON.stringify({ store_code:'STORE001', business_date:date, material_name:'牛奶', unit:'L', qty:3, type:'receipt', reference:'QA receipt' }) });
    const receipt = (receiptState.materialEvents || []).find((item) => item.reference === 'QA receipt');
    const scrapState = await json('/api/material-events', { method:'POST', headers:{ 'content-type':'application/json' }, body:JSON.stringify({ store_code:'STORE001', business_date:date, material_name:'牛奶', unit:'L', qty:0.5, type:'scrap', reference:'QA scrap' }) });
    const scrap = (scrapState.materialEvents || []).find((item) => item.reference === 'QA scrap');
    if (!receipt?.document_no?.startsWith('RK-') || !scrap?.document_no?.startsWith('SC-') || receipt.status !== 'active' || scrap.status !== 'active') throw new Error(`receipt=${JSON.stringify(receipt)} scrap=${JSON.stringify(scrap)}`);
    const receiptReverted = await json(`/api/material-events/${receipt.id}/revert`, { method:'POST' });
    const scrapReverted = await json(`/api/material-events/${scrap.id}/revert`, { method:'POST' });
    if ((receiptReverted.materialEvents || []).find((item) => item.id === receipt.id)?.status !== 'reverted' || (scrapReverted.materialEvents || []).find((item) => item.id === scrap.id)?.status !== 'reverted') throw new Error('event revert status mismatch');
    return { receipt_no:receipt.document_no, scrap_no:scrap.document_no, final_status:'reverted' };
  });

  await check('follow-up work order supports proof and closure', async () => {
    const created = await json('/api/operation-tasks', { method:'POST', headers:{ 'content-type':'application/json' }, body:JSON.stringify({ storeCode:'STORE001', title:'QA 库存核查', instruction:'核对收货与盘点凭证', taskType:'qa_regression' }) });
    const task = created.operationTask;
    if (!task?.id || task.status !== 'pending_store_submission') throw new Error(JSON.stringify(task));
    const noted = await json(`/api/operation-tasks/${task.id}/notes`, { method:'POST', headers:{ 'content-type':'application/json' }, body:JSON.stringify({ operator:'', note:'QA 已核对当日收货与盘点记录' }) });
    const notedTask = (noted.operationTasks || []).find((item) => item.id === task.id);
    if (notedTask?.activity_log?.[0]?.note !== 'QA 已核对当日收货与盘点记录' || notedTask.activity_log[0].operator !== null) throw new Error(JSON.stringify(notedTask));
    const detail = await json(`/api/operation-tasks/${task.id}`);
    if (detail.task?.id !== task.id || !(detail.audits || []).some((item) => item.action === '更新工单进展')) throw new Error(`work order detail mismatch: ${JSON.stringify(detail)}`);
    const submitted = await json(`/api/operation-tasks/${task.id}/submit`, { method:'POST', headers:{ 'content-type':'application/json' }, body:JSON.stringify({ filename:'qa-proof.png', previewData:'data:image/png;base64,iVBORw0KGgo=' }) });
    const submittedTask = (submitted.operationTasks || []).find((item) => item.id === task.id);
    if (submittedTask?.status !== 'pending_hq_review' || !submittedTask.proof_document_id) throw new Error(JSON.stringify(submittedTask));
    const closed = await json(`/api/operation-tasks/${task.id}/close`, { method:'POST', headers:{ 'content-type':'application/json' }, body:JSON.stringify({ outcome:'resolved', final_cause:'QA 已确认凭证完整', resolution_note:'完成核对并保留审计记录', operator:'QA 总部运营', store_adopted:true, hq_confirmed:true }) });
    const closedTask = (closed.operationTasks || []).find((item) => item.id === task.id);
    if (closedTask?.status !== 'closed' || !closedTask.closed_at || closedTask.closure?.operator !== 'QA 总部运营') throw new Error(JSON.stringify(closedTask));
    const retryCreated = await json('/api/operation-tasks', { method:'POST', headers:{ 'content-type':'application/json' }, body:JSON.stringify({ storeCode:'STORE001', title:'QA 未解决升级', instruction:'验证重新打开与升级', taskType:'qa_regression' }) });
    const retryTask = retryCreated.operationTask;
    await json(`/api/operation-tasks/${retryTask.id}/notes`, { method:'POST', headers:{ 'content-type':'application/json' }, body:JSON.stringify({ operator:'QA 门店', note:'门店核查后仍未解决' }) });
    const escalated = await json(`/api/operation-tasks/${retryTask.id}/close`, { method:'POST', headers:{ 'content-type':'application/json' }, body:JSON.stringify({ outcome:'unresolved', follow_up_action:'escalate_hq', final_cause:'门店证据不足', resolution_note:'升级总部库存运营继续排查', operator:'QA 总部运营', store_adopted:false, hq_confirmed:true }) });
    const escalatedTask = (escalated.operationTasks || []).find((item) => item.id === retryTask.id);
    if (escalatedTask?.status !== 'pending_hq_review' || escalatedTask.assigned_to !== '总部库存运营' || escalatedTask.escalation_level !== 'escalate_hq' || escalatedTask.closure_attempts?.length !== 1) throw new Error(JSON.stringify(escalatedTask));
    const [hqView, storeView] = await Promise.all([json('/api/state'), json('/api/store/bootstrap?store=STORE001')]);
    if ((hqView.operationTasks || []).some((item) => item.task_type === 'qa_regression')) throw new Error('QA tasks leaked into headquarters business list');
    if ((storeView.operationTasks || []).some((item) => item.task_type === 'qa_regression')) throw new Error('QA tasks leaked into store business list');
    return { task_id:task.id, status:closedTask.status, proof_document_id:submittedTask.proof_document_id, timeline_entries:closedTask.activity_log?.length || 0, closure:closedTask.closure, escalation:{ task_id:retryTask.id, status:escalatedTask.status, assigned_to:escalatedTask.assigned_to } };
  });

  await check('inventory Knowhow can be saved and read from R2', async () => {
    const saved = await json('/api/diagnosis-knowhow', { method:'POST', headers:{ 'content-type':'application/json' }, body:JSON.stringify({ title:'QA 库存异常知识', source_filename:'qa-knowhow.md', content_markdown:'# QA\n仅用于自动化验证。' }) });
    if (!saved.knowhow?.id) throw new Error(JSON.stringify(saved));
    const read = await json('/api/diagnosis-knowhow');
    if (!(read.knowhow || []).some((item) => item.id === saved.knowhow.id && item.title === 'QA 库存异常知识')) throw new Error('saved Knowhow not found');
    return { id:saved.knowhow.id, title:saved.knowhow.title };
  });

  await check('invalid inventory event is rejected without a write', async () => {
    const before = await json('/api/state');
    const eventCount = (before.materialEvents || []).length;
    const rejected = await expectStatus('/api/material-events', 400, { method:'POST', headers:{ 'content-type':'application/json' }, body:JSON.stringify({ store_code:'STORE001', material_name:'牛奶', unit:'L', qty:-1, type:'scrap' }) });
    const after = await json('/api/state');
    if ((after.materialEvents || []).length !== eventCount) throw new Error('invalid event changed inventory state');
    return { error:rejected.error, unchanged_events:eventCount };
  });

  await check('restock request requires confirmation and does not alter inventory', async () => {
    await expectStatus('/api/store-restock-requests', 409, { method:'POST', headers:{ 'content-type':'application/json' }, body:JSON.stringify({ store_code:'STORE001', material_name:'牛奶', unit:'L', qty:10 }) });
    const before = await json('/api/state');
    const eventCount = (before.materialEvents || []).length;
    const created = await json('/api/store-restock-requests', { method:'POST', headers:{ 'content-type':'application/json' }, body:JSON.stringify({ confirmed:true, store_code:'STORE001', material_name:'牛奶', unit:'L', qty:10, urgency:'urgent', reason:'QA 补货验证' }) });
    const after = await json('/api/state');
    if (created.request?.status !== 'pending_hq_review' || (after.materialEvents || []).length !== eventCount) throw new Error(`request=${JSON.stringify(created.request)} events=${(after.materialEvents || []).length}`);
    return { request_no:created.request.request_no, status:created.request.status, inventory_unchanged:true };
  });

  await check('notification settings persist and preview fails safely without webhook', async () => {
    const current = await json('/api/notifications/config');
    const settings = { ...current.settings, realtime:{ ...current.settings.realtime, enabled:false }, daily_report:{ ...current.settings.daily_report, enabled:false, send_time:'20:30' } };
    const updated = await json('/api/notifications/config', { method:'POST', headers:{ 'content-type':'application/json' }, body:JSON.stringify(settings) });
    if (updated.settings?.daily_report?.send_time !== '20:30' || updated.settings?.realtime?.enabled !== false) throw new Error(JSON.stringify(updated.settings));
    const preview = await expectStatus('/api/notifications/preview', 409, { method:'POST', headers:{ 'content-type':'application/json' }, body:JSON.stringify({ kind:'daily' }) });
    if (preview.delivered !== false || !preview.reason) throw new Error(JSON.stringify(preview));
    return { send_time:updated.settings.daily_report.send_time, delivered:preview.delivered, reason:preview.reason };
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

await check('Chinese multi-material inventory query', async () => {
  const value = await ask({ message:'给我查询一下牛奶和黑糖珍珠两个物料的库存' });
  const items = value.action?.data?.items || [];
  if (value.action?.type !== 'show_inventory' || items.length !== 2) throw new Error(JSON.stringify(value));
  if (!items.some((item) => item.material_name === '牛奶') || !items.some((item) => item.material_name === '黑糖珍珠')) throw new Error(JSON.stringify(items));
  if (!value.reply.includes('牛奶') || !value.reply.includes('黑糖珍珠')) throw new Error(value.reply);
  return { materials:items.map((item) => item.material_name), lines:value.reply.split('\n').length };
});

await check('English multi-material inventory query', async () => {
  const value = await ask({ message:'Check milk and brown sugar pearl inventory', lang:'en-US' });
  const items = value.action?.data?.items || [];
  if (value.action?.type !== 'show_inventory' || items.length !== 2) throw new Error(JSON.stringify(value));
  return { materials:items.map((item) => item.material_name) };
});

await check('Indonesian inventory query', async () => {
  const value = await ask({ message:'Cek stok susu', lang:'id-ID' });
  if (value.action?.type !== 'show_inventory') throw new Error(JSON.stringify(value.action));
  return value.action;
});

await check('English and Indonesian welcome replies never render undefined', async () => {
  const english = await ask({ message:'__welcome__', lang:'en-US' });
  const indonesian = await ask({ message:'__welcome__', lang:'id-ID' });
  for (const [label, value] of [['English', english], ['Indonesian', indonesian]]) {
    if (typeof value.reply !== 'string' || !value.reply.trim() || /undefined|null/i.test(value.reply)) throw new Error(`${label}: ${JSON.stringify(value)}`);
  }
  return { english:english.reply, indonesian:indonesian.reply };
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
