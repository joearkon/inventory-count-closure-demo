(() => {
  const RULES = {
    NEGATIVE_THEORETICAL: { rank: 1, code: 'D2', title: '负库存', action: '核对调拨、收货与订货', link: '/flows/', note: '理论库存低于 0；先查收货、调拨、期初与单位。' },
    COUNT_VARIANCE: { rank: 2, code: 'D1', title: '理论与实盘差异', action: '复核盘点与报损', link: '/flows/', note: '实盘与理论差异超过阈值；核对盘点、报损、收货与换算。' },
    BELOW_SAFETY_STOCK: { rank: 3, code: 'S1', title: '安全库存预警', action: '确认补货或调拨', link: '/flows/', note: '理论期末低于安全库存；结合销售消耗与在途补货处理。' },
    SELL_IN_IMBALANCE: { rank: 4, code: 'T2', title: '销入比失衡', action: '核对补货节奏', link: '/flows/', note: '销售消耗与入库量比例超过 MVP 阈值。' }
  };
  let payload = null, view = 'store';
  let currentPage = 1;
  const filters = { store: 'all', rule: 'all', attribution: 'all' };
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' }[c]));
  const qty = (value) => Number(value || 0).toLocaleString('zh-CN', { maximumFractionDigits: 3 });
  const active = () => (payload?.materialAnomalies || []).filter((item) => RULES[item.rule_code] && !['closed', 'auto_closed'].includes(item.status));
  const taskFor = (signal) => (payload?.operationTasks || []).find((task) => task.source_anomaly_id === signal.id && task.status !== 'closed');
  const taskLabel = (task) => task.status === 'pending_store_submission' ? '门店处理中' : task.status === 'pending_hq_review' ? '待总部确认' : '待处理';
  const dateOffset = (date, offset) => { const value = new Date(`${date}T12:00:00`); value.setDate(value.getDate() + offset); return value.toISOString().slice(0, 10); };

  function attribution(signal) {
    const detail = signal.evidence_detail || {};
    if (signal.rule_code === 'NEGATIVE_THEORETICAL') return 'receipt_transfer';
    if (signal.rule_code === 'COUNT_VARIANCE') return Number(detail.physical_delta || 0) < 0 ? 'count_loss' : 'receipt_transfer';
    if (signal.rule_code === 'SELL_IN_IMBALANCE') return 'restock';
    if (signal.rule_code === 'BELOW_SAFETY_STOCK') return 'restock';
    return 'master_data';
  }
  function attributionLabel(code) {
    return ({ receipt_transfer: '收货／调拨', count_loss: '盘点／报损', restock: '门店补货', master_data: '商品／主数据' }[code] || '待验证');
  }
  function primary(signal) {
    const info = signal.evidence_detail || {};
    if (signal.rule_code === 'NEGATIVE_THEORETICAL') {
      if (Number(info.transfer_out || 0) > 0) return { title: '优先核对调拨出库与签收', text: `系统已记录调拨出库 ${qty(info.transfer_out)} ${signal.unit}，当前理论库存为负；请核对目标门店签收与本店出库记录。` };
      return { title: '优先核对到货与收货录入', text: '当前理论库存为负，优先确认是否存在已到货但尚未入库的收货记录。' };
    }
    if (signal.rule_code === 'COUNT_VARIANCE') return Number(info.physical_delta || 0) < 0
      ? { title: '优先核对盘点与报损', text: '实盘低于理论库存，优先复核盘点数量、报损及未记录出库。' }
      : { title: '优先核对收货或调拨入库', text: '实盘高于理论库存，优先确认漏记的收货、调拨入库或单位换算。' };
    if (signal.rule_code === 'BELOW_SAFETY_STOCK') return { title: '优先安排补货或调拨', text: '理论期末库存已低于安全库存，先确认门店近期需求与可用在途。' };
    return { title: '优先核对消耗与补货节奏', text: '消耗与收货比例异常，优先核对销售消耗、收货记录和补货频率。' };
  }
  function rollingFlows(signal) {
    const info = signal.evidence_detail || {}, unit = signal.unit || '', currentDate = signal.business_date;
    const empty = { receipt: 0, transferIn: 0, transferOut: 0, scrap: 0, consumption: 0 };
    const total = { receipt: Number(info.receipt_qty || 0), transferIn: Number(info.transfer_in_qty || 0), transferOut: Number(info.transfer_out_qty || 0), scrap: Number(info.scrap_qty || 0), consumption: Number(info.bom_consumption_qty || 0) };
    const earliest = currentDate ? dateOffset(currentDate, -2) : '';
    const previous = (payload?.ledgerSnapshots || []).filter((snapshot) => snapshot.store_code === signal.store_code && snapshot.business_date >= earliest && snapshot.business_date < currentDate).sort((a, b) => String(a.business_date).localeCompare(String(b.business_date)));
    for (const snapshot of previous) {
      const row = (snapshot.lines || []).find((line) => line.material_name === signal.material_name && line.unit === unit);
      if (!row) continue;
      total.receipt += Number(row.receipt_qty || 0); total.transferIn += Number(row.transfer_in_qty || 0); total.transferOut += Number(row.transfer_out_qty || 0); total.scrap += Number(row.scrap_qty || 0); total.consumption += Number(row.bom_consumption_qty || 0);
    }
    const events = (payload?.materialEvents || []).filter((event) => event.store_code === signal.store_code && event.material_name === signal.material_name && event.unit === unit && event.business_date >= earliest && event.business_date <= currentDate);
    const eventTotal = { receipt: 0, transferIn: 0, transferOut: 0, scrap: 0 };
    const eventCount = { receipt: 0, transferIn: 0, transferOut: 0, scrap: 0 };
    for (const event of events) {
      const key = ({ receipt: 'receipt', transfer_in: 'transferIn', transfer_out: 'transferOut', scrap: 'scrap' }[event.type]);
      if (!key) continue;
      eventTotal[key] += Number(event.qty || 0); eventCount[key] += 1;
    }
    const hasRawEvents = events.length > 0;
    return { current: { receipt: Number(info.receipt_qty || 0), transferIn: Number(info.transfer_in_qty || 0), transferOut: Number(info.transfer_out_qty || 0), scrap: Number(info.scrap_qty || 0), consumption: Number(info.bom_consumption_qty || 0) }, total: { ...empty, ...total, ...(hasRawEvents ? eventTotal : {}) }, eventCount, historyDays: previous.length, rawEventCount: events.length, earliest, currentDate };
  }
  function flowText(flow, unit) {
    return `收货 ${qty(flow.receipt)} · 调拨入 ${qty(flow.transferIn)} · 调拨出 ${qty(flow.transferOut)} · 报损 ${qty(flow.scrap)} · 销售 BOM 消耗 ${qty(flow.consumption)} ${unit}`;
  }
  function evidence(signal) {
    const info = signal.evidence_detail || {}, unit = signal.unit || '', flows = rollingFlows(signal);
    const lines = [];
    if ('theoretical_qty' in info) lines.push(`理论期末 ${qty(info.theoretical_qty)} ${unit}${'opening_qty' in info ? `；期初 ${qty(info.opening_qty)} ${unit}` : ''}`);
    lines.push(`当日流水（${flows.currentDate || '当前营业日'}）：${flowText(flows.current, unit)}`);
    if (flows.currentDate) lines.push(`近 3 日入库证据（${flows.earliest} 至 ${flows.currentDate}）：收货 ${qty(flows.total.receipt)} ${unit}（${flows.eventCount.receipt} 笔）· 调拨入 ${qty(flows.total.transferIn)} ${unit}（${flows.eventCount.transferIn} 笔）`);
    if (flows.currentDate) lines.push(`近 3 日其他流水：调拨出 ${qty(flows.total.transferOut)} ${unit}（${flows.eventCount.transferOut} 笔）· 报损 ${qty(flows.total.scrap)} ${unit}（${flows.eventCount.scrap} 笔）· 销售 BOM 消耗 ${qty(flows.total.consumption)} ${unit}${flows.historyDays ? `；含 ${flows.historyDays} 天已固化历史台账` : '；历史日结尚未沉淀，仅能核验当日实时台账'}`);
    if (signal.rule_code === 'COUNT_VARIANCE') lines.push(`实盘 ${qty(info.physical_qty)} ${unit}，差异 ${Number(info.physical_delta || 0) > 0 ? '+' : ''}${qty(info.physical_delta)} ${unit}`);
    if (signal.rule_code === 'BELOW_SAFETY_STOCK') lines.push(`安全库存 ${qty(signal.safety_qty)} ${unit}，缺口 ${qty(Math.max(0, Number(signal.safety_qty || 0) - Number(info.theoretical_qty || 0)))} ${unit}`);
    if (signal.rule_code === 'SELL_IN_IMBALANCE') lines.push(`销入比 ${info.sell_in_ratio == null ? '无收货基数' : qty(info.sell_in_ratio)}，MVP 触发阈值：高于 2 或低于 0.3`);
    return lines.length ? lines : [signal.evidence || '当前证据快照待补充。'];
  }
  function updateOptions() {
    const select = document.querySelector('#store-filter');
    const stores = [...new Set(active().map((item) => item.store_code).filter(Boolean))].sort();
    select.innerHTML = `<option value="all">全部门店</option>${stores.map((code) => `<option value="${esc(code)}">${esc(code)}</option>`).join('')}`;
    select.value = stores.includes(filters.store) ? filters.store : 'all';
  }
  function filtered() {
    return active().filter((item) => (filters.store === 'all' || item.store_code === filters.store) && (filters.rule === 'all' || item.rule_code === filters.rule) && (filters.attribution === 'all' || attribution(item) === filters.attribution)).sort((a, b) => RULES[a.rule_code].rank - RULES[b.rule_code].rank);
  }
  function summary() {
    const items = filtered();
    document.querySelector('#summary').innerHTML = Object.entries(RULES).map(([key, rule]) => `<div class="metric"><b>${items.filter((item) => item.rule_code === key).length}</b><span>${rule.code} · ${rule.title}</span></div>`).join('');
  }
  function issueCard(signal) {
    const rule = RULES[signal.rule_code], location = primary(signal), task = taskFor(signal);
    const extra = `store=${encodeURIComponent(signal.store_code || '')}&material=${encodeURIComponent(signal.material_name || '')}`;
    const taskButton = task
      ? `<a class="button secondary" href="/?focus=operation&task=${encodeURIComponent(task.id)}">查看跟进工单</a>`
      : `<button class="button" data-create-work-order="${esc(signal.id)}">建立跟进工单</button>`;
    return `<article class="issue"><div class="issue-head"><div><div class="issue-title"><span class="rule ${rule.code === 'D2' ? '' : 'mid'}">${rule.code}</span><h3>${esc(signal.material_name)}（${esc(signal.unit)}）</h3><span class="rule-note" title="${esc(rule.note)}">规则说明</span></div><p class="subline">${esc(signal.store_code)} · ${esc(signal.business_date || '')} · 首要归因：${attributionLabel(attribution(signal))}</p></div><span class="status ${task ? '' : (signal.status === 'no_issue' ? 'no-issue' : '')}">${task ? `工单 · ${taskLabel(task)}` : (signal.status === 'no_issue' ? '排查无异常' : '待处理')}</span></div><div class="finding"><span class="label">首要排查</span><b>${esc(location.title)}</b><p>${esc(location.text)}</p></div><div class="evidence"><h4>直接证据</h4><ul>${evidence(signal).map((line) => `<li>${esc(line)}</li>`).join('')}</ul></div><div class="next"><h4>下一步</h4><p>${esc(rule.action)}</p></div><div class="actions"><a class="button secondary" href="${rule.link}?${extra}">查看相关流水</a>${taskButton}<button class="button ghost" data-no-issue="${esc(signal.id)}">排查无异常</button></div><div class="meta">研判编号：${esc(signal.id)} · 规则更新时间：${esc(signal.updated_at || signal.created_at || '—')}</div></article>`;
  }
  function renderList() {
    const root = document.querySelector('#diagnosis-list'), items = filtered();
    const page = window.ListPager.slice(items, currentPage, 10); currentPage = page.page;
    window.ListPager.render('diagnosis-pager', page, (next) => { currentPage = next; render(); });
    if (!page.items.length) { root.innerHTML = '<div class="empty">当前筛选条件下没有需要处理的库存问题。</div>'; return bindActions(); }
    const grouped = new Map();
    for (const item of page.items) {
      const key = view === 'store' ? (item.store_code || '未归属门店') : `${item.material_name}｜${item.unit || ''}`;
      if (!grouped.has(key)) grouped.set(key, []); grouped.get(key).push(item);
    }
    root.innerHTML = [...grouped.entries()].map(([key, signals]) => `<section class="group"><div class="group-head"><div><h2>${esc(key)}</h2><p>${view === 'store' ? '该门店当前需要优先处理的库存问题' : '该物料在不同门店的库存问题'}</p></div><span class="count">${signals.length} 项</span></div>${signals.map(issueCard).join('')}</section>`).join('');
    bindActions();
  }
  function render() { updateOptions(); summary(); renderList(); document.querySelectorAll('[data-view]').forEach((button) => button.classList.toggle('active', button.dataset.view === view)); }
  async function mutate(id, action) {
    const response = await fetch(`/api/anomalies/${encodeURIComponent(id)}/${action}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: action === 'mvp-action' ? JSON.stringify({ status: 'no_issue' }) : undefined });
    const result = await response.json(); if (!response.ok) throw new Error(result.error || '操作失败。'); payload = result; render();
  }
  function bindActions() {
    document.querySelectorAll('[data-create-work-order]').forEach((button) => button.onclick = async () => { button.disabled = true; try { await mutate(button.dataset.createWorkOrder, 'work-order'); } catch (error) { alert(error.message); button.disabled = false; } });
    document.querySelectorAll('[data-no-issue]').forEach((button) => button.onclick = async () => { button.disabled = true; try { await mutate(button.dataset.noIssue, 'mvp-action'); } catch (error) { alert(error.message); button.disabled = false; } });
  }
  async function load() {
    try { const response = await fetch('/api/feishu-sync/state?view=diagnosis'); payload = await response.json(); if (!response.ok) throw new Error(payload.error || '无法读取库存研判数据。'); render(); }
    catch (error) { document.querySelector('#diagnosis-list').innerHTML = `<div class="error">${esc(error.message || '无法读取库存研判数据。')}</div>`; }
  }
  document.querySelectorAll('[data-view]').forEach((button) => button.onclick = () => { view = button.dataset.view; currentPage = 1; render(); });
  document.querySelector('#store-filter').onchange = (event) => { filters.store = event.target.value; currentPage = 1; render(); };
  document.querySelector('#rule-filter').onchange = (event) => { filters.rule = event.target.value; currentPage = 1; render(); };
  document.querySelector('#attribution-filter').onchange = (event) => { filters.attribution = event.target.value; currentPage = 1; render(); };
  load();
})();
