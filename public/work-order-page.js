(() => {
  'use strict';
  const root = document.getElementById('work-order-root');
  const id = new URLSearchParams(location.search).get('id') || '';
  const esc = (value) => String(value == null ? '' : value).replace(/[&<>'"]/g, (char) => ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;' }[char]));
  const api = async (path, options = {}) => {
    const response = await fetch(path, { headers:{ 'Content-Type':'application/json' }, ...options });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || '服务暂不可用');
    return data;
  };
  const formatDate = (value) => value ? new Intl.DateTimeFormat('zh-CN', { year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', hour12:false }).format(new Date(value)) : '—';
  const statusInfo = (status) => ({
    pending_store_submission:{ label:'门店处理中', css:'' },
    pending_hq_review:{ label:'待总部确认', css:'review' },
    closed:{ label:'已闭环', css:'closed' }
  }[status] || { label:'待处理', css:'' });
  const typeText = (type) => ({ custom:'主动运营任务', diagnosis_negative_inventory:'负库存核查', diagnosis_count_variance:'盘点差异复核', diagnosis_safety_stock:'安全库存跟进', diagnosis_sell_in_ratio:'销入比核查', receipt_evidence:'收货凭证核查', sku_inventory_check:'SKU 库存核查', inventory_receipt_check:'收货与库存核查', qa_regression:'测试工单' }[type] || '跟进工单');
  const timeline = ({ task, audits }) => {
    const rows = [{ title:'工单已创建', detail:task.instruction, actor:'—', time:task.created_at }];
    (audits || []).slice().reverse().forEach((item) => rows.push({ title:item.action, detail:item.detail, actor:item.actor_role || '—', time:item.created_at }));
    if (task.submitted_at && !rows.some((item) => item.time === task.submitted_at)) rows.push({ title:'门店已提交处理凭证', detail:task.proof_filename || '凭证已归档', actor:'—', time:task.submitted_at });
    if (task.closed_at && !rows.some((item) => item.time === task.closed_at)) rows.push({ title:'工单已闭环', detail:task.resolution || '处理完成', actor:'—', time:task.closed_at });
    return rows.sort((a, b) => new Date(a.time || 0) - new Date(b.time || 0));
  };
  const sourceHtml = (data) => {
    const { task, anomaly } = data;
    if (!anomaly) return '<strong>当前判断来源：人工创建</strong>暂未关联库存研判；后续自动建议应作为新的处理记录追加，不覆盖原始记录。';
    const code = task.source_rule_code || anomaly.rule_code || '未标注规则';
    const location = anomaly.primary_location?.title || anomaly.primary_attribution || '待验证位置';
    return `<strong>当前判断来源：规则引擎 · ${esc(code)}</strong>${esc(anomaly.material_name || '')}${anomaly.unit ? `（${esc(anomaly.unit)}）` : ''} · ${esc(location)}<br>关联研判：${esc(anomaly.judgment_task_no || anomaly.id)}`;
  };
  const evidenceStatus = (value) => ({ confirmed:'已确认', suspect:'疑似', insufficient:'证据不足', pending_count:'待盘点', unknown:'未知', partial:'部分数据', unlinked:'未关联', triggered:'仍触发', not_triggered:'已恢复' }[value] || value || '未知');
  const triggerText = (value) => ({ work_order_created:'建立工单', manual_reassess:'人工重算', closure_verification:'闭环校验', receipt_confirmed:'收货确认', transfer_received:'调拨签收', count_completed:'盘点完成' }[value] || String(value || '系统重算').replace(/_confirmed$/, '确认后重算'));
  const runCard = (run, label) => {
    if (!run) return `<div class="compare-card empty"><b>${esc(label)}</b><span>尚无已保存的 V2 快照</span></div>`;
    const theoretical = run.theoretical_closing?.value;
    const physical = run.physical_count?.value;
    return `<div class="compare-card"><div class="compare-title"><b>${esc(label)}</b><span>${formatDate(run.created_at)}</span></div><div class="compare-status ${run.anomaly_status === 'not_triggered' ? 'recovered' : ''}">${esc(evidenceStatus(run.anomaly_status))}</div><h3>${esc(run.primary_location || '待判断')}</h3><p>${esc(run.primary_hypothesis || '—')}</p><dl><div><dt>触发方式</dt><dd>${esc(triggerText(run.trigger))}</dd></div><div><dt>规则版本</dt><dd>${esc(run.rule_version || '—')}</dd></div><div><dt>理论库存</dt><dd>${theoretical == null ? '—' : `${esc(theoretical)} ${esc(run.source_signal?.unit || '')}`}</dd></div><div><dt>实盘库存</dt><dd>${physical == null ? '未取得' : `${esc(physical)} ${esc(run.source_signal?.unit || '')}`}</dd></div><div><dt>缺失证据</dt><dd>${(run.evidence_gaps || []).length} 项</dd></div></dl><small>${esc(run.calculation?.formula || '')}</small></div>`;
  };
  const actionUrl = (route, task, material, date) => {
    if (!route) return '';
    const url = new URL(route, location.origin);
    url.searchParams.set('source_work_order_id', task.id); url.searchParams.set('store', task.store_code || '');
    if (material) url.searchParams.set('material', material); if (date) url.searchParams.set('date', date);
    return `${url.pathname}${url.search}${url.hash}`;
  };
  const diagnosisHtml = (data) => {
    const current = data.diagnosis_v2;
    if (!current?.comparison) return '<div class="empty">该工单未关联可运行的 V2 研判。</div>';
    const { comparison } = current, result = comparison.v2, packet = comparison.fact_packet, runs = data.diagnosis_runs || [];
    const gaps = (result.evidence_gaps || []).length ? `<ul class="evidence-list">${result.evidence_gaps.map((item) => `<li><b>${esc(item.label)}</b> · ${esc(evidenceStatus(item.state))}<br><span>${esc(item.explanation || '')}</span></li>`).join('')}</ul>` : '<div class="good">当前没有待补充的关键证据。</div>';
    const trace = (result.decision_trace || []).map((item) => `<li><b>${esc(item.node_id)}</b> ${esc(item.message)}</li>`).join('');
    const latestSavedRun = runs.at(-1), q = packet.quantities, three = packet.windows?.three_days;
    const formula = latestSavedRun?.calculation?.formula || `${q.opening.value} + ${q.receipt.value} + ${q.transfer_in.value} - ${q.transfer_out.value} - ${q.scrap.value} - ${q.bom_consumption.value} = ${q.theoretical_closing.value} ${comparison.unit}`;
    const actions = (result.actions || []).map((item) => item.route ? `<a class="mini-action" href="${esc(actionUrl(item.route, data.task, comparison.material_name, comparison.business_date))}">${esc(item.label)}</a>` : `<span class="mini-action manual">${esc(item.label)} · 人工确认</span>`).join('');
    const first = runs[0], latest = runs.at(-1);
    const delta = first && latest ? `<div class="compare-summary">${first.id === latest.id ? '当前仅有首次快照；完成收货、调拨签收、盘点或手动重算后，这里将显示变化。' : `已保存 ${runs.length} 次快照：${evidenceStatus(first.anomaly_status)} → ${evidenceStatus(latest.anomaly_status)}；首要位置：${esc(first.primary_location || '待判断')} → ${esc(latest.primary_location || '待判断')}。`}</div>` : '';
    const comparisonCards = runs.length ? `<h4>首次与最新 V2 对比</h4><div class="run-compare">${runCard(first, '首次 V2')}${runCard(latest, '最新 V2')}</div>${delta}${runs.length > 2 ? `<details class="run-history"><summary>查看全部 ${runs.length} 次重算</summary>${runs.map((run, index) => `<span>${index + 1}. ${formatDate(run.created_at)} · ${esc(triggerText(run.trigger))} · ${esc(evidenceStatus(run.anomaly_status))} · ${esc(run.primary_location || '待判断')}</span>`).join('')}</details>` : ''}` : '<div class="run-history"><b>当前为动态预览</b><span>点击重新研判后保存第一份工单快照。</span></div>';
    return `<div class="v2-head"><div><span class="v2-label">规则 V2 · ${esc(result.rule_version)}</span><h3>${esc(result.primary_location)}</h3><p>${esc(result.primary_hypothesis)}</p></div><div class="v2-states"><span>${esc(evidenceStatus(result.anomaly_status))}</span><span>${esc(evidenceStatus(result.cause_evidence_status))}</span><span>${esc(evidenceStatus(result.physical_status))}</span></div></div><div class="v2-balance"><b>库存重建公式</b><br>${esc(formula)}<br><span>理论期末 ${esc(packet.quantities.theoretical_closing.value)} ${esc(comparison.unit)} · 实盘 ${packet.physical_count.value == null ? '未取得' : `${esc(packet.physical_count.value)} ${esc(comparison.unit)}`}</span>${three ? `<br><span>近 3 日：收货 ${esc(three.totals.receipt)}、调拨入 ${esc(three.totals.transfer_in)}、调拨出 ${esc(three.totals.transfer_out)}、报损 ${esc(three.totals.scrap)}、销售 BOM 消耗 ${esc(three.totals.bom_consumption)} ${esc(comparison.unit)} · ${esc(evidenceStatus(three.status))}</span>` : ''}</div>${comparisonCards}<h4>缺失或待关联证据</h4>${gaps}<h4>建议动作</h4><div class="mini-actions">${actions || '<span class="good">当前无需新增动作</span>'}</div><details><summary>查看决策轨迹与证据编号</summary><ol class="trace">${trace}</ol></details>`;
  };
  const render = (data) => {
    const { task, documents = [], events = [] } = data;
    const status = task.status === 'pending_hq_review' && task.escalation_level ? { label:'总部处理中', css:'review' } : statusInfo(task.status);
    const material = data.anomaly?.material_name || task.material_names?.[0] || '';
    const businessDate = data.anomaly?.business_date || data.diagnosis_v2?.comparison?.business_date || '';
    const docs = documents.length ? documents.map((item) => { const href = item.document_type === 'purchase_order' ? `/procurement-detail/?type=purchase&id=${encodeURIComponent(item.id)}` : item.document_type === 'receipt_order' ? `/procurement-detail/?type=receipt&id=${encodeURIComponent(item.id)}` : item.document_type === 'transfer_order' ? `/transfers/?source_work_order_id=${encodeURIComponent(task.id)}` : `/documents/?document=${encodeURIComponent(item.id)}`; return `<div class="document"><div><b>${esc(item.original_filename || item.document_no || item.order_no || item.receipt_no || item.id)}</b><small>${esc(item.document_type || '业务凭证')} · ${formatDate(item.received_at || item.created_at)}</small></div><a class="link" href="${href}">查看单据 →</a></div>`; }).join('') : '<div class="empty">暂无关联单据</div>';
    const eventRows = events.length ? `<ul>${events.map((item) => `<li>${esc(item.document_no || item.id)} · ${esc(item.material_name)} ${esc(item.qty)}${esc(item.unit)}</li>`).join('')}</ul>` : '';
    const timeRows = timeline(data).map((item) => `<div class="timeline-item"><h3>${esc(item.title)}</h3>${item.detail ? `<p>${esc(item.detail)}</p>` : ''}<div class="timeline-meta"><span>${formatDate(item.time)}</span><span>操作人：${esc(item.actor || '—')}</span></div></div>`).join('');
    root.innerHTML = `<header class="page-head"><div><div class="eyebrow">跟进工单 · ${esc(task.id)}</div><h1>${esc(task.title)}</h1><p class="subtitle">${esc(task.store_code || '—')} · ${esc(typeText(task.task_type))}</p></div><span class="status ${status.css}">${status.label}</span></header>
      <div class="layout"><div class="stack">
        <section class="panel"><div class="panel-head"><h2>工单信息</h2></div><div class="panel-body"><div class="meta-grid"><div class="meta"><span>工单编号</span>${esc(task.id)}</div><div class="meta"><span>门店 / 主体</span>${esc(task.store_code || '—')}</div><div class="meta"><span>责任角色</span>${esc(task.assigned_to || '—')}</div><div class="meta"><span>当前操作人</span>${esc(task.last_operator || '—')}</div><div class="meta"><span>创建时间</span>${formatDate(task.created_at)}</div><div class="meta"><span>最近更新</span>${formatDate(task.updated_at || task.submitted_at || task.created_at)}</div></div></div></section>
        <section class="panel"><div class="panel-head"><h2>任务详情</h2></div><div class="panel-body"><p class="instruction">${esc(task.instruction)}</p></div></section>
        <section class="panel"><div class="panel-head"><h2>来源与判断记录</h2></div><div class="panel-body"><div class="source">${sourceHtml(data)}</div></div></section>
        <section class="panel"><div class="panel-head split"><h2>规则 V2 研判</h2><button class="btn" id="reassess-task">重新研判并保存快照</button></div><div class="panel-body">${diagnosisHtml(data)}</div></section>
        <section class="panel"><div class="panel-head"><h2>关联单据与业务记录</h2></div><div class="panel-body"><div class="document-list">${docs}</div>${eventRows}</div></section>
        <section class="panel"><div class="panel-head"><h2>处理时间线</h2></div><div class="panel-body"><div class="timeline">${timeRows}</div></div></section>
        ${task.resolution ? `<section class="panel"><div class="panel-head"><h2>${task.status === 'closed' ? '闭环结论' : '最近一次处理结论'}</h2></div><div class="panel-body"><div class="resolution ${task.status === 'closed' ? '' : 'pending'}">${esc(task.resolution)}</div></div></section>` : ''}
      </div><aside class="stack">
        <section class="panel"><div class="panel-head"><h2>新增处理记录</h2></div><div class="panel-body"><form class="note-form" id="note-form"><label class="field"><span>操作人（可不填）</span><input name="operator" maxlength="80" placeholder="例如：总部运营 / 门店店长"></label><label class="field"><span>处理记录</span><textarea name="note" maxlength="500" required placeholder="记录已核对事项、处理结果或下一步"></textarea></label><div class="form-actions"><span class="hint">保存后写入工单时间线</span><button class="btn primary" type="submit">添加记录</button></div><div class="result" id="note-result"></div></form></div></section>
        <section class="panel"><div class="panel-head"><h2>工单操作</h2></div><div class="panel-body"><div class="action-list"><a class="btn" href="${actionUrl('/flows/', task, material, businessDate)}">查看库存流水</a><a class="btn" href="${actionUrl('/transfers/#create', task, material, businessDate)}">核对 / 建立调拨单</a><a class="btn" href="${actionUrl('/count-plans/?source=work_order', task, material, businessDate)}">下发关联盘点</a><a class="btn" href="${actionUrl('/purchase-orders/?urgency=urgent#create', task, material, businessDate)}">建立紧急补货草稿</a><a class="btn" href="${actionUrl('/receipt-orders/#create', task, material, businessDate)}">建立收货草稿</a><a class="btn" href="/#operation-task-panel">返回工单列表</a></div></div></section>
        ${task.status !== 'closed' ? `<section class="panel"><div class="panel-head"><h2>人工闭环确认</h2></div><div class="panel-body"><form class="note-form" id="closure-form"><label class="field"><span>最终结果</span><select name="outcome" required><option value="resolved">已恢复</option><option value="accepted_exception">接受例外</option><option value="false_positive">规则误判</option><option value="master_data_issue">主数据问题（转治理）</option><option value="unresolved">尚未解决</option></select></label><label class="field" id="follow-up-field" hidden><span>尚未解决时的后续流向</span><select name="follow_up_action"><option value="reopen_store">重新交由门店处理</option><option value="escalate_hq">升级至总部运营</option><option value="escalate_governance">升级至主数据治理</option></select></label><label class="field"><span>最终原因</span><textarea name="final_cause" required placeholder="确认后的真实原因"></textarea></label><label class="field"><span>解决方式 / 下一步</span><textarea name="resolution_note" required placeholder="已做什么，或接下来由谁做什么"></textarea></label><label class="field"><span>操作人</span><input name="operator" required placeholder="总部运营 / 门店店长"></label><label class="check"><input type="checkbox" name="store_adopted">门店已采纳处理方案</label><label class="check"><input type="checkbox" name="hq_confirmed" required>总部确认本次结论</label><button class="btn primary" type="submit">重算并提交结论</button><div class="result" id="closure-result"></div></form></div></section>` : ''}
      </aside></div>`;
    bind(data);
  };
  const setLoading = (button, label) => { const original = button.innerHTML; button.disabled = true; button.innerHTML = `<span class="spinner"></span>${label}`; return () => { button.disabled = false; button.innerHTML = original; }; };
  const load = async () => {
    if (!id) throw new Error('缺少工单编号。');
    const data = await api(`/api/operation-tasks/${encodeURIComponent(id)}`);
    render(data);
  };
  const bind = (data) => {
    document.getElementById('note-form')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = event.currentTarget, button = form.querySelector('button'), result = document.getElementById('note-result'), restore = setLoading(button, '正在保存…');
      result.className = 'result';
      try {
        await api(`/api/operation-tasks/${encodeURIComponent(data.task.id)}/notes`, { method:'POST', body:JSON.stringify({ operator:form.operator.value, note:form.note.value }) });
        await load();
      } catch (error) { result.textContent = error.message; result.className = 'result show error'; restore(); }
    });
    const closureForm = document.getElementById('closure-form');
    if (closureForm) {
      const syncFollowUp = () => {
        const needsFollowUp = ['unresolved', 'master_data_issue'].includes(closureForm.outcome.value);
        document.getElementById('follow-up-field').hidden = !needsFollowUp;
        if (closureForm.outcome.value === 'master_data_issue') closureForm.follow_up_action.value = 'escalate_governance';
      };
      closureForm.outcome.addEventListener('change', syncFollowUp); syncFollowUp();
    }
    document.getElementById('closure-form')?.addEventListener('submit', async (event) => {
      event.preventDefault(); const form = event.currentTarget, button = form.querySelector('button[type=submit]'), result = document.getElementById('closure-result'), restore = setLoading(button, '正在重算并校验…');
      try { await api(`/api/operation-tasks/${encodeURIComponent(data.task.id)}/close`, { method:'POST', body:JSON.stringify({ outcome:form.outcome.value, final_cause:form.final_cause.value, resolution_note:form.resolution_note.value, operator:form.operator.value, store_adopted:form.store_adopted.checked, hq_confirmed:form.hq_confirmed.checked, follow_up_action:form.follow_up_action.value }) }); await load(); }
      catch (error) { result.textContent = error.message; result.className = 'result show error'; restore(); }
    });
    document.getElementById('reassess-task')?.addEventListener('click', async (event) => {
      const restore = setLoading(event.currentTarget, '正在重新研判…');
      try { await api(`/api/operation-tasks/${encodeURIComponent(data.task.id)}/reassess`, { method:'POST', body:'{}' }); await load(); }
      catch (error) { alert(error.message); restore(); }
    });
  };
  load().catch((error) => { root.innerHTML = `<div class="fatal"><b>无法打开工单</b><br>${esc(error.message)}<br><br><a class="link" href="/#operation-task-panel">返回工单列表</a></div>`; });
})();
