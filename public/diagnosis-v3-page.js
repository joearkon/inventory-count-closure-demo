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
  const agreementLabel = { agree:'支持规则结论', partial:'部分支持', disagree:'质疑规则结论', insufficient:'证据不足' };
  function aiPanel(item) {
    const analysis = item.latest_ai_analysis;
    if (!analysis) return `<section class="detail-block ai-panel"><div class="ai-head"><div><h3>AI 深度研判</h3><p>调用火山方舟，从竞争假设、反证和最小验证路径进一步分析；不会自动改库存或关闭工单。</p></div><button class="btn" type="button" data-ai-analyze="${esc(item.id)}">生成 AI 深度研判</button></div><small>Prompt ${esc(payload.ai?.prompt_version || '')} · 正式规则 ${esc(item.rule_version || '待回算')}</small></section>`;
    return `<section class="detail-block ai-panel"><div class="ai-head"><div><h3>AI 深度研判 <span class="ai-badge ${esc(analysis.agreement)}">${esc(agreementLabel[analysis.agreement] || analysis.agreement)}</span></h3><p class="ai-summary">${esc(analysis.summary)}</p></div><button class="btn secondary" type="button" data-ai-analyze="${esc(item.id)}">重新研判</button></div><div class="ai-meta">火山方舟 · ${esc(analysis.model)} · ${esc(analysis.prompt_version)} · ${esc(new Date(analysis.created_at).toLocaleString('zh-CN'))}${analysis.stale ? ' · 已过期' : ''}</div><div class="hypothesis-grid">${(analysis.hypotheses || []).map((hypothesis, index) => `<article><b>${index + 1}. ${esc(hypothesis.title)}</b><span class="confidence">置信度 ${esc(hypothesis.confidence)}</span><p><strong>支持：</strong>${esc((hypothesis.supporting_evidence || []).join('；') || '无')}</p><p><strong>反证：</strong>${esc((hypothesis.contradicting_evidence || []).join('；') || '无')}</p><p><strong>证伪：</strong>${esc(hypothesis.falsification_test || '待补充')}</p></article>`).join('')}</div><h4>建议验证顺序</h4><ol class="ai-steps">${(analysis.recommended_steps || []).map((step) => `<li><b>${esc(step.action)}</b><span>${esc(step.owner)} · ${esc(step.reason)}${step.system_entry ? ` · 入口：${esc(step.system_entry)}` : ''}</span></li>`).join('')}</ol>${analysis.store_questions?.length ? `<h4>需要问门店</h4><ul>${analysis.store_questions.map((question) => `<li>${esc(question)}</li>`).join('')}</ul>` : ''}<details><summary>AI 遵循的研判规则</summary><ol>${(analysis.prompt_rules || payload.ai?.rules || []).map((rule) => `<li>${esc(rule)}</li>`).join('')}</ol></details><p class="ai-guard">AI 仅提供调查建议；正式动作、定责和关闭仍需人工确认。</p></section>`;
  }
  function detail(item) {
    const observations = item.observations || [];
    return `<div class="case-detail"><div class="detail-top"><section class="detail-block"><h3>当前结论 <span class="engine-badge">正式引擎 ${esc(String(item.formal_engine || 'V1').toUpperCase())}</span></h3><p class="current-conclusion">${esc(item.primary_hypothesis || item.latest_evidence || '等待补充当前研判结论。')}</p><div class="metric-grid"><div><span>首次发现</span><b>${esc(item.opened_business_date)}</b></div><div><span>最新观察</span><b>${esc(item.latest_business_date)}</b></div><div><span>持续时间</span><b>${days(item.opened_business_date, item.latest_business_date)} 天</b></div><div><span>理论库存</span><b>${qty(item.latest_values?.theoretical_qty)} ${esc(item.unit)}</b></div><div><span>实盘库存</span><b>${qty(item.latest_values?.physical_qty)} ${esc(item.unit)}</b></div><div><span>观察次数</span><b>${item.observation_count}</b></div></div><small>${esc(item.ruleset_id || '')} · ${esc(item.rule_version || '')}</small></section><section class="detail-block"><h3>下一步</h3><p>${esc(nextAction[item.rule_family] || '补充证据后重新研判。')}</p><p>当前责任：<b>${esc(item.assigned_to)}</b></p><p>问题编号：${esc(item.case_no)}</p></section></div>${aiPanel(item)}<section class="detail-block" style="margin-top:12px"><h3>跨营业日观察记录</h3><ol class="timeline">${observations.map((observation) => `<li><b>${esc(observation.business_date)} · ${esc(observation.rule_label)}</b><p>${esc(observation.primary_hypothesis || observation.evidence || '已记录一次规则观察。')}</p><small>${esc(observation.anomaly_status === 'auto_closed' ? '该日重算后不再触发' : observation.anomaly_status === 'closed' ? '已随工单关闭' : '触发')} · ${esc(String(observation.formal_engine || 'v1').toUpperCase())} · 信号 ${esc(observation.signal_id)}</small></li>`).join('')}</ol></section><div class="detail-actions">${item.active_work_order_id ? `<a class="btn" href="/work-order/?id=${encodeURIComponent(item.active_work_order_id)}">打开关联工单</a>` : item.work_order_ids?.length ? `<a class="btn secondary" href="/work-order/?id=${encodeURIComponent(item.work_order_ids.at(-1))}">查看闭环工单</a>` : ''}<a class="btn secondary" href="/flows/?store=${encodeURIComponent(item.store_code)}&material=${encodeURIComponent(item.material_name)}">查看库存流水</a><a class="btn secondary" href="/diagnosis-v3/?case=${encodeURIComponent(item.id)}">完整详情链接</a></div></div>`;
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
    document.querySelectorAll('[data-ai-analyze]').forEach((button) => button.onclick = async () => {
      const original = button.textContent; button.disabled = true; button.textContent = 'AI 研判中…';
      try {
        const response = await fetch(`/api/inventory-cases/${encodeURIComponent(button.dataset.aiAnalyze)}/ai-analysis`, { method:'POST', headers:{ 'Content-Type':'application/json' }, body:'{}' });
        const result = await response.json(); if (!response.ok) throw new Error(result.error || 'AI 研判失败'); await load();
      } catch (error) { alert(error.message); button.disabled = false; button.textContent = original; }
    });
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
