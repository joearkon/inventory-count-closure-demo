(() => {
  const mode = document.body.dataset.procurementMode;
  const by = (id) => document.getElementById(id);
  const esc = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#039;', '"':'&quot;' }[char]));
  const fmt = (value) => Number(value || 0).toLocaleString('zh-CN', { maximumFractionDigits:3 });
  const labels = { draft:'草稿', pending_receipt:'待收货', partially_received:'部分收货', received:'已收货', cancelled:'已取消' };
  let state = {}, pageNo = 1;
  async function api(path, options = {}) { const response = await fetch(path, { headers:{ 'Content-Type':'application/json' }, ...options }); const data = await response.json().catch(() => ({})); if (!response.ok) throw Error(data.error || '操作失败'); return data; }
  function toast(text, error = false) { const node = by('toast'); if (!node) return; node.textContent = text; node.className = `toast${error ? ' error' : ''}`; node.style.display = 'block'; }
  function statusTag(status) { const type = status === 'draft' ? 'draft' : status === 'cancelled' ? 'cancelled' : status === 'received' ? 'done' : 'pending'; return `<span class="tag ${type}">${esc(labels[status] || status)}</span>`; }
  function lineText(lines, quantityKey) { return (lines || []).map((line) => `${esc(line.material_name)} ${fmt(line[quantityKey] ?? line.qty)}${esc(line.unit)}`).join('<br>'); }
  function switchTab(name) { document.querySelectorAll('[data-tab]').forEach((button) => button.classList.toggle('active', button.dataset.tab === name)); document.querySelectorAll('[data-panel]').forEach((panel) => panel.hidden = panel.dataset.panel !== name); history.replaceState(null, '', `#${name}`); }
  function materialOptions(selected = '') { return (state.materialCatalog || []).filter((item) => item.status !== 'inactive').map((item) => `<option value="${esc(item.material_name)}" data-unit="${esc(item.base_unit)}" ${item.material_name === selected ? 'selected' : ''}>${esc(item.material_name)}（${esc(item.base_unit)}）</option>`).join(''); }
  function addLine(line = {}) { by('line-rows').insertAdjacentHTML('beforeend', `<div class="line"><label>物料<select class="material">${materialOptions(line.material_name)}</select></label><label>数量<input class="qty" type="number" min="0.001" step="0.001" value="${esc(line.qty || '')}" required></label><button type="button" class="btn secondary remove">删除</button></div>`); bindLines(); }
  function bindLines() { document.querySelectorAll('.line .remove').forEach((button) => button.onclick = () => { if (by('line-rows').children.length > 1) button.parentElement.remove(); }); }
  function collectLines() { return [...document.querySelectorAll('.line')].map((row) => { const select = row.querySelector('.material'); return { material_name:select.value, unit:select.selectedOptions[0]?.dataset.unit, qty:Number(row.querySelector('.qty').value) }; }); }
  function render() {
    const all = mode === 'purchase' ? (state.purchaseOrders || []) : (state.receiptOrders || []);
    const store = by('store-filter').value, status = by('status-filter').value;
    const list = all.filter((item) => (!store || item.store_code === store) && (!status || item.status === status));
    const page = window.ListPager.slice(list, pageNo, 15); pageNo = page.page;
    by('rows').innerHTML = page.items.length ? page.items.map((item) => mode === 'purchase'
      ? `<tr><td><b>${esc(item.order_no)}</b></td><td>${esc(item.business_date)}</td><td>${esc(item.store_code)}</td><td>${esc(item.supplier_name)}</td><td>${lineText(item.lines, 'ordered_qty')}</td><td>${esc(item.source_type)}${item.source_work_order_id ? `<br><small>${esc(item.source_work_order_id)}</small>` : ''}</td><td>${statusTag(item.status)}</td><td><a class="link" href="/procurement-detail/?type=purchase&id=${encodeURIComponent(item.id)}">查看详情</a></td></tr>`
      : `<tr><td><b>${esc(item.receipt_no)}</b></td><td>${item.order_no ? `<a class="link" href="/procurement-detail/?type=purchase&id=${encodeURIComponent(item.order_id)}">${esc(item.order_no)}</a>` : '独立收货'}</td><td>${esc(item.business_date)}</td><td>${esc(item.store_code)}</td><td>${esc(item.supplier_name)}</td><td>${lineText(item.lines, 'received_qty')}</td><td>${esc(item.source_type)}${item.source_work_order_id ? `<br><small>${esc(item.source_work_order_id)}</small>` : ''}</td><td>${statusTag(item.status)}</td><td><a class="link" href="/procurement-detail/?type=receipt&id=${encodeURIComponent(item.id)}">查看详情</a></td></tr>`).join('') : `<tr><td colspan="${mode === 'purchase' ? 8 : 9}" class="empty">当前筛选条件下没有单据。</td></tr>`;
    window.ListPager.render('pager', page, (next) => { pageNo = next; render(); });
  }
  function fillOrder(order) {
    if (!order) return;
    by('store').value = order.store_code; by('supplier').value = order.supplier_name || ''; by('urgency').value = order.urgency || 'normal'; by('work-order').value = order.source_work_order_id || '';
    by('source-type').value = order.source_work_order_id ? 'work_order' : 'manual'; by('line-rows').innerHTML = '';
    (order.lines || []).filter((line) => Number(line.ordered_qty || 0) > Number(line.received_qty || 0)).forEach((line) => addLine({ material_name:line.material_name, qty:Number(line.ordered_qty || 0) - Number(line.received_qty || 0) }));
  }
  async function load() {
    state = await api('/api/state?view=procurement');
    let openOrders = [];
    const storeOptions = (state.storeMasters || []).filter((item) => item.status !== '停用').map((item) => `<option value="${esc(item.store_code)}">${esc(item.store_code)} · ${esc(item.store_name)}</option>`).join('');
    by('store-filter').insertAdjacentHTML('beforeend', storeOptions); by('store').innerHTML = storeOptions;
    by('date').value = new Date().toISOString().slice(0, 10);
    if (mode === 'purchase') by('expected-date').value = by('date').value;
    else {
      openOrders = (state.purchaseOrders || []).filter((item) => ['pending_receipt','partially_received'].includes(item.status));
      by('purchase-order').insertAdjacentHTML('beforeend', openOrders.map((item) => `<option value="${esc(item.id)}">${esc(item.order_no)} · ${esc(item.store_code)} · ${esc(item.supplier_name)}</option>`).join(''));
      by('purchase-order').onchange = () => fillOrder(openOrders.find((item) => item.id === by('purchase-order').value));
    }
    if (!by('line-rows').children.length) addLine();
    const query = new URLSearchParams(location.search), sourceOrder = query.get('order_id'), sourceWorkOrder = query.get('source_work_order_id');
    if (query.get('date')) {
      by('date').value = query.get('date');
      if (mode === 'purchase') by('expected-date').value = query.get('date');
    }
    if (sourceWorkOrder) {
      by('work-order').value = sourceWorkOrder; by('source-type').value = 'work_order'; by('urgency').value = query.get('urgency') || 'urgent';
      if (query.get('store') && [...by('store').options].some((option) => option.value === query.get('store'))) by('store').value = query.get('store');
      const material = query.get('material'), materialSelect = document.querySelector('.line .material');
      if (material && materialSelect && [...materialSelect.options].some((option) => option.value === material)) materialSelect.value = material;
      switchTab('create');
    }
    if (mode === 'receipt' && sourceOrder) { by('purchase-order').value = sourceOrder; fillOrder(openOrders.find((item) => item.id === sourceOrder)); switchTab('create'); }
    render();
  }
  document.querySelectorAll('[data-tab]').forEach((button) => button.onclick = () => switchTab(button.dataset.tab));
  ['store-filter','status-filter'].forEach((id) => by(id).onchange = () => { pageNo = 1; render(); });
  by('add-line').onclick = () => addLine();
  by('create-form').onsubmit = async (event) => {
    event.preventDefault(); const button = event.currentTarget.querySelector('[type=submit]'); button.disabled = true;
    try {
      const common = { store_code:by('store').value, business_date:by('date').value, supplier_name:by('supplier').value, urgency:by('urgency').value, source_type:by('source-type').value, source_work_order_id:by('work-order').value, note:by('note').value, lines:collectLines() };
      const path = mode === 'purchase' ? '/api/purchase-orders' : '/api/receipt-orders';
      if (mode === 'purchase') common.expected_arrival_date = by('expected-date').value; else common.order_id = by('purchase-order').value;
      const result = await api(path, { method:'POST', body:JSON.stringify(common) });
      const record = result.order || result.receipt; location.href = `/procurement-detail/?type=${mode}&id=${encodeURIComponent(record.id)}`;
    } catch (error) { toast(error.message, true); button.disabled = false; }
  };
  switchTab(location.hash.slice(1) === 'create' ? 'create' : 'list'); load().catch((error) => toast(error.message, true));
})();
