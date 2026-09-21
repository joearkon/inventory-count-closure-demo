(() => {
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' }[char]));
  const qty = (value) => value == null ? '—' : Number(value).toLocaleString('zh-CN', { maximumFractionDigits:3 });
  const by = (id) => document.getElementById(id);
  const statusLabel = { open:'待处理', in_progress:'处理中', pending_verification:'待验证', closed:'已关闭' };
  const nextAction = {
    inventory_accuracy:'核对收货、盘点、报损、单位与 BOM；修正后重新计算。',
    supply_risk:'确认在途、可调库存或建立补货／调拨动作。',
    replenishment_balance:'核对集中备货、销售消耗、收货数量和单位。'
  };
  let payload = null, view = 'active', expanded = null;
  const filters = { store:'all', family:'all' };
  const days = (start, end) => { if (!start || !end) return 1; return Math.max(1, Math.round((new Date(`${end}T12:00:00`) - new Date(`${start}T12:00:00`)) / 86400000) + 1); };
  const isVisible = (item) => {
    if (filters.store !== 'all' && item.store_code !== filters.store) return false;
    if (filters.family !== 'all' && item.rule_family !== filters.family) return false;
    if (view === 'active') return ['open', 'in_progress'].includes(item.status);
    if (view === 'verification') return item.status === 'pending_verification';
    if (view === 'closed') return item.status === 'closed';
    return true;
  };
  function renderSummary() {
    const s = payload.summary;
    by('case-summary').innerHTML = `<article class="summary-card alert"><b>${s.active}</b><span>当前待处理</span></article><article class="summary-card"><b>${s.new_today}</b><span>今日新增</span></article><article class="summary-card"><b>${s.persistent}</b><span>跨日持续</span></article><article class="summary-card verify"><b>${s.pending_verification}</b><span>待验证</span></article><article class="summary-card"><b>${s.closed}</b><span>已关闭</span></article>`;
  }
  function renderFilters() {
    const stores = [...new Set(payload.cases.map((item) => item.store_code))].sort();
    by('case-store-filter').innerHTML = `<option value="all">全部门店</option>${stores.map((item) => `<option value="${esc(item)}">${esc(item)}</option>`).join('')}`;
    by('case-store-filter').value = stores.includes(filters.store) ? filters.store : 'all';
  }
  function values(item) {
    const v = item.latest_values || {};
    if (item.current_rule_code === 'COUNT_VARIANCE') return `理论 ${qty(v.theoretical_qty)} / 实盘 ${qty(v.physical_qty)} ${item.unit}`;
    if (item.current_rule_code === 'BELOW_SAFETY_STOCK') return `${qty(v.theoretical_qty)} / 安全 ${qty(v.safety_qty)} ${item.unit}`;
    if (item.current_rule_code === 'SELL_IN_IMBALANCE') return `销入比 ${qty(v.sell_in_ratio)}`;
    return `理论 ${qty(v.theoretical_qty)} ${item.unit}`;
  }
  function detail(item) {
    const observations = item.observations || [];
    return `<div class="case-detail"><div class="detail-top"><section class="detail-block"><h3>当前结论</h3><p class="current-conclusion">${esc(item.latest_evidence || '等待补充当前研判结论。')}</p><div class="metric-grid"><div><span>首次发现</span><b>${esc(item.opened_business_date)}</b></div><div><span>最新观察</span><b>${esc(item.latest_business_date)}</b></div><div><span>持续时间</span><b>${days(item.opened_business_date, item.latest_business_date)} 天</b></div><div><span>理论库存</span><b>${qty(item.latest_values?.theoretical_qty)} ${esc(item.unit)}</b></div><div><span>实盘库存</span><b>${qty(item.latest_values?.physical_qty)} ${esc(item.unit)}</b></div><div><span>观察次数</span><b>${item.observation_count}</b></div></div></section><section class="detail-block"><h3>下一步</h3><p>${esc(nextAction[item.rule_family] || '补充证据后重新研判。')}</p><p>当前责任：<b>${esc(item.assigned_to)}</b></p><p>问题编号：${esc(item.case_no)}</p></section></div><section class="detail-block" style="margin-top:12px"><h3>跨营业日观察记录</h3><ol class="timeline">${observations.map((observation) => `<li><b>${esc(observation.business_date)} · ${esc(observation.rule_label)}</b><p>${esc(observation.evidence || '已记录一次规则观察。')}</p><small>${esc(observation.anomaly_status === 'auto_closed' ? '该日重算后不再触发' : observation.anomaly_status === 'closed' ? '已随工单关闭' : '触发')} · 信号 ${esc(observation.signal_id)}</small></li>`).join('')}</ol></section><div class="detail-actions">${item.active_work_order_id ? `<a class="btn" href="/work-order/?id=${encodeURIComponent(item.active_work_order_id)}">打开关联工单</a>` : item.work_order_ids?.length ? `<a class="btn secondary" href="/work-order/?id=${encodeURIComponent(item.work_order_ids.at(-1))}">查看闭环工单</a>` : ''}<a class="btn secondary" href="/flows/?store=${encodeURIComponent(item.store_code)}&material=${encodeURIComponent(item.material_name)}">查看库存流水</a><a class="btn secondary" href="/diagnosis-v3/?case=${encodeURIComponent(item.id)}">完整详情链接</a></div></div>`;
  }
  function caseRows(items) {
    if (!items.length) return '<div class="empty">当前视图没有符合条件的持续问题。</div>';
    return `<table class="case-table"><thead><tr><th>优先级</th><th>门店／物料</th><th>当前判断</th><th>持续时间</th><th>最新数据</th><th>状态／责任人</th><th>操作</th></tr></thead><tbody>${items.map((item) => `<tr class="case-row" data-case-id="${esc(item.id)}"><td><span class="priority ${item.severity === 'high' ? '' : 'mid'}">${item.severity === 'high' ? '高' : '中'}</span></td><td class="material"><b>${esc(item.store_code)} · ${esc(item.material_name)}（${esc(item.unit)}）</b><small>${esc(item.case_no)} · ${esc(item.family_label)}</small></td><td class="judgment"><b>${esc(item.current_rule_label)}</b><small>${esc(item.latest_evidence)}</small></td><td class="duration"><b>${esc(item.opened_business_date)}—${esc(item.latest_business_date)}</b><small>${days(item.opened_business_date, item.latest_business_date)} 天 · ${item.observation_count} 次观察</small></td><td class="latest-values">${esc(values(item))}</td><td class="owner"><span class="status ${item.status === 'closed' ? 'closed' : item.status === 'pending_verification' ? 'verification' : ''}">${esc(statusLabel[item.status] || item.status)}</span><small>${esc(item.assigned_to)}</small></td><td><button class="btn secondary" type="button" data-toggle-case="${esc(item.id)}">${expanded === item.id ? '收起' : '查看详情'} <span class="chevron">${expanded === item.id ? '↑' : '↓'}</span></button></td></tr>${expanded === item.id ? `<tr class="detail-row"><td colspan="7">${detail(item)}</td></tr>` : ''}`).join('')}</tbody></table>`;
  }
  function observations() {
    const rows = payload.cases.filter((item) => (filters.store === 'all' || item.store_code === filters.store) && (filters.family === 'all' || item.rule_family === filters.family)).flatMap((item) => (item.observations || []).map((observation) => ({ ...observation, case_no:item.case_no }))).sort((a,b) => String(b.business_date).localeCompare(String(a.business_date)));
    if (!rows.length) return '<div class="empty">暂无历史观察。</div>';
    return `<table class="observation-table"><thead><tr><th>营业日</th><th>持续问题</th><th>门店／物料</th><th>规则</th><th>计算结果</th><th>状态</th></tr></thead><tbody>${rows.map((item) => `<tr><td>${esc(item.business_date)}</td><td>${esc(item.case_no)}</td><td>${esc(item.store_code)} · ${esc(item.material_name)}（${esc(item.unit)}）</td><td>${esc(item.rule_label)}</td><td>${esc(item.evidence)}</td><td>${esc(item.anomaly_status)}</td></tr>`).join('')}</tbody></table>`;
  }
  function bind() {
    document.querySelectorAll('[data-toggle-case]').forEach((button) => button.onclick = () => { expanded = expanded === button.dataset.toggleCase ? null : button.dataset.toggleCase; renderTable(); });
    document.querySelectorAll('[data-case-id]').forEach((row) => row.onclick = (event) => { if (event.target.closest('button,a')) return; expanded = expanded === row.dataset.caseId ? null : row.dataset.caseId; renderTable(); });
  }
  function renderTable() {
    if (view === 'observations') by('case-table').innerHTML = observations();
    else by('case-table').innerHTML = caseRows(payload.cases.filter(isVisible));
    bind();
  }
  function render() { renderSummary(); renderFilters(); renderTable(); }
  async function load() {
    const response = await fetch('/api/inventory-cases');
    payload = await response.json();
    if (!response.ok) throw new Error(payload.error || '无法读取库存持续问题。');
    const search = new URLSearchParams(location.search);
    const requestedStore = search.get('store');
    if (requestedStore && payload.cases.some((item) => item.store_code === requestedStore)) filters.store = requestedStore;
    const requested = search.get('case');
    if (requested && payload.cases.some((item) => item.id === requested)) { expanded = requested; const selected = payload.cases.find((item) => item.id === requested); view = selected.status === 'closed' ? 'closed' : selected.status === 'pending_verification' ? 'verification' : 'active'; }
    document.querySelectorAll('[data-case-view]').forEach((button) => button.classList.toggle('active', button.dataset.caseView === view));
    render();
  }
  document.querySelectorAll('[data-case-view]').forEach((button) => button.onclick = () => { view = button.dataset.caseView; expanded = null; document.querySelectorAll('[data-case-view]').forEach((node) => node.classList.toggle('active', node === button)); renderTable(); });
  by('case-store-filter').onchange = (event) => { filters.store = event.target.value; expanded = null; renderTable(); };
  by('case-family-filter').onchange = (event) => { filters.family = event.target.value; expanded = null; renderTable(); };
  load().catch((error) => { by('case-table').innerHTML = `<div class="error">${esc(error.message)}</div>`; });
})();
