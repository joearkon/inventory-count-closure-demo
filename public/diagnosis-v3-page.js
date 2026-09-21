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
  let payload = null, view = 'active', expanded = null, workOrderDraft = null;
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
  const ruleActionLabel = { VIEW_PURCHASE:'查看订货与在途', VIEW_RECEIPTS:'查看收货单', VIEW_TRANSFER:'查看调拨单', VERIFY_DESTINATION_ACCEPTANCE:'核对目标门店签收', CREATE_SPOT_COUNT:'下发单物料临时盘点', VIEW_FLOWS:'查看相关库存流水', CREATE_RECEIPT_DRAFT:'建立收货补录草稿', CREATE_RESTOCK_DRAFT:'建立紧急补货草稿' };
  const planned = (item, sourceRef) => (item.action_plan || []).find((action) => action.source_ref === sourceRef);
  const actionControl = (item, action) => action ? `<span class="plan-accepted">已纳入工单 · ${esc(action.owner || '待分配')}</span>` : `<span class="plan-candidate">${item.active_work_order_id ? '尚未纳入当前工单' : '可在建单时选择'}</span>`;
  function workOrderSuggestions(item) {
    const rule = (item.recommended_action_ids || []).map((actionId) => ({ key:`rule:${actionId}`, source:'rule', action_id:actionId, title:ruleActionLabel[actionId] || actionId, reason:item.primary_hypothesis || item.latest_evidence || '根据规则结论补充证据。', owner:item.assigned_to || '待分配' }));
    const analysis = item.latest_ai_analysis;
    const ai = (analysis?.recommended_steps || []).map((step, index) => ({ key:`ai:${analysis.id}:${index}`, source:'ai', analysis_id:analysis.id, step_index:index, title:step.action, reason:step.reason || analysis.summary || '由 AI 建议补充验证。', owner:step.owner || item.assigned_to || '待分配' }));
    return [...rule, ...ai];
  }
  function workOrderPanel(item) {
    if (item.active_work_order_id) return `<section class="detail-block work-order-gate created"><div class="work-order-steps"><span class="done"><i>1</i>创建工单</span><span class="done"><i>2</i>采纳建议</span><span class="done"><i>3</i>完成创建</span></div><div class="gate-main"><div><h3>该问题已进入工单跟踪</h3><p>工单 ${esc(item.active_work_order_id)} 已建立；已选择的建议只在工单内执行、补证和闭环。</p></div><a class="btn" href="/work-order/?portal=hq&amp;id=${encodeURIComponent(item.active_work_order_id)}">查看关联工单</a></div></section>`;
    if (item.status === 'closed') return '';
    const draft = workOrderDraft?.caseId === item.id ? workOrderDraft : null;
    if (!draft) return `<section class="detail-block work-order-gate"><div class="work-order-steps"><span class="current"><i>1</i>创建工单</span><span><i>2</i>采纳建议</span><span><i>3</i>完成创建</span></div><div class="gate-main"><div><h3>需要持续跟踪这个问题吗？</h3><p>先建立拟建工单，再从规则或 AI 建议中选择要执行的事项；确认前不会下发给门店。</p></div><button class="btn" type="button" data-start-work-order="${esc(item.id)}">创建跟进工单</button></div></section>`;
    const suggestions = workOrderSuggestions(item);
    return `<section class="detail-block work-order-gate drafting"><div class="work-order-steps"><span class="done"><i>✓</i>创建工单</span><span class="current"><i>2</i>采纳建议</span><span><i>3</i>完成创建</span></div><div class="draft-summary"><div><small>拟建工单</small><h3>${esc(item.material_name)}（${esc(item.unit)}）· ${esc(item.current_rule_label)}</h3><p>责任方：${esc(item.store_code)} 店长 · 来源：${esc(item.case_no)} · 营业日 ${esc(item.latest_business_date)}</p></div><span>尚未下发</span></div><h4>选择纳入工单的执行项</h4><p class="section-help">系统预选优先级最高的两项，你可以增删；未选择的建议仍保留在研判中。</p><div class="suggestion-picker">${suggestions.map((suggestion, index) => `<label class="suggestion-choice ${draft.selected.has(suggestion.key) ? 'selected' : ''}"><input type="checkbox" data-draft-suggestion="${esc(suggestion.key)}" ${draft.selected.has(suggestion.key) ? 'checked' : ''}><i>${index + 1}</i><span><b>${esc(suggestion.title)}</b><small>${suggestion.source === 'ai' ? 'AI 建议' : '规则建议'} · ${esc(suggestion.owner)}</small><em>${esc(suggestion.reason)}</em></span></label>`).join('') || '<div class="empty">当前没有可纳入的建议，请先运行规则或 AI 研判。</div>'}</div><div class="draft-actions"><button class="btn secondary" type="button" data-cancel-work-order="${esc(item.id)}">取消</button><span>已选择 <b>${draft.selected.size}</b> 项</span><button class="btn" type="button" data-finish-work-order="${esc(item.id)}" ${draft.selected.size ? '' : 'disabled'}>完成创建工单</button></div></section>`;
  }
  function ruleActionPanel(item) {
    const ids = item.recommended_action_ids || [];
    if (!ids.length) return '';
    return `<section class="detail-block unified-plan"><div class="plan-title"><div><h3>规则建议行动</h3><p>这些是建单候选，不是已经下发的任务；创建工单时可选择部分纳入。</p></div><span>V2 ${esc(item.rule_version || '')}</span></div><div class="plan-list">${ids.map((actionId, index) => { const ref = `${item.fact_packet_id || item.id}:${actionId}`, action = planned(item, ref); return `<article><i>${index + 1}</i><div><b>${esc(ruleActionLabel[actionId] || actionId)}</b><small>来源：确定性规则 · 待运营选择</small></div><div class="plan-control">${actionControl(item, action)}</div></article>`; }).join('')}</div></section>`;
  }
  function aiPanel(item) {
    const analysis = item.latest_ai_analysis;
    if (!analysis) return `<section class="detail-block ai-panel"><div class="ai-head"><div><h3>AI 深度研判</h3><p>调用火山方舟，从竞争假设、反证和最小验证路径进一步分析；不会自动改库存或关闭工单。</p></div><button class="btn" type="button" data-ai-analyze="${esc(item.id)}">生成 AI 深度研判</button></div><small>Prompt ${esc(payload.ai?.prompt_version || '')} · 正式规则 ${esc(item.rule_version || '待回算')}</small></section>`;
    const steps = (analysis.recommended_steps || []).map((step, index) => {
      const sourceRef = `${analysis.id}:${index}`;
      const action = planned(item, sourceRef);
      return `<li><div class="step-copy"><b>${esc(step.action)}</b><span>${esc(step.owner)} · ${esc(step.reason)}${step.system_entry ? ` · 入口：${esc(step.system_entry)}` : ''}</span></div><div class="plan-control">${actionControl(item, action)}</div></li>`;
    }).join('');
    return `<section class="detail-block ai-panel"><div class="ai-head"><div><h3>AI 深度研判 <span class="ai-badge ${esc(analysis.agreement)}">${esc(agreementLabel[analysis.agreement] || analysis.agreement)}</span></h3><p class="ai-summary">${esc(analysis.summary)}</p></div><button class="btn secondary" type="button" data-ai-analyze="${esc(item.id)}">重新研判</button></div><div class="ai-meta">火山方舟 · ${esc(analysis.model)} · ${esc(analysis.prompt_version)} · ${esc(new Date(analysis.created_at).toLocaleString('zh-CN'))}${analysis.stale ? ' · 已过期' : ''}</div><div class="hypothesis-grid">${(analysis.hypotheses || []).map((hypothesis, index) => `<article><b>${index + 1}. ${esc(hypothesis.title)}</b><span class="confidence">置信度 ${esc(hypothesis.confidence)}</span><p><strong>支持：</strong>${esc((hypothesis.supporting_evidence || []).join('；') || '无')}</p><p><strong>反证：</strong>${esc((hypothesis.contradicting_evidence || []).join('；') || '无')}</p><p><strong>证伪：</strong>${esc(hypothesis.falsification_test || '待补充')}</p></article>`).join('')}</div><h4>建议验证顺序</h4><p class="section-help">AI 建议同样只是建单候选；由运营选择后，才进入工单执行清单。</p><ol class="ai-steps">${steps}</ol>${analysis.store_questions?.length ? `<h4>需要问门店</h4><ul>${analysis.store_questions.map((question) => `<li>${esc(question)}</li>`).join('')}</ul>` : ''}<details><summary>AI 遵循的研判规则</summary><ol>${(analysis.prompt_rules || payload.ai?.rules || []).map((rule) => `<li>${esc(rule)}</li>`).join('')}</ol></details><p class="ai-guard">AI 仅提供调查建议；正式动作、定责和关闭仍需人工确认。</p></section>`;
  }
  function detail(item) {
    const observations = item.observations || [];
    return `<div class="case-detail"><div class="detail-top"><section class="detail-block"><h3>当前结论 <span class="engine-badge">正式引擎 ${esc(String(item.formal_engine || 'V1').toUpperCase())}</span></h3><p class="current-conclusion">${esc(item.primary_hypothesis || item.latest_evidence || '等待补充当前研判结论。')}</p><div class="metric-grid"><div><span>首次发现</span><b>${esc(item.opened_business_date)}</b></div><div><span>最新观察</span><b>${esc(item.latest_business_date)}</b></div><div><span>持续时间</span><b>${days(item.opened_business_date, item.latest_business_date)} 天</b></div><div><span>理论库存</span><b>${qty(item.latest_values?.theoretical_qty)} ${esc(item.unit)}</b></div><div><span>实盘库存</span><b>${qty(item.latest_values?.physical_qty)} ${esc(item.unit)}</b></div><div><span>观察次数</span><b>${item.observation_count}</b></div></div><small>${esc(item.ruleset_id || '')} · ${esc(item.rule_version || '')}</small></section><section class="detail-block"><h3>下一步</h3><p>${esc(nextAction[item.rule_family] || '补充证据后重新研判。')}</p><p>当前责任：<b>${esc(item.assigned_to)}</b></p><p>问题编号：${esc(item.case_no)}</p></section></div>${workOrderPanel(item)}${ruleActionPanel(item)}${aiPanel(item)}<section class="detail-block" style="margin-top:12px"><h3>跨营业日观察记录</h3><ol class="timeline">${observations.map((observation) => `<li><b>${esc(observation.business_date)} · ${esc(observation.rule_label)}</b><p>${esc(observation.primary_hypothesis || observation.evidence || '已记录一次规则观察。')}</p><small>${esc(observation.anomaly_status === 'auto_closed' ? '该日重算后不再触发' : observation.anomaly_status === 'closed' ? '已随工单关闭' : '触发')} · ${esc(String(observation.formal_engine || 'v1').toUpperCase())} · 信号 ${esc(observation.signal_id)}</small></li>`).join('')}</ol></section><div class="detail-actions"><a class="btn secondary" href="/flows/?store=${encodeURIComponent(item.store_code)}&amp;material=${encodeURIComponent(item.material_name)}">查看库存流水</a><a class="btn secondary" href="/diagnosis-v3/?case=${encodeURIComponent(item.id)}">完整详情链接</a></div></div>`;
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
    document.querySelectorAll('[data-start-work-order]').forEach((button) => button.onclick = () => {
      const item = payload.cases.find((row) => row.id === button.dataset.startWorkOrder);
      const suggestions = item ? workOrderSuggestions(item) : [];
      workOrderDraft = { caseId:item.id, selected:new Set(suggestions.slice(0, 2).map((suggestion) => suggestion.key)) };
      renderTable();
    });
    document.querySelectorAll('[data-draft-suggestion]').forEach((checkbox) => checkbox.onchange = () => {
      if (!workOrderDraft) return;
      if (checkbox.checked) workOrderDraft.selected.add(checkbox.dataset.draftSuggestion);
      else workOrderDraft.selected.delete(checkbox.dataset.draftSuggestion);
      renderTable();
    });
    document.querySelectorAll('[data-cancel-work-order]').forEach((button) => button.onclick = () => { workOrderDraft = null; renderTable(); });
    document.querySelectorAll('[data-finish-work-order]').forEach((button) => button.onclick = async () => {
      const item = payload.cases.find((row) => row.id === button.dataset.finishWorkOrder);
      const suggestions = item ? workOrderSuggestions(item) : [];
      const selected = suggestions.filter((suggestion) => workOrderDraft?.caseId === item.id && workOrderDraft.selected.has(suggestion.key));
      if (!selected.length) return alert('请至少选择一项建议。');
      const original = button.textContent;
      button.disabled = true;
      button.textContent = '正在创建工单…';
      const body = { selections:selected.map((suggestion) => suggestion.source === 'ai'
        ? { source:'ai', analysis_id:suggestion.analysis_id, step_index:suggestion.step_index }
        : { source:'rule', action_id:suggestion.action_id }) };
      try {
        const response = await fetch(`/api/inventory-cases/${encodeURIComponent(item.id)}/work-orders`, { method:'POST', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify(body) });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || '无法创建工单');
        workOrderDraft = null;
        location.href = `/work-order/?portal=hq&id=${encodeURIComponent(result.work_order.id)}`;
      } catch (error) {
        alert(error.message);
        button.disabled = false;
        button.textContent = original;
      }
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
