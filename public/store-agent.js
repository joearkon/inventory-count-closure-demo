(() => {
  if (!document.body.matches('[data-view="store"]')) return;
  const by = (id) => document.getElementById(id);
  const esc = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' }[char]));
  const storeCode = new URLSearchParams(location.search).get('store') || 'STORE001';
  const sessionKey = `store-agent-session:${storeCode}`;
  const sessionId = sessionStorage.getItem(sessionKey) || (() => { const value = `web-${crypto.randomUUID()}`; sessionStorage.setItem(sessionKey, value); return value; })();
  const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(new Date());
  const chat = by('store-agent-chat'), input = by('store-agent-input'), send = by('store-agent-send'), mic = by('store-agent-mic'), voiceNote = by('store-agent-voice-note'), voiceOverlay = by('store-agent-voice-overlay'), voiceOverlayTitle = by('store-agent-voice-overlay-title'), voiceOverlayText = by('store-agent-voice-overlay-text'), voiceCancel = by('store-agent-voice-cancel'), voiceFinish = by('store-agent-voice-finish'), language = by('store-agent-language'), voiceQa = by('store-agent-voice-qa');
  if (voiceQa) voiceQa.href = `/voice-qa/?store=${encodeURIComponent(storeCode)}`;
  const sheet = by('agent-sheet'), sheetTitle = by('agent-sheet-title'), sheetForm = by('agent-sheet-form'), sheetStatus = by('agent-sheet-status'), sheetSubmit = by('agent-sheet-submit');
  let welcomed = false, busy = false, speaking = false, voicePermissionPending = false, discardVoice = false, mediaRecorder = null, activeVoiceStream = null, voiceChunks = [], ledger = [], draft = null, latestStoreState = null;
  fetch('/api/auth/session').then(async (response) => {
    if (response.status === 401) { location.href = `/login/?next=${encodeURIComponent(location.pathname + location.search)}`; return null; }
    return response.json();
  }).then((session) => { if (session?.account && by('store-header-user')) by('store-header-user').textContent = session.account.display_name; }).catch(() => { if (by('store-header-user')) by('store-header-user').textContent = '已登录'; });
  if (by('store-logout')) by('store-logout').onclick = async () => { await fetch('/api/auth/logout', { method:'POST' }).catch(() => null); location.href = '/login/'; };

  function addMessage(text, role = 'assistant', html = false) {
    const node = document.createElement('div'); node.className = `agent-message ${role}`;
    if (role === 'assistant') { const caption = document.createElement('span'); caption.className = 'agent-caption'; caption.textContent = '门店助手'; node.append(caption); }
    const content = document.createElement('span'); if (html) content.innerHTML = text; else content.textContent = text; node.append(content);
    chat.append(node); chat.scrollTop = chat.scrollHeight; return node;
  }
  function renderTodayTasks(tasks) {
    if (!Array.isArray(tasks) || !tasks.length) return;
    const labels = { count: '协助完成盘点', transfer_receipt: '确认收货', operation: '查看任务' };
    const rows = tasks.map((task) => {
      const action = task.action || {}; const prefill = action.prefill || {};
      return `<div class="agent-confirm"><b>${esc(task.title || '今日待办')}</b><p>${esc(task.detail || '')}</p><button class="btn btn-primary" type="button" data-agent-task-action="${esc(action.type || '')}" data-agent-task-plan="${esc(prefill.plan_no || '')}" data-agent-task-request="${esc(prefill.request_id || '')}" data-agent-task-direction="${esc(prefill.direction || '')}">${labels[task.type] || '处理待办'}</button></div>`;
    }).join('');
    addMessage(`<div><b>今日待办</b>${rows}</div>`, 'assistant', true);
  }
  function setBusy(next) { busy = next; send.disabled = next; send.textContent = next ? '…' : '➤'; }
  function resizeInput() { input.style.height = 'auto'; input.style.height = `${Math.min(input.scrollHeight, 80)}px`; }
  async function loadLedger() {
    try { const state = window.loadStoreBootstrap ? await window.loadStoreBootstrap() : await (await fetch(`/api/store/bootstrap?store=${encodeURIComponent(storeCode)}`, { cache: 'no-store' })).json(); ledger = state.ledger || []; latestStoreState = state; renderRecentOperations(state); return state; } catch (_) { return { ledger }; }
  }
  function renderRecentOperations(state) {
    const slot = by('store-recent-records'); if (!slot) return;
    const date = state.businessDate || today(); const entries = [];
    (state.storeTransferRequests || []).filter((item) => item.business_date === date).forEach((item) => entries.push({ at:item.received_at || item.created_at, icon:'🔄', title:item.from_store_code === storeCode ? `调出至 ${item.to_store_code}` : `调入自 ${item.from_store_code}`, meta:`${item.material_name} ${item.actual_received_qty ?? item.qty}${item.unit}`, status:item.status === 'received' ? '已完成' : '待收货', pending:item.status !== 'received' }));
    (state.materialEvents || []).filter((item) => item.business_date === date && ['scrap','receipt'].includes(item.type)).forEach((item) => entries.push({ at:item.created_at, icon:item.type === 'scrap' ? '🗑️' : '📦', title:item.type === 'scrap' ? `报损：${item.material_name} ${item.qty}${item.unit}` : `收货：${item.material_name} ${item.qty}${item.unit}`, meta:item.reference || date, status:'已完成', pending:false }));
    (state.documents || []).filter((item) => item.business_date === date && item.document_type === 'inventory_count').forEach((item) => entries.push({ at:item.received_at, icon:'📷', title:'每日盘点', meta:item.original_filename || '盘点照片已归档', status:'已完成', pending:false }));
    entries.sort((a,b) => String(b.at || '').localeCompare(String(a.at || '')));
    slot.innerHTML = entries.slice(0, 4).map((item) => `<div class="store-recent-row"><span class="store-recent-icon">${item.icon}</span><div><div class="store-recent-title">${esc(item.title)}</div><div class="store-recent-meta">${esc(item.meta)}</div></div><span class="store-recent-status ${item.pending ? 'pending' : ''}">${esc(item.status)}</span></div>`).join('') || '<div class="store-recent-empty">暂无主动运营记录</div>';
  }
  function normalize(value) { return String(value || '').toLowerCase().replace(/[\s\-_/，,。]/g, ''); }
  function materialFrom(text) { const source = normalize(text); return ledger.find((row) => source.includes(normalize(row.material_name))) || null; }
  function slotsFrom(text) {
    const material = materialFrom(text); const qty = String(text || '').match(/(\d+(?:\.\d+)?)\s*(kg|公斤|千克|l|升|个|只|pcs?)?/i);
    const unitRaw = String(qty?.[2] || '').toLowerCase(); const unit = material?.unit || (/kg|公斤|千克/.test(unitRaw) ? 'kg' : /l|升/.test(unitRaw) ? 'L' : /个|只|pcs?/.test(unitRaw) ? '个' : '');
    const target = String(text || '').toUpperCase().match(/STORE\s*0*(\d{1,4})\b/) || String(text || '').match(/(?:去|到|至)\s*0*(\d{1,4})\s*(?:店|门店)?/);
    const reason = /过期/.test(text) ? '过期' : /破损|破了|碎/.test(text) ? '破损' : /变质|烂了|坏了|酸了/.test(text) ? '变质' : /洒|漏/.test(text) ? '洒漏' : '';
    return { material_name: material?.material_name || '', unit, qty: qty ? Number(qty[1]) : '', to_store_code: target ? `STORE${String(target[1]).padStart(3, '0')}` : '', reason };
  }
  function intentFromAction(action) { return ({ open_transfer: 'transfer', open_scrap: 'scrap', open_count: 'count', open_receipt: 'receipt', open_restock: 'restock' })[action?.type] || null; }
  function transferDestinations(values) {
    const rows = Array.isArray(values.destinations) && values.destinations.length ? values.destinations : [{ store_code: values.to_store_code || '', qty: values.qty || '' }];
    return rows.map((item) => ({ store_code: String(item?.store_code || '').trim(), qty: Number(item?.qty) || '' }));
  }
  function needs(intent, values) {
    if (intent === 'transfer') { const destinations = transferDestinations(values); return [!values.material_name && '物料', (!destinations.length || destinations.some((item) => !item.store_code || !item.qty)) && '每家调入门店及数量'].filter(Boolean); }
    if (intent === 'scrap') return [!values.material_name && '物料', !values.qty && '数量', !values.reason && '原因'].filter(Boolean);
    if (intent === 'receipt') return [!values.material_name && '物料', !values.qty && '数量'].filter(Boolean);
    if (intent === 'restock') return [!values.material_name && '物料', !values.qty && '数量', !values.reason && '申请原因'].filter(Boolean);
    return [];
  }
  function promptFor(intent, missing) {
    if (intent === 'count') return '请拍一张盘点单照片；系统会先识别，只有看不清的项目才需要你确认。';
    const first = missing[0]; if (!first) return '信息齐全。请确认后填写表单并提交。';
    const map = { 物料: '请问是什么物料？', 数量: '数量是多少？', 调入门店: '要调入哪一家门店？例如 STORE002。', '每家调入门店及数量': '请补充每家调入门店及数量，例如“STORE002 2kg”。', 原因: '报损原因是什么？可选破损、过期、变质或洒漏。', 申请原因: '请说明补货原因，例如库存不足或促销备货。' };
    return map[first] || '请继续补充本次操作所需的信息。';
  }
  function mergeDraftValues(previous = {}, incoming = {}) {
    const keep = (key, fallback = '') => incoming[key] !== undefined && incoming[key] !== null && incoming[key] !== '' ? incoming[key] : (previous[key] ?? fallback);
    const validDestinations = (items) => Array.isArray(items) ? items.map((item) => ({ store_code: String(item?.store_code || '').trim(), qty: Number(item?.qty) || '' })).filter((item) => item.store_code || item.qty) : [];
    const destinations = validDestinations(incoming.destinations);
    const previousDestinations = validDestinations(previous.destinations);
    const finalDestinations = destinations.length ? destinations : previousDestinations;
    return { material_name: keep('material_name'), unit: keep('unit'), qty: keep('qty'), to_store_code: keep('to_store_code', finalDestinations[0]?.store_code || '') || finalDestinations[0]?.store_code || '', destinations: finalDestinations, reason: keep('reason'), urgency: keep('urgency', 'normal'), plan_no: keep('plan_no'), request_id: keep('request_id'), direction: keep('direction') };
  }
  function startDraft(intent, prefill = {}, extra = '', announce = true) {
    const previous = draft?.intent === intent ? draft.values : {};
    draft = { intent, values: mergeDraftValues({ material_name: '', unit: '', qty: '', to_store_code: '', destinations: [], reason: '', urgency: 'normal', plan_no: '', request_id: '', direction: '', ...previous }, prefill) };
    const missing = needs(intent, draft.values);
    if (announce) {
      addMessage(`${extra ? `${extra}\n` : ''}${promptFor(intent, missing)}`);
      if (!missing.length && intent !== 'count') showConfirm();
      if (intent === 'count') showConfirm();
    }
  }
  function mergeDraft(text) {
    const parsed = slotsFrom(text); Object.entries(parsed).forEach(([key, value]) => { if (value !== '' && value != null) draft.values[key] = value; });
    const missing = needs(draft.intent, draft.values);
    if (missing.length) addMessage(promptFor(draft.intent, missing)); else showConfirm();
  }
  function showConfirm() {
    if (!draft) return; const v = draft.values;
    const labels = { transfer: '调拨', scrap: '报损', count: '盘点', receipt: '建立收货单草稿', restock: '建立订货单草稿' };
    const transferRows = draft.intent === 'transfer' ? transferDestinations(v).filter((item) => item.store_code || item.qty).map((item) => `<p>调入：<b>${esc(item.store_code || '待填写')} · ${esc(item.qty || '待填写')} ${esc(v.unit)}</b></p>`).join('') : '';
    const rows = draft.intent === 'count' ? '<p>📷 需要上传盘点照片</p>' : [v.material_name && `<p>物料：<b>${esc(v.material_name)}</b></p>`, draft.intent !== 'transfer' && v.qty && `<p>数量：<b>${esc(v.qty)} ${esc(v.unit)}</b></p>`, transferRows, v.reason && `<p>原因：<b>${esc(v.reason)}</b></p>`, (draft.intent === 'scrap' || draft.intent === 'receipt') && '<p>📷 可选上传照片凭证</p>'].filter(Boolean).join('');
    addMessage(`<div class="agent-confirm"><b>确认${labels[draft.intent]}信息</b>${rows}<button class="btn btn-primary" type="button" data-agent-open-sheet>填写并提交</button></div>`, 'assistant', true);
  }
  function materialOptions(selected) { return ledger.map((row) => `<option value="${esc(row.material_name)}" data-unit="${esc(row.unit)}" ${row.material_name === selected ? 'selected' : ''}>${esc(row.material_name)}（${esc(row.unit)}）</option>`).join(''); }
  function photoField(required = true) { return `<label class="agent-photo" id="agent-photo-box"><input id="agent-photo-input" type="file" accept="image/*" ${required ? 'required' : ''}><span>📷</span><small>点击上传照片${required ? '（必填）' : '（可选）'}</small></label>`; }
  function openSheet() {
    if (!draft) return; const v = draft.values; sheet.hidden = false; sheetStatus.textContent = ''; sheetSubmit.disabled = false;
    const title = { transfer: '调拨', scrap: '报损', count: '盘点', receipt: '建立收货单草稿', restock: '建立订货单草稿' }[draft.intent]; sheetTitle.textContent = title; sheetSubmit.textContent = ['receipt', 'restock'].includes(draft.intent) ? '建立草稿' : '提交';
    if (draft.intent === 'transfer') {
      const direction = v.direction === 'inbound' ? 'inbound' : 'outbound';
      const destinations = transferDestinations(v);
      const destinationRow = (item = {}) => `<div class="agent-transfer-target"><input class="agent-target-store" value="${esc(item.store_code || '')}" placeholder="如 STORE002" required><input class="agent-target-qty" type="number" min="0.001" step="0.001" value="${esc(item.qty || '')}" placeholder="数量" required><button class="agent-target-remove" type="button" aria-label="移除门店">×</button></div>`;
      const directionChoice = `<label>方向<div class="agent-choice-row" id="agent-transfer-direction"><button class="agent-choice ${direction === 'outbound' ? 'active' : ''}" type="button" data-direction="outbound">调出</button><button class="agent-choice ${direction === 'inbound' ? 'active' : ''}" type="button" data-direction="inbound">调入</button></div></label>`;
      const incoming = (latestStoreState?.storeTransferRequests || []).filter((item) => item.to_store_code === storeCode && item.status === 'pending_receipt');
      const outgoingForm = `<label>选择物料<select id="agent-material" required>${materialOptions(v.material_name)}</select></label><label>调入门店与数量<div id="agent-transfer-targets">${destinations.map(destinationRow).join('')}</div><button class="btn btn-outline agent-add-target" id="agent-add-target" type="button">＋ 添加调入门店</button></label><label>备注<textarea id="agent-note" placeholder="可选，例如晚高峰前补货"></textarea></label>`;
      const selectedIncoming = incoming.find((item) => item.id === v.request_id) || incoming[0];
      const inboundForm = incoming.length ? `<label>待收货调拨单<select id="agent-inbound-request" required>${incoming.map((item) => `<option value="${esc(item.id)}" data-qty="${esc(item.qty)}" data-unit="${esc(item.unit)}" ${item.id === selectedIncoming?.id ? 'selected' : ''}>${esc(item.from_store_code)} · ${esc(item.material_name)} ${esc(item.qty)}${esc(item.unit)} · ${esc(item.request_no)}</option>`).join('')}</select></label><label>实际收货数量<input id="agent-inbound-qty" type="number" min="0" step="0.001" value="${esc(selectedIncoming?.qty || '')}" required></label>` : '<p style="font-size:13px;color:#646a73">当前没有待本店收货的调拨单；调入只可对已下发的调拨单确认收货。</p>';
      sheetForm.innerHTML = `${directionChoice}${direction === 'outbound' ? outgoingForm : inboundForm}`;
      by('agent-transfer-direction')?.addEventListener('click', (event) => { const button = event.target.closest('[data-direction]'); if (!button) return; draft.values.direction = button.dataset.direction; openSheet(); });
      by('agent-add-target')?.addEventListener('click', () => by('agent-transfer-targets')?.insertAdjacentHTML('beforeend', destinationRow()));
      by('agent-transfer-targets')?.addEventListener('click', (event) => { const button = event.target.closest('.agent-target-remove'); if (!button) return; const rows = by('agent-transfer-targets')?.querySelectorAll('.agent-transfer-target') || []; if (rows.length > 1) button.closest('.agent-transfer-target')?.remove(); });
      sheetSubmit.disabled = direction === 'inbound' && !incoming.length;
    }
    if (draft.intent === 'scrap') sheetForm.innerHTML = `<label>选择物料<select id="agent-material" required>${materialOptions(v.material_name)}</select></label><label>数量<input id="agent-qty" type="number" min="0.001" step="0.001" value="${esc(v.qty)}" required></label><label>原因<div class="agent-choice-row" id="agent-reasons">${['破损','过期','变质','洒漏'].map((reason) => `<button type="button" class="agent-choice ${v.reason === reason ? 'active' : ''}" data-reason="${reason}">${reason}</button>`).join('')}</div><input id="agent-reason" value="${esc(v.reason)}" hidden required></label><label>拍照上传${photoField(false)}</label><label>备注<textarea id="agent-note" placeholder="可选说明"></textarea></label>`;
    if (draft.intent === 'count') sheetForm.innerHTML = `<label>拍照上传${photoField(true)}</label><label>备注<textarea id="agent-note" placeholder="例如：晚班闭店盘点"></textarea></label><p style="font-size:12px;color:#646a73">提交后先识别盘点表；只会要求你确认看不清的项目。</p>`;
    if (draft.intent === 'receipt') {
      const availableOrders = (latestStoreState?.purchaseOrders || []).filter((item) => ['pending_receipt', 'partially_received'].includes(item.status));
      const orderOptions = availableOrders.map((item) => `<option value="${esc(item.id)}">${esc(item.order_no)} · ${esc((item.lines || []).map((line) => `${line.material_name} ${line.ordered_qty - line.received_qty}${line.unit}`).join('、'))}</option>`).join('');
      sheetForm.innerHTML = `<label>关联订货单（可选）<select id="agent-purchase-order"><option value="">独立收货</option>${orderOptions}</select></label><label>选择物料<select id="agent-material" required>${materialOptions(v.material_name)}</select></label><label>实际收货数量<input id="agent-qty" type="number" min="0.001" step="0.001" value="${esc(v.qty)}" required></label><label>拍照上传${photoField(false)}</label><label>备注<textarea id="agent-note" placeholder="可选，例如送货单号"></textarea></label><p style="font-size:12px;color:#646a73">这里只建立收货草稿，不改变库存；请进入单据详情确认收货后入账。</p>`;
    }
    if (draft.intent === 'restock') sheetForm.innerHTML = `<label>选择物料<select id="agent-material" required>${materialOptions(v.material_name)}</select></label><label>订货数量<input id="agent-qty" type="number" min="0.001" step="0.001" value="${esc(v.qty)}" required></label><label>紧急程度<select id="agent-urgency"><option value="normal" ${v.urgency === 'normal' ? 'selected' : ''}>常规</option><option value="urgent" ${v.urgency === 'urgent' ? 'selected' : ''}>紧急</option><option value="critical" ${v.urgency === 'critical' ? 'selected' : ''}>非常紧急</option></select></label><label>订货原因<textarea id="agent-note" required placeholder="例如库存不足、促销备货">${esc(v.reason || '')}</textarea></label><p style="font-size:12px;color:#646a73">这里只建立订货草稿；进入单据详情确认提交后才进入待收货。</p>`;
    by('agent-reasons')?.addEventListener('click', (event) => { const button = event.target.closest('[data-reason]'); if (!button) return; by('agent-reason').value = button.dataset.reason; by('agent-reasons').querySelectorAll('.agent-choice').forEach((node) => node.classList.toggle('active', node === button)); });
    by('agent-photo-input')?.addEventListener('change', (event) => { const file = event.target.files?.[0]; const box = by('agent-photo-box'); if (file && box) { box.classList.add('has-file'); box.querySelector('small').textContent = `已选择：${file.name}`; } });
  }
  function closeSheet() { sheet.hidden = true; sheetForm.innerHTML = ''; sheetStatus.textContent = ''; }
  function fileAsData(file) { return new Promise((resolve, reject) => { if (!file) return resolve(null); const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file); }); }
  async function post(path, body) { const response = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); const result = await response.json().catch(() => ({})); if (!response.ok) throw Error(result.error || '提交失败'); return result; }
  function selectedUnit() { return by('agent-material')?.selectedOptions?.[0]?.dataset.unit || draft?.values.unit || ''; }
  async function submitSheet(event) {
    event.preventDefault(); if (!draft) return; const v = draft.values; const file = by('agent-photo-input')?.files?.[0] || null; const material = by('agent-material')?.value || v.material_name; const qty = Number(by('agent-qty')?.value || v.qty || 0); const unit = selectedUnit(); const note = by('agent-note')?.value?.trim() || '';
    sheetSubmit.disabled = true; sheetSubmit.textContent = '提交中…'; sheetStatus.textContent = '';
    try {
      const previewData = await fileAsData(file);
      if (draft.intent === 'count' && !file) throw Error('请先上传盘点照片。');
      if (draft.intent === 'transfer') {
        if (v.direction === 'inbound') { const requestId = by('agent-inbound-request')?.value; const actualQty = Number(by('agent-inbound-qty')?.value || 0); if (!requestId || actualQty < 0) throw Error('请选择待收货调拨单并填写实际数量。'); const result = await post(`/api/store-transfer-requests/${requestId}/receive`, { store_code: storeCode, actual_qty: actualQty }); addMessage(`已确认收货：${result.request.material_name} ${actualQty}${result.request.unit}；主单状态已更新为 ${result.order?.status || '已更新'}。`); }
        else { const destinations = Array.from(document.querySelectorAll('#agent-transfer-targets .agent-transfer-target')).map((row) => ({ store_code: row.querySelector('.agent-target-store')?.value.trim(), qty: Number(row.querySelector('.agent-target-qty')?.value || 0) })).filter((item) => item.store_code && item.qty > 0); if (!destinations.length) throw Error('请至少填写一家调入门店及数量。'); const result = await post('/api/store-transfer-requests', { store_code: storeCode, destinations, material_name: material, unit, business_date: today(), note }); const total = destinations.reduce((sum, item) => sum + item.qty, 0); addMessage(`已提交调拨单 ${result.order.order_no}。本店已调出 ${total}${unit} 至 ${destinations.length} 家门店，等待各门店实际收货。`); }
      }
      if (draft.intent === 'scrap') { const reason = by('agent-reason').value; const result = await post('/api/material-events', { store_code: storeCode, business_date: today(), material_name: material, unit, qty, type: 'scrap', reference: `${reason}${note ? ` · ${note}` : ''}` }); if (file) await post('/api/store-agent/evidence', { store_code: storeCode, intent: 'scrap', filename: file.name, preview_data: previewData }); addMessage(`报损已提交：${material} ${qty}${unit}，单号 ${result.materialEvents?.[0]?.document_no || '已生成'}${file ? '；照片凭证已留档' : ''}。`); }
      if (draft.intent === 'receipt') { const orderId = by('agent-purchase-order')?.value || ''; const result = await post('/api/receipt-orders', { order_id: orderId || undefined, store_code: storeCode, business_date: today(), lines: [{ material_name: material, unit, qty }], source_type: 'ai_suggestion', note, operator: `${storeCode} 门店助手` }); if (file) await post('/api/store-agent/evidence', { store_code: storeCode, intent: 'receipt', filename: file.name, preview_data: previewData }); addMessage(`收货单草稿 ${result.receipt.receipt_no} 已建立，尚未改变库存。<br><a class="btn btn-outline" href="/procurement-detail/?type=receipt&id=${encodeURIComponent(result.receipt.id)}">查看详情并确认收货</a>${file ? '<br>收货凭证已留档。' : ''}`, 'assistant', true); }
      if (draft.intent === 'restock') { const result = await post('/api/purchase-orders', { store_code: storeCode, business_date: today(), lines: [{ material_name: material, unit, qty }], urgency: by('agent-urgency').value, source_type: 'ai_suggestion', note, operator: `${storeCode} 门店助手` }); addMessage(`订货单草稿 ${result.order.order_no} 已建立，尚未提交。<br><a class="btn btn-outline" href="/procurement-detail/?type=purchase&id=${encodeURIComponent(result.order.id)}">查看详情并确认提交</a>`, 'assistant', true); }
      if (draft.intent === 'count') { const state = latestStoreState || await loadLedger(); const plan = (state.countPlans || []).find((item) => item.plan_no === v.plan_no && item.status === 'pending_store_count') || (state.countPlans || []).find((item) => item.status === 'pending_store_count'); if (!plan) throw Error('今天没有待完成的盘点单。'); await post('/api/count-photo-recognition', { planNo: plan.plan_no, filename: file.name, previewData }); addMessage('盘点照片已上传并开始识别。请到“任务”页确认未识别项后提交。'); window.switchStoreTab?.('tasks'); }
      closeSheet(); draft = null; await loadLedger(); window.invalidateStoreBootstrap?.(); window.storeCountPlanReload?.();
    } catch (error) { sheetStatus.textContent = error.message; sheetSubmit.disabled = false; sheetSubmit.textContent = '提交'; }
  }
  function assistantLocale(value = '', transcript = '') {
    const locale = String(value || '').toLowerCase();
    if (locale === 'id' || locale.startsWith('id-') || locale.includes('indones')) return 'id-ID';
    if (locale === 'en' || locale.startsWith('en-') || locale.includes('english')) return 'en-US';
    if (/\b(pindahkan|tampilkan|stok|susu|barang|rusak|kedaluwarsa|liter|kilogram)\b/i.test(transcript)) return 'id-ID';
    if (/\b(transfer|show|check|stock|inventory|milk|damaged|expired)\b/i.test(transcript)) return 'en-US';
    return 'zh-CN';
  }
  async function ask(raw, languageHint = '') {
    const message = String(raw || '').trim(); if (!message || busy) return; addMessage(message, 'user'); input.value = ''; resizeInput();
    if (/^(取消|重来|退出)$/.test(message)) { draft = null; addMessage('已取消当前操作。你可以重新说调拨、报损、盘点、订货或收货。'); return; }
    setBusy(true); const waiting = addMessage('正在识别你的操作…');
    try { const selectedLocale = language?.value || 'auto'; const response = await fetch('/api/store-agent', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message, store_code: storeCode, session_id: sessionId, draft, lang: languageHint || (selectedLocale === 'auto' ? 'zh-CN' : selectedLocale) }) }); const data = await response.json().catch(() => ({})); waiting.remove(); if (!response.ok) throw Error(data.error || '助手暂时无法响应'); addMessage(data.reply || '已收到。'); renderTodayTasks(data.today_tasks); const intent = intentFromAction(data.action); if (intent) startDraft(intent, data.action.prefill || {}, ''); }
    catch (error) { waiting.remove(); addMessage(`暂时无法连接助手：${error.message}。`); } finally { setBusy(false); }
  }
  async function welcome() { if (welcomed) return; welcomed = true; await loadLedger(); try { const response = await fetch('/api/store-agent', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: '__welcome__', store_code: storeCode, session_id: sessionId, lang: language?.value || 'zh-CN' }) }); const data = await response.json().catch(() => ({})); if (!response.ok) throw Error(data.error || '读取待办失败'); addMessage(data.reply || '你好！我是你的门店运营助手。'); renderTodayTasks(data.today_tasks); } catch (_) { addMessage('你好！我是你的门店运营助手。可以帮你处理调拨、报损、盘点、订货、收货或查询库存。'); } }
  function voiceErrorText(code = 'unavailable') {
    const locale = language?.value || 'zh-CN';
    const permission = code === 'not-allowed' || code === 'service-not-allowed';
    const noSpeech = code === 'no-speech';
    if (locale === 'id-ID') {
      if (permission) return 'Akses mikrofon belum diizinkan. Izinkan mikrofon di browser atau ketik pesan.';
      if (noSpeech) return 'Suara belum terdeteksi. Coba lagi atau ketik pesan.';
      return 'Pengenalan suara tidak tersedia. Silakan ketik pesan.';
    }
    if (locale === 'en-US') {
      if (permission) return 'Microphone access is not allowed. Allow it in the browser or type your message.';
      if (noSpeech) return 'No speech was detected. Try again or type your message.';
      return 'Speech recognition is unavailable. Please type your message.';
    }
    if (permission) return '麦克风尚未授权，请在浏览器中允许麦克风，或直接输入文字。';
    if (noSpeech) return '没有识别到语音，请重试或直接输入文字。';
    return '当前语音识别不可用，请直接输入文字。';
  }
  function releaseVoiceStream() { activeVoiceStream?.getTracks().forEach((track) => track.stop()); activeVoiceStream = null; mediaRecorder = null; voiceChunks = []; }
  async function transcribeVoice(blob) {
    voiceNote.textContent = '正在转写并理解…'; mic.classList.remove('recording'); voiceOverlay?.classList.remove('recording'); if (voiceOverlayTitle) voiceOverlayTitle.textContent = '正在识别'; if (voiceOverlayText) voiceOverlayText.textContent = '请稍候，正在转写并理解你的操作';
    const controller = new AbortController(), timeoutId = setTimeout(() => controller.abort(), 45000);
    try {
      const selectedLang = language?.value || 'auto';
      const headers = { 'content-type':blob.type || 'audio/webm' };
      if (selectedLang !== 'auto') headers['x-speech-language'] = selectedLang;
      const response = await fetch(selectedLang === 'auto' ? '/api/voice-transcribe' : `/api/voice-transcribe?lang=${encodeURIComponent(selectedLang)}`, { method:'POST', headers, body:blob, signal:controller.signal });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || '语音转写失败');
      const transcript = String(data.transcript || '').trim(); if (!transcript) throw new Error('没有识别到有效语音');
      input.value = transcript; resizeInput();
      speaking = false; voicePermissionPending = false; voiceNote.classList.remove('show'); voiceOverlay?.classList.remove('show','recording'); releaseVoiceStream();
      await ask(transcript, assistantLocale(data.language, transcript));
    } catch (error) { addMessage(error.name === 'AbortError' ? '语音转写超时，请重试或直接输入文字。' : `${voiceErrorText(error.message.includes('有效语音') ? 'no-speech' : 'unavailable')}（${error.message}）`); }
    finally { clearTimeout(timeoutId); speaking = false; voicePermissionPending = false; discardVoice = false; voiceNote.classList.remove('show'); voiceOverlay?.classList.remove('show','recording'); releaseVoiceStream(); }
  }
  async function startVoice() {
    if (speaking || busy) return;
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) { addMessage(voiceErrorText('unsupported')); return; }
    speaking = true; voicePermissionPending = true; discardVoice = false; mic.classList.add('recording'); voiceNote.classList.add('show'); voiceNote.textContent = '正在请求麦克风权限…';
    try {
      activeVoiceStream = await navigator.mediaDevices.getUserMedia({ audio:{ echoCancellation:true, noiseSuppression:true, autoGainControl:true } });
      voicePermissionPending = false;
      const mimeType = ['audio/webm;codecs=opus','audio/webm','audio/mp4'].find((type) => MediaRecorder.isTypeSupported(type));
      mediaRecorder = new MediaRecorder(activeVoiceStream, mimeType ? { mimeType } : undefined); voiceChunks = [];
      mediaRecorder.ondataavailable = (event) => { if (event.data?.size) voiceChunks.push(event.data); };
      mediaRecorder.onerror = (event) => { addMessage(`录音错误：${event.error?.message || 'unknown'}`); speaking = false; voiceNote.classList.remove('show'); voiceOverlay?.classList.remove('show','recording'); mic.classList.remove('recording'); releaseVoiceStream(); };
      mediaRecorder.onstop = () => { const blob = new Blob(voiceChunks, { type:mediaRecorder?.mimeType || mimeType || 'audio/webm' }); if (discardVoice) { speaking = false; discardVoice = false; voiceNote.classList.remove('show'); voiceOverlay?.classList.remove('show','recording'); mic.classList.remove('recording'); releaseVoiceStream(); return; } if (blob.size < 512) { speaking = false; voiceNote.classList.remove('show'); voiceOverlay?.classList.remove('show','recording'); mic.classList.remove('recording'); releaseVoiceStream(); return addMessage(voiceErrorText('no-speech')); } transcribeVoice(blob); };
      const languageLabel = language?.value === 'auto' ? '中文、English 或 Bahasa Indonesia' : (language?.selectedOptions?.[0]?.textContent || language?.value || '中文'); mediaRecorder.start(250); voiceOverlay?.classList.add('show','recording'); if (voiceOverlayTitle) voiceOverlayTitle.textContent = '正在聆听'; if (voiceOverlayText) voiceOverlayText.textContent = `请说${languageLabel}，完成后点击下方按钮`; voiceNote.textContent = `正在录音（${languageLabel}）…`;
    } catch (error) { speaking = false; voicePermissionPending = false; voiceNote.classList.remove('show'); voiceOverlay?.classList.remove('show','recording'); mic.classList.remove('recording'); releaseVoiceStream(); addMessage(voiceErrorText(error.name === 'NotAllowedError' ? 'not-allowed' : 'unavailable')); }
  }
  function stopVoice() { if (!speaking || voicePermissionPending) return; if (mediaRecorder?.state === 'recording') mediaRecorder.stop(); }
  function cancelVoice() { if (!speaking) return; discardVoice = true; voicePermissionPending = false; if (mediaRecorder?.state === 'recording') mediaRecorder.stop(); else { speaking = false; voiceNote.classList.remove('show'); voiceOverlay?.classList.remove('show','recording'); mic.classList.remove('recording'); releaseVoiceStream(); } }

  send.addEventListener('click', () => ask(input.value)); input.addEventListener('input', resizeInput); input.addEventListener('keydown', (event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); ask(input.value); } });
  document.querySelectorAll('[data-agent-prompt]').forEach((button) => button.addEventListener('click', () => ask(button.dataset.agentPrompt)));
  chat.addEventListener('click', (event) => { if (event.target.closest('[data-agent-open-sheet]')) { openSheet(); return; } const taskButton = event.target.closest('[data-agent-task-action]'); if (!taskButton) return; const type = taskButton.dataset.agentTaskAction; if (type === 'open_task_tab') { window.switchStoreTab?.('tasks'); return; } const intent = intentFromAction({ type }); if (!intent) return; startDraft(intent, { plan_no: taskButton.dataset.agentTaskPlan || '', request_id: taskButton.dataset.agentTaskRequest || '', direction: taskButton.dataset.agentTaskDirection || '' }, '', false); openSheet(); });
  mic.addEventListener('click', (event) => { event.preventDefault(); if (speaking && !voicePermissionPending) stopVoice(); else startVoice(); });
  voiceFinish?.addEventListener('click', stopVoice); voiceCancel?.addEventListener('click', cancelVoice);
  [by('agent-sheet-close'), by('agent-sheet-cancel')].forEach((button) => button?.addEventListener('click', closeSheet)); sheetForm.addEventListener('submit', submitSheet);
  window.storeAgentTabOpened = welcome;
  window.storeOpsRefresh = loadLedger;
  window.storeOperationOpen = async (action) => {
    const intent = ({ transfer: 'transfer', scrap: 'scrap', count: 'count', receipt: 'receipt', restock: 'restock' })[action];
    if (!intent) return;
    await loadLedger();
    startDraft(intent, intent === 'transfer' ? { direction: 'outbound' } : {}, '', false);
    openSheet();
  };
})();
