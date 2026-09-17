const base = (process.env.BASE_URL || 'http://127.0.0.1:8787').replace(/\/$/, '');
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
  const paths = ['/count-plans/', '/documents/', '/flows/', '/voice-qa/?store=STORE001', '/knowledge/', '/knowledge/库存异常判定常用-Knowhow.md', '/store/?store=STORE001', '/work-order/'];
  for (const path of paths) {
    const response = await fetch(`${base}${path}`);
    if (!response.ok) throw new Error(`${path}: ${response.status}`);
  }
  return paths;
});

await check('store mobile header identifies the assistant', async () => {
  const [page, transferScript] = await Promise.all([fetch(`${base}/store/?store=STORE001`).then((r) => r.text()), fetch(`${base}/store-transfer-request.js`).then((r) => r.text())]);
  if (!/id="store-header-title"> · 门店助手</.test(page)) throw new Error('store header must identify the page as 门店助手');
  if (/\.header h1[^\n]+今日任务/.test(transferScript) || !/headerTitle\.textContent = ' · 门店助手'/.test(transferScript)) throw new Error('store runtime scripts must not overwrite 门店助手 with 今日任务');
  return { header:'STORE001 · 门店助手' };
});

await check('follow-up work orders use a traceable full detail page', async () => {
  const [hqPage, hqScript, page, script] = await Promise.all([fetch(`${base}/`).then((r) => r.text()), fetch(`${base}/app.js`).then((r) => r.text()), fetch(`${base}/work-order/`).then((r) => r.text()), fetch(`${base}/work-order-page.js`).then((r) => r.text())]);
  for (const token of ['处理时间线', '新增处理记录', '当前操作人', '来源与判断记录', '关联单据与业务记录']) if (!`${page}\n${script}`.includes(token)) throw new Error(`missing work order detail token: ${token}`);
  if (/id="operation-drawer"/.test(hqPage)) throw new Error('work order side drawer must be removed from the HQ page');
  if (!/href="\/work-order\/\?id=/.test(hqScript) || !/\/api\/operation-tasks\/\$\{encodeURIComponent\(data\.task\.id\)\}\/notes/.test(script)) throw new Error('full detail navigation or progress note binding missing');
  if (!/class="note-form"/.test(script) || !/\.note-form\{display:grid;gap:13px\}/.test(page) || !/\.layout\{grid-template-columns:1fr\}/.test(page)) throw new Error('work order note form must have a responsive standalone layout');
  return { full_page:true, side_drawer_removed:true, timeline:true, optional_operator:true, progress_notes:true, linked_documents:true };
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
  if (/mic\.addEventListener\('pointerdown'/.test(storeScript)) throw new Error('voice recording should not rely on press-and-release timing');
  if ((store.match(/class="agent-icon-btn/g) || []).length < 2 || (store.match(/class="agent-icon-btn[^>]*>[\s\S]*?<svg/g) || []).length < 2) throw new Error('voice and send controls must share the same icon system');
  if (!/voiceOverlay\?\.classList\.remove\('show','recording'\); releaseVoiceStream\(\);\s*await ask\(transcript,/s.test(storeScript)) throw new Error('voice overlay must close before waiting for the assistant response');
  return { count_tabs:3, transfer_tabs:2, transfer_archive_removed:true, immersive_voice:true, mobile_input_fixed:true, permission_flow_guarded:true, consistent_input_icons:true, prompt_overlay_dismissal:true };
});

await check('growing lists use pagination and lightweight API views', async () => {
  const [shell, flowsPage, documentsPage, plansPage, diagnosisPage, simulatorPage, transfersPage] = await Promise.all([
    fetch(`${base}/app-shell.js`).then((r) => r.text()), fetch(`${base}/flows/`).then((r) => r.text()),
    fetch(`${base}/documents/`).then((r) => r.text()), fetch(`${base}/count-plans/`).then((r) => r.text()),
    fetch(`${base}/diagnosis/`).then((r) => r.text()), fetch(`${base}/simulator/`).then((r) => r.text()),
    fetch(`${base}/transfers/`).then((r) => r.text())
  ]);
  if (!shell.includes('window.ListPager')) throw new Error('shared pager is missing');
  for (const [name, html, marker] of [['flows',flowsPage,'flow-pager'],['documents',documentsPage,'document-pager'],['plans',plansPage,'count-plan-pager'],['diagnosis',diagnosisPage,'diagnosis-pager'],['simulator',simulatorPage,'simulator-pager'],['transfers',transfersPage,'demo-transfer-pager']]) if (!html.includes(marker)) throw new Error(`${name} pagination marker missing`);
  const [plans, documents, flows, diagnosis, simulator, transfers, ledger, hqInventory] = await Promise.all([
    json('/api/state?view=count-plans'), json('/api/state?view=documents'), json('/api/feishu-sync/state?view=flows'),
    json('/api/feishu-sync/state?view=diagnosis'), json('/api/feishu-sync/state?view=simulator'), json('/api/feishu-sync/state?view=transfers'),
    json('/api/feishu-sync/state?view=ledger'), json('/api/feishu-sync/state?view=hq-inventory')
  ]);
  if (!Array.isArray(plans.countPlans) || !Array.isArray(documents.materialEvents)) throw new Error('state projections missing required collections');
  if (!Array.isArray(ledger.storeViews) || !Array.isArray(hqInventory.storeViews)) throw new Error('inventory projections missing store views');
  if ('productCatalog' in documents || 'documents' in documents || 'storeViews' in diagnosis || 'materialAnomalies' in flows || 'ledgerSnapshots' in simulator || 'materialEvents' in ledger || 'r2Import' in hqInventory && 'sales' in (hqInventory.r2Import || {})) throw new Error('projection leaked unrelated heavyweight collections');
  const sizes = Object.fromEntries(Object.entries({ plans,documents,flows,diagnosis,simulator,transfers,ledger,hqInventory }).map(([key,value]) => [key, JSON.stringify(value).length]));
  return { paged_pages:6, projection_sizes:sizes };
});

await check('store HTML exposes three speech languages and safe fallback', async () => {
  const [page, script, voiceQaScript] = await Promise.all([fetch(`${base}/store/?store=STORE001`).then((r) => r.text()), fetch(`${base}/store-agent.js`).then((r) => r.text()), fetch(`${base}/voice-qa-page.js`).then((r) => r.text())]);
  for (const token of ['agent-language', 'value="auto" selected', 'zh-CN', 'en-US', 'id-ID']) if (!page.includes(token)) throw new Error(`missing ${token} in store page`);
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
    const date = new Intl.DateTimeFormat('en-CA', { timeZone:'Asia/Shanghai' }).format(new Date());
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
    const date = new Intl.DateTimeFormat('en-CA', { timeZone:'Asia/Shanghai' }).format(new Date());
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
    const closed = await json(`/api/operation-tasks/${task.id}/close`, { method:'POST' });
    const closedTask = (closed.operationTasks || []).find((item) => item.id === task.id);
    if (closedTask?.status !== 'closed' || !closedTask.closed_at) throw new Error(JSON.stringify(closedTask));
    return { task_id:task.id, status:closedTask.status, proof_document_id:submittedTask.proof_document_id, timeline_entries:closedTask.activity_log?.length || 0 };
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
