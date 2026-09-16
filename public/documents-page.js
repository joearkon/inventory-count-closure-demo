(() => {
  const by = (id) => document.getElementById(id);
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' }[char]));
  let records = [];
  let currentPage = 1;
  const mappedStatus = (status) => status === 'cancelled' ? 'cancelled' : /pending/.test(status || '') ? 'pending' : 'completed';
  const statusText = (status) => ({ pending_receipt:'待门店收货', received:'已收货', active:'已生效', cancelled:'已撤销', completed:'已完成' }[status] || status || '已生效');
  function render() {
    const store = by('store-filter').value, type = by('type-filter').value, status = by('status-filter').value;
    const list = records.filter((item) => (!store || item.store_codes.includes(store)) && (!type || item.type === type) && (!status || mappedStatus(item.status) === status));
    const page = window.ListPager.slice(list, currentPage, 20); currentPage = page.page;
    by('document-rows').innerHTML = page.items.length ? page.items.map((item) => `<tr><td><b>${esc(item.no)}</b></td><td>${esc(item.date)}</td><td>${esc(item.label)}</td><td>${esc(item.flow)}</td><td>${esc(item.material)}</td><td>${esc(item.qty)} ${esc(item.unit)}</td><td><span class="tag ${mappedStatus(item.status)}">${esc(statusText(item.status))}</span></td><td>${esc(item.note || '—')}</td></tr>`).join('') : '<tr><td class="empty" colspan="8">当前筛选条件下没有单据。</td></tr>';
    window.ListPager.render('document-pager', page, (next) => { currentPage = next; render(); });
  }
  async function load() {
    const response = await fetch('/api/state?view=documents', { cache:'no-store' }); const state = await response.json(); if (!response.ok) throw Error(state.error || '加载失败');
    const stores = state.storeMasters || [];
    by('store-filter').innerHTML += stores.map((item) => `<option value="${esc(item.store_code)}">${esc(item.store_code)} · ${esc(item.store_name)}</option>`).join('');
    const events = (state.materialEvents || []).filter((item) => ['receipt','scrap'].includes(item.type)).map((item) => ({ no:item.document_no || item.id, date:item.business_date, type:item.type, label:item.type === 'receipt' ? '收货单' : '报损单', store_codes:[item.store_code], flow:item.store_code, material:item.material_name, qty:item.qty, unit:item.unit, status:item.status, note:item.reference || item.source }));
    const transfers = (state.transferOrders || []).map((item) => ({ no:item.order_no || item.id, date:item.business_date, type:'transfer', label:'调拨单', store_codes:[item.from_party, ...(item.destinations || []).map((line) => line.store_code)].filter(Boolean), flow:`${item.from_party} → ${(item.destinations || []).map((line) => line.store_code).join('、')}`, material:item.material_name, qty:item.total_qty, unit:item.unit, status:item.status, note:item.note || item.source }));
    records = [...events, ...transfers].sort((a,b) => `${b.date}${b.no}`.localeCompare(`${a.date}${a.no}`));
    by('receipt-count').textContent = events.filter((item) => item.type === 'receipt').length;
    by('scrap-count').textContent = events.filter((item) => item.type === 'scrap').length;
    by('transfer-count').textContent = transfers.length;
    render();
  }
  ['store-filter','type-filter','status-filter'].forEach((id) => by(id).addEventListener('change', () => { currentPage = 1; render(); }));
  load().catch((error) => { by('document-rows').innerHTML = `<tr><td class="empty" colspan="8">${esc(error.message)}</td></tr>`; });
})();
