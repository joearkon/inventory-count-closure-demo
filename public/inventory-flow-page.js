(() => {
  const $ = (id) => document.getElementById(id);
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' }[c]));
  const fmt = (value) => Number(value || 0).toLocaleString('zh-CN', { maximumFractionDigits: 3 });
  const params = new URLSearchParams(location.search);
  const labels = { sale:'销售', receipt:'收货', transfer:'调拨', scrap:'报损', count:'盘点', opening:'期初' };
  let allRows = [];
  let currentPage = 1;

  const typeClass = (type) => type === 'sale' ? 'sale' : type === 'transfer' ? 'transfer' : type === 'count' ? 'count' : type === 'scrap' ? 'scrap' : '';
  const displayTime = (value, fallback = '营业中') => {
    if (!value) return fallback;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? fallback : date.toLocaleString('zh-CN', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', hour12:false });
  };

  function buildRows(data) {
    const rows = [], seenEvents = new Set();
    for (const view of data.storeViews || []) {
      const businessDate = view.business_date || data.r2Import?.latest_business_date || '';
      for (const item of view.ledger || []) {
        const unit = item.unit || '';
        rows.push({ date:businessDate, time:`${businessDate}T00:00:00+08:00`, store:view.store_code, type:'opening', direction:'in', material:item.material_name, unit, qty:Number(item.opening_qty || 0), balance:Number(item.opening_qty || 0), reference:item.baseline_source || '系统有效期初' });
        for (const event of item.manual_events || []) {
          if (event.id && seenEvents.has(event.id)) continue;
          if (event.id) seenEvents.add(event.id);
          const inbound = ['receipt','transfer_in'].includes(event.type);
          rows.push({ date:event.business_date || businessDate, time:event.created_at, store:event.store_code || view.store_code, type:event.type === 'receipt' ? 'receipt' : event.type === 'scrap' ? 'scrap' : 'transfer', direction:inbound ? 'in' : 'out', material:event.material_name || item.material_name, unit:event.unit || unit, qty:Number(event.qty || 0), balance:null, reference:[event.document_no || '系统流水', event.reference].filter(Boolean).join(' · ') });
        }
        if (Number(item.bom_consumption_qty || 0) !== 0) rows.push({ date:businessDate, time:data.latestBatch?.completed_at || data.r2Import?.imported_at, store:view.store_code, type:'sale', direction:'out', material:item.material_name, unit, qty:Number(item.bom_consumption_qty || 0), balance:Number(item.theoretical_closing_qty || 0), reference:`飞书销售 × BOM · ${Number(item.sku_contributors?.length || 0)} 个 SKU/规格` });
        if (item.actual_inventory_qty !== null && item.actual_inventory_qty !== undefined) rows.push({ date:businessDate, time:item.actual_inventory_at, store:view.store_code, type:'count', direction:'neutral', material:item.material_name, unit, qty:Number(item.actual_inventory_qty), balance:Number(item.theoretical_closing_qty || 0), reference:`盘点单 ${item.actual_inventory_document_id || '已归档'} · 较理论 ${Number(item.actual_vs_theoretical_qty || 0) >= 0 ? '+' : ''}${fmt(item.actual_vs_theoretical_qty)} ${unit}` });
      }
    }
    return rows.sort((a, b) => String(b.time || b.date).localeCompare(String(a.time || a.date)));
  }

  function fillOptions(select, values, allLabel, selected) {
    select.innerHTML = `<option value="all">${allLabel}</option>${values.map((value) => `<option value="${esc(value)}">${esc(value)}</option>`).join('')}`;
    select.value = values.includes(selected) ? selected : 'all';
  }

  function render() {
    const store = $('store-filter').value, material = $('material-filter').value, direction = $('direction-filter').value, type = $('type-filter').value, date = $('date-filter').value;
    const rows = allRows.filter((row) => (store === 'all' || row.store === store) && (material === 'all' || row.material === material) && (direction === 'all' || row.direction === direction) && (type === 'all' || row.type === type) && (date === 'all' || row.date === date));
    $('total-kpi').textContent = `${rows.length} 笔`;
    $('in-kpi').textContent = `${rows.filter((row) => row.direction === 'in').length} 笔`;
    $('out-kpi').textContent = `${rows.filter((row) => row.direction === 'out').length} 笔`;
    $('count-kpi').textContent = `${rows.filter((row) => row.type === 'count').length} 笔`;
    const page = window.ListPager.slice(rows, currentPage, 20); currentPage = page.page;
    $('result-note').textContent = `筛选 ${rows.length} / 全部 ${allRows.length} 笔流水`;
    $('flow-rows').innerHTML = page.items.length ? page.items.map((row) => `<tr><td>${esc(displayTime(row.time, row.date))}</td><td><b>${esc(row.store)}</b><br><span class="muted">${esc(row.date)}</span></td><td><span class="tag ${typeClass(row.type)}">${esc(labels[row.type] || row.type)}</span></td><td class="${row.direction}">${row.direction === 'in' ? '增加' : row.direction === 'out' ? '扣减' : '核对'}</td><td><b>${esc(row.material)}</b><br><span class="muted">${esc(row.unit)}</span></td><td class="${row.direction}">${row.direction === 'in' ? '+' : row.direction === 'out' ? '−' : '实盘 '}${fmt(row.qty)} ${esc(row.unit)}</td><td>${row.balance == null ? '—' : `${fmt(row.balance)} ${esc(row.unit)}`}</td><td>${esc(row.reference)}</td></tr>`).join('') : '<tr><td colspan="8" class="empty">当前筛选条件下没有流水。</td></tr>';
    window.ListPager.render('flow-pager', page, (next) => { currentPage = next; render(); });
  }

  async function load() {
    try {
      const response = await fetch('/api/feishu-sync/state?view=flows', { cache:'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '无法读取流水');
      allRows = buildRows(data);
      fillOptions($('store-filter'), [...new Set(allRows.map((row) => row.store))].sort(), '全部门店', params.get('store'));
      fillOptions($('material-filter'), [...new Set(allRows.map((row) => row.material))].sort((a, b) => a.localeCompare(b, 'zh-CN')), '全部物料', params.get('material'));
      fillOptions($('date-filter'), [...new Set(allRows.map((row) => row.date).filter(Boolean))].sort().reverse(), '全部营业日', params.get('date'));
      ['store-filter','material-filter','direction-filter','type-filter','date-filter'].forEach((id) => $(id).onchange = () => { currentPage = 1; render(); });
      render();
    } catch (error) {
      $('result-note').textContent = '读取失败';
      $('flow-rows').innerHTML = `<tr><td colspan="8" class="empty">${esc(error.message)}</td></tr>`;
    }
  }
  load();
})();
