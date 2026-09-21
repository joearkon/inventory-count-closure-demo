(() => {
  'use strict';
  const root = document.getElementById('work-order-root');
  const search = new URLSearchParams(location.search);
  const id = search.get('id') || '';
  const isHqPortal = search.get('portal') === 'hq';
  let activeTab = 'summary';
  const workOrderHref = (workOrderId) => `/work-order/?${isHqPortal ? 'portal=hq&' : ''}id=${encodeURIComponent(workOrderId)}`;
  const taskListHref = isHqPortal ? '/work-orders/' : '/store/#tasks';
  const esc = (value) => String(value == null ? '' : value).replace(/[&<>'"]/g, (char) => ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;' }[char]));
  const api = async (path, options = {}) => {
    const response = await fetch(path, { headers:{ 'Content-Type':'application/json' }, ...options });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || '服务暂不可用');
    return data;
  };
  const formatDate = (value) => value ? new Intl.DateTimeFormat('zh-CN', { year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', hour12:false }).format(new Date(value)) : '—';
  const qty = (value) => value == null ? '—' : Number(value).toLocaleString('zh-CN', { maximumFractionDigits:3 });
  const statusInfo = (status) => ({
    pending_store_submission:{ label:'门店处理中', css:'' },
    pending_hq_review:{ label:'待总部确认', css:'review' },
    closed:{ label:'已闭环', css:'closed' }
  }[status] || { label:'待处理', css:'' });
  const typeText = (type) => ({ custom:'主动运营任务', diagnosis_negative_inventory:'负库存核查', diagnosis_count_variance:'盘点差异复核', diagnosis_safety_stock:'安全库存跟进', diagnosis_sell_in_ratio:'销入比核查', receipt_evidence:'收货凭证核查', sku_inventory_check:'SKU 库存核查', inventory_receipt_check:'收货与库存核查', qa_regression:'测试工单' }[type] || '跟进工单');
  const ruleText = (code) => ({ NEGATIVE_THEORETICAL:'D2 · 负库存', D2_NEGATIVE_STOCK:'D2 · 负库存', D2_NEGATIVE_THEORETICAL:'D2 · 负库存', COUNT_VARIANCE:'D1 · 理论与实盘差异', D1_COUNT_VARIANCE:'D1 · 理论与实盘差异', D1_STOCK_VARIANCE:'D1 · 理论与实盘差异', BELOW_SAFETY_STOCK:'S1 · 安全库存预警', S1_SAFETY_STOCK:'S1 · 安全库存预警', S1_REPLENISHMENT_RISK:'S1 · 安全库存预警', SELL_IN_IMBALANCE:'T2 · 销入比失衡', T2_SELL_IN_IMBALANCE:'T2 · 销入比失衡', T2_SUPPLY_CONSUMPTION_IMBALANCE:'T2 · 销入比失衡' }[code] || code || '未标注规则');
  const auditDetail = (item, task) => {
    if (item.action !== 'V2 重新研判') return item.detail;
    const parts = String(item.detail || '').split(' · ');
    const code = parts[1] && parts[1] !== 'undefined' ? parts[1] : task.source_rule_code;
    const state = parts[2] || '';
    const location = parts[3] && parts[3] !== '待判断' ? parts[3] : (state === 'not_triggered' ? '原异常不再触发' : '等待更多证据');
    return `${ruleText(code)} · ${evidenceStatus(state)} · ${location}`;
  };
  const timeline = ({ task, audits }) => {
    const rows = [{ title:'工单已创建', detail:task.instruction, actor:'—', time:task.created_at }];
    (audits || []).slice().reverse().forEach((item) => rows.push({ title:item.action, detail:auditDetail(item, task), actor:item.actor_role || '—', time:item.created_at }));
    if (task.submitted_at && !rows.some((item) => item.time === task.submitted_at)) rows.push({ title:'门店已提交处理凭证', detail:task.proof_filename || '凭证已归档', actor:'—', time:task.submitted_at });
    if (task.closed_at && !rows.some((item) => item.time === task.closed_at)) rows.push({ title:'工单已闭环', detail:task.resolution || '处理完成', actor:'—', time:task.closed_at });
    return rows.sort((a, b) => new Date(a.time || 0) - new Date(b.time || 0));
  };
  const sourceHtml = (data) => {
    const { task, anomaly } = data;
    if (!anomaly) return '<strong>当前判断来源：人工创建</strong>暂未关联库存研判；后续自动建议应作为新的处理记录追加，不覆盖原始记录。';
    const code = task.source_rule_code || anomaly.rule_code || '未标注规则';
    const location = anomaly.primary_location?.title || anomaly.primary_attribution || '待验证位置';
    return `<strong>当前判断来源：规则引擎 · ${esc(ruleText(code))}</strong>${esc(anomaly.material_name || '')}${anomaly.unit ? `（${esc(anomaly.unit)}）` : ''} · ${esc(location)}<br>关联研判：${esc(anomaly.judgment_task_no || anomaly.id)}`;
  };
  const evidenceStatus = (value) => ({ confirmed:'已确认', suspect:'疑似', insufficient:'证据不足', pending_count:'待盘点', unknown:'未知', partial:'部分数据', unlinked:'未关联', triggered:'仍触发', not_triggered:'已恢复' }[value] || value || '未知');
  const triggerText = (value) => ({ work_order_created:'建立工单', manual_reassess:'人工重算', closure_verification:'闭环校验', receipt_confirmed:'收货确认', transfer_received:'调拨签收', count_completed:'盘点完成' }[value] || String(value || '系统重算').replace(/_confirmed$/, '确认后重算'));
  const runRow = (run, sequence, total) => {
    const theoretical = run.theoretical_closing?.value;
    const physical = run.physical_count?.value;
    const unit = run.source_signal?.unit || '';
    const gaps = run.evidence_gaps || [];
    const refs = run.evidence_refs || [];
    const trace = run.decision_trace || [];
    const labels = [sequence === 1 ? '首次' : '', sequence === total ? '最新' : ''].filter(Boolean);
    return `<details class="run-row" data-run-index="${total - sequence}"><summary><div class="run-sequence"><b>第 ${sequence} 次</b>${labels.map((label) => `<em>${label}</em>`).join('')}</div><time>${formatDate(run.created_at)}</time><span>${esc(triggerText(run.trigger))}</span><span class="run-status ${run.anomaly_status === 'not_triggered' ? 'recovered' : ''}">${esc(evidenceStatus(run.anomaly_status))}</span><strong>${esc(run.primary_location || '待判断')}</strong><small>查看详情</small></summary><div class="run-detail"><div class="run-hypothesis"><span>本次判断</span><b>${esc(run.primary_location || '待判断')}</b><p>${esc(run.primary_hypothesis || '—')}</p></div><dl><div><dt>规则版本</dt><dd>${esc(run.rule_version || '—')}</dd></div><div><dt>触发方式</dt><dd>${esc(triggerText(run.trigger))}</dd></div><div><dt>理论库存</dt><dd>${theoretical == null ? '—' : `${esc(theoretical)} ${esc(unit)}`}</dd></div><div><dt>实盘库存</dt><dd>${physical == null ? '未取得' : `${esc(physical)} ${esc(unit)}`}</dd></div><div><dt>证据引用</dt><dd>${refs.length} 项</dd></div><div><dt>缺失证据</dt><dd>${gaps.length} 项</dd></div></dl>${run.calculation?.formula ? `<div class="run-formula"><span>库存重建</span><code>${esc(run.calculation.formula)}</code></div>` : ''}${gaps.length ? `<div class="run-section"><h5>缺失证据</h5><ul>${gaps.map((item) => `<li><b>${esc(item.label || item.code || '待补证据')}</b>${item.explanation ? `：${esc(item.explanation)}` : ''}</li>`).join('')}</ul></div>` : '<div class="run-complete">本次没有待补充的关键证据</div>'}${trace.length ? `<div class="run-section"><h5>决策轨迹</h5><ol>${trace.map((item) => `<li><b>${esc(item.node_id || '')}</b> ${esc(item.message || '')}</li>`).join('')}</ol></div>` : ''}${refs.length ? `<div class="run-refs"><span>证据编号</span>${refs.map((ref) => `<code>${esc(ref)}</code>`).join('')}</div>` : ''}</div></details>`;
  };
  const runHistoryHtml = (runs) => {
    if (!runs.length) return '<div class="run-history-empty"><b>当前为动态预览</b><span>点击重新研判后保存第一份工单快照。</span></div>';
    const first = runs[0], latest = runs.at(-1), firstValue = first.theoretical_closing?.value, latestValue = latest.theoretical_closing?.value;
    const change = firstValue != null && latestValue != null ? Number(latestValue) - Number(firstValue) : null;
    const summary = first.id === latest.id
      ? '当前仅有首次快照；完成业务动作或手动重算后，将在列表中追加记录。'
      : `异常状态：${evidenceStatus(first.anomaly_status)} → ${evidenceStatus(latest.anomaly_status)}；首要位置：${first.primary_location || '待判断'} → ${latest.primary_location || '待判断'}${change == null ? '' : `；理论库存变化 ${change > 0 ? '+' : ''}${change} ${latest.source_signal?.unit || ''}`}。`;
    const rows = runs.map((run, index) => ({ run, sequence:index + 1 })).reverse();
    const pages = Math.ceil(rows.length / 10);
    return `<div class="run-history-head"><div><h4>V2 重算记录</h4><p>${esc(summary)}</p></div><span>共 ${runs.length} 次</span></div><div class="run-list">${rows.map(({ run, sequence }, index) => runRow(run, sequence, runs.length).replace('data-run-index="', `${index >= 10 ? 'hidden ' : ''}data-run-index="`)).join('')}</div>${pages > 1 ? `<nav class="run-pager" aria-label="V2 重算记录分页"><span>每页 10 条</span><div>${Array.from({ length:pages }, (_, index) => `<button type="button" class="run-page ${index === 0 ? 'active' : ''}" data-run-page="${index}">${index + 1}</button>`).join('')}</div></nav>` : ''}`;
  };
  const actionUrl = (route, task, material, date) => {
    if (!route) return '';
    const url = new URL(route, location.origin);
    url.searchParams.set('source_work_order_id', task.id); url.searchParams.set('store', task.store_code || '');
    if (material) url.searchParams.set('material', material); if (date) url.searchParams.set('date', date);
    return `${url.pathname}${url.search}${url.hash}`;
  };
  const currentDiagnosis = (data) => data.diagnosis_v2?.comparison || null;
  const taskBriefHtml = (data) => {
    const comparison = currentDiagnosis(data), result = comparison?.v2, packet = comparison?.fact_packet;
    if (!comparison || !result || !packet) return `<div class="work-order-brief"><article><span>工单原因</span><h3>${esc(data.task.title)}</h3><p>${esc(data.task.instruction)}</p></article><article class="goal"><span>执行目标</span><h3>完成任务要求并提交可核验的处理结果</h3><p>处理记录、相关凭证和最终结论都保留在同一张工单中。</p></article></div>`;
    const code = result.rule_code || data.task.source_rule_code || '';
    const material = `${comparison.material_name}（${comparison.unit}）`;
    const accepted = data.action_plan || [];
    const actionTitles = accepted.map((item) => item.title || item.label || item.action_id).filter(Boolean);
    const goal = actionTitles.length
      ? `完成“${actionTitles.join('、')}”，确认异常的真实原因并留下处理结果。`
      : (data.task.instruction || `核实${material}异常原因并形成处理结论。`);
    const theoretical = packet.quantities?.theoretical_closing?.value;
    const physical = packet.physical_count?.value;
    const gaps = result.evidence_gaps || [];
    const formula = packet.calculation?.formula || packet.quantities?.formula || '';
    return `<div class="work-order-brief"><article><span>工单原因</span><h3>${esc(material)}在营业日 ${esc(comparison.business_date)} 触发${esc(ruleText(code))}</h3><p>${esc(result.primary_hypothesis || data.task.instruction)}</p><div class="brief-facts"><em>理论库存：${theoretical == null ? '未取得' : `${esc(theoretical)} ${esc(comparison.unit)}`}</em><em>实盘库存：${physical == null ? '未取得' : `${esc(physical)} ${esc(comparison.unit)}`}</em><em>证据缺口：${gaps.length} 项</em></div></article><article class="goal"><span>执行目标</span><h3>${esc(goal)}</h3><p>所选动作完成后重新运行 V2；由处理人填写最终原因和解决方式，再进入闭环确认。</p></article></div><details class="diagnosis-attachment"><summary><div><b>关联研判附件</b><span>${esc(ruleText(code))} · ${esc(result.primary_location || '待判断')} · ${esc(result.rule_version || '当前版本')}</span></div><small>查看证据与计算依据</small></summary><div class="attachment-body"><p><b>研判结论：</b>${esc(result.primary_hypothesis || '—')}</p>${formula ? `<p><b>计算依据：</b><code>${esc(formula)}</code></p>` : ''}<div><b>尚需补充：</b>${gaps.length ? `<ul>${gaps.map((item) => `<li>${esc(item.label || item.explanation || item.code || '待补证据')}</li>`).join('')}</ul>` : '<span class="complete-evidence">当前无关键证据缺口</span>'}</div></div></details>`;
  };
  const actionPlanHtml = (data) => {
    const comparison = currentDiagnosis(data), accepted = data.action_plan || [];
    const actions = accepted.length ? accepted : comparison?.v2?.actions || [];
    if (!comparison) return '<div class="empty">人工工单暂时没有规则建议，请在处理记录中填写下一步。</div>';
    const documents = data.documents || [], events = data.events || [];
    const has = (types) => documents.some((item) => types.includes(item.document_type)) || events.some((item) => types.includes(item.type));
    const meta = {
      VIEW_TRANSFER:{ reason:'最大负向贡献来自调拨，先核对数量、单位、重复出库和目标门店。', owner:'门店店长', done:has(['transfer_order','transfer_in']) },
      VERIFY_DESTINATION_ACCEPTANCE:{ reason:'系统未关联目标门店签收结果，需要人工确认是否真实到货。', owner:'目标门店', done:has(['transfer_in']) },
      CREATE_SPOT_COUNT:{ reason:'当单据无法解释账面库存时，用现场实盘确认真实库存。', owner:'门店店长', done:has(['inventory_count']) },
      VIEW_FLOWS:{ reason:'查看收货、调拨、报损和销售扣减的完整时间顺序。', owner:'总部 / 门店', ready:true },
      VIEW_RECEIPTS:{ reason:'确认是否存在到货但未入库、数量错误或重复收货。', owner:'门店店长', done:has(['receipt_order','receipt']) },
      CREATE_RECEIPT_DRAFT:{ reason:'仅在确认货物已经到店但系统未入库时补录，仍需人工确认。', owner:'门店店长', done:has(['receipt_order','receipt']) },
      VIEW_PURCHASE:{ reason:'核对订货、预计到货和在途状态，避免重复补货。', owner:'门店店长', done:has(['purchase_order']) },
      CREATE_RESTOCK_DRAFT:{ reason:'确认真实缺货并可能影响营业后，再建立紧急补货草稿。', owner:'门店店长', done:has(['purchase_order']) }
    };
    return actions.length ? `<div class="action-plan">${actions.map((item, index) => { const info = meta[item.action_id] || { reason:item.reason || '按研判结果补充证据并记录处理结果。', owner:item.owner || data.task.assigned_to || '待分配' }; const state = info.done ? '已完成' : info.ready ? '可查看' : '待处理'; const title = item.title || item.label || item.action_id; const href = item.execution_url || (item.route ? actionUrl(item.route, data.task, comparison.material_name, comparison.business_date) : '#note-form'); const manual = item.mode === 'manual'; return `<article class="action-card ${info.done ? 'done' : ''}"><div class="action-rank">${info.done ? '✓' : index + 1}</div><div class="action-content"><div class="action-title"><div><span>${accepted.length ? '已采纳执行项' : '规则建议'} ${index + 1}</span><h3>${esc(title)}</h3></div><em class="action-state">${state}</em></div><p>${esc(item.reason || info.reason)}</p><div class="action-meta"><span>责任角色：${esc(item.owner || info.owner)}</span><span>${item.source === 'ai' ? '来自 AI 研判' : '来自规则研判'}</span></div><a class="btn ${index === 0 && !info.done ? 'primary' : ''}" href="${esc(href)}">${manual ? '记录核查结果' : esc(title)}</a></div></article>`; }).join('')}</div>` : '<div class="good">当前工单没有执行项，请在处理记录中补充下一步。</div>';
  };
  const quantityFrom = (run, key) => Number(run?.calculation?.quantities?.[key]?.value || 0);
  const documentHref = (item, task) => item.document_type === 'purchase_order'
    ? `/procurement-detail/?type=purchase&id=${encodeURIComponent(item.id)}`
    : item.document_type === 'receipt_order'
      ? `/procurement-detail/?type=receipt&id=${encodeURIComponent(item.id)}`
      : item.document_type === 'transfer_order'
        ? `/transfers/?source_work_order_id=${encodeURIComponent(task.id)}`
        : `/documents/?document=${encodeURIComponent(item.id)}`;
  const correctionSummaryHtml = (data) => {
    const runs = data.diagnosis_runs || [];
    if (!runs.length) return '<div class="empty">完成收货、调拨签收或盘点后，系统将在这里展示库存修正前后变化。</div>';
    const first = runs[0], latest = runs.at(-1), unit = latest.source_signal?.unit || first.source_signal?.unit || '';
    const before = Number(first.theoretical_closing?.value ?? 0), after = Number(latest.theoretical_closing?.value ?? before), delta = after - before;
    const receiptsBefore = quantityFrom(first, 'receipt'), receiptsAfter = quantityFrom(latest, 'receipt');
    const changed = first.id !== latest.id && (delta !== 0 || first.anomaly_status !== latest.anomaly_status);
    const docs = (data.documents || []).filter((item) => ['purchase_order','receipt_order','transfer_order'].includes(item.document_type));
    const events = data.events || [];
    const businessSteps = [
      ...docs.map((item) => ({ title:item.document_type === 'purchase_order' ? '建立订货单' : item.document_type === 'receipt_order' ? '确认收货单' : '处理调拨单', ref:item.document_no || item.order_no || item.receipt_no || item.id, href:documentHref(item, data.task) })),
      ...events.map((item) => ({ title:item.type === 'receipt' ? '生成收货入库流水' : '生成库存流水', ref:`${item.document_no || item.id} · ${item.qty}${item.unit || ''}`, href:actionUrl('/flows/', data.task, item.material_name, item.business_date) }))
    ];
    const checks = [
      { label:'业务单据已关联', ok:docs.length > 0 },
      { label:'库存流水已生成', ok:events.length > 0 },
      { label:'处理后 V2 已重算', ok:runs.length > 1 },
      { label:'原异常已不再触发', ok:latest.anomaly_status === 'not_triggered' },
      { label:'人工结论已确认', ok:data.task.status === 'closed' }
    ];
    const followUps = data.follow_up_anomalies || [];
    const followUpHtml = followUps.length ? `<div class="follow-up-alert"><div><span>修正后发现新的问题</span><h4>${followUps.map((item) => esc(ruleText(item.rule_code))).join('、')}</h4><p>${followUps.map((item) => esc(item.evidence || '需要进一步核查。')).join('<br>')}</p></div><div class="follow-up-actions"><a class="btn" href="/diagnosis-v3/">查看研判证据</a>${followUps.map((item) => `<button class="btn primary" type="button" data-followup-work-order="${esc(item.id)}">建立后续工单</button>`).join('')}</div></div>` : (latest.anomaly_status === 'not_triggered' ? '<div class="correction-clear">✓ 原异常恢复，当前没有发现同物料的后续异常。</div>' : '');
    return `<div class="correction-summary"><div class="correction-formulas"><article><span>处理前</span><b>${esc(ruleText(first.rule_code || first.source_signal?.v1_rule_code))} · ${esc(evidenceStatus(first.anomaly_status))}</b><code>${esc(first.calculation?.formula || `${before} ${unit}`)}</code></article><i>→</i><article class="after"><span>处理后</span><b>${esc(ruleText(latest.rule_code || latest.source_signal?.v1_rule_code))} · ${esc(evidenceStatus(latest.anomaly_status))}</b><code>${esc(latest.calculation?.formula || `${after} ${unit}`)}</code></article></div><div class="correction-delta"><div><span>收货入库</span><b>${receiptsBefore} → ${receiptsAfter} ${esc(unit)}</b></div><div><span>理论库存</span><b>${before} → ${after} ${esc(unit)}</b></div><div><span>库存变化</span><b class="${delta >= 0 ? 'positive' : ''}">${delta > 0 ? '+' : ''}${delta} ${esc(unit)}</b></div><div><span>验证结论</span><b>${changed ? `${evidenceStatus(first.anomaly_status)} → ${evidenceStatus(latest.anomaly_status)}` : '等待有效修正'}</b></div></div><div class="correction-columns"><div><h4>实际处理动作</h4>${businessSteps.length ? `<ol class="business-steps">${businessSteps.map((item) => `<li><span>${esc(item.title)}</span><a href="${esc(item.href)}">${esc(item.ref)} →</a></li>`).join('')}</ol>` : '<div class="empty">尚未关联会改变库存的业务动作。</div>'}</div><div><h4>系统验证</h4><ul class="verification-list">${checks.map((item) => `<li class="${item.ok ? 'ok' : ''}"><i>${item.ok ? '✓' : '○'}</i>${item.label}</li>`).join('')}</ul></div></div>${followUpHtml}</div>`;
  };
  const diagnosisHtml = (data) => {
    const current = data.diagnosis_v2;
    if (!current?.comparison) return '<div class="empty">该工单未关联可运行的 V2 研判。</div>';
    const { comparison } = current, result = comparison.v2, packet = comparison.fact_packet, runs = data.diagnosis_runs || [];
    const gaps = (result.evidence_gaps || []).length ? `<ul class="evidence-list">${result.evidence_gaps.map((item) => `<li><b>${esc(item.label)}</b> · ${esc(evidenceStatus(item.state))}<br><span>${esc(item.explanation || '')}</span></li>`).join('')}</ul>` : '<div class="good">当前没有待补充的关键证据。</div>';
    const trace = (result.decision_trace || []).map((item) => `<li><b>${esc(item.node_id)}</b> ${esc(item.message)}</li>`).join('');
    const latestSavedRun = runs.at(-1), q = packet.quantities, three = packet.windows?.three_days;
    const formula = latestSavedRun?.calculation?.formula || `${q.opening.value} + ${q.receipt.value} + ${q.transfer_in.value} - ${q.transfer_out.value} - ${q.scrap.value} - ${q.bom_consumption.value} = ${q.theoretical_closing.value} ${comparison.unit}`;
    const recentEvidence = three ? `近 3 日：收货 ${three.totals.receipt}、调拨入 ${three.totals.transfer_in}、调拨出 ${three.totals.transfer_out}、报损 ${three.totals.scrap}、销售 BOM 消耗 ${three.totals.bom_consumption} ${comparison.unit}。` : '近 3 日数据尚未形成完整窗口。';
    return `<div class="diagnosis-flow"><article><i>1</i><div><span>异常触发</span><h3>${esc(ruleText(result.rule_code))} · ${esc(evidenceStatus(result.anomaly_status))}</h3><p>理论期末 ${esc(packet.quantities.theoretical_closing.value)} ${esc(comparison.unit)}，系统进入库存异常核查。</p></div></article><article><i>2</i><div><span>库存重建</span><h3>${esc(formula)}</h3><p>实盘 ${packet.physical_count.value == null ? '未取得' : `${esc(packet.physical_count.value)} ${esc(comparison.unit)}`}，实盘状态为“${esc(evidenceStatus(result.physical_status))}”。</p></div></article><article><i>3</i><div><span>数据回溯</span><h3>检查今日与近 3 日业务流水</h3><p>${esc(recentEvidence)}数据完整度：${esc(evidenceStatus(three?.status))}。</p></div></article><article class="primary"><i>4</i><div><span>首要判断</span><h3>${esc(result.primary_location)}</h3><p>${esc(result.primary_hypothesis)}</p></div></article><article><i>5</i><div><span>证据缺口</span><h3>${(result.evidence_gaps || []).length ? `仍有 ${(result.evidence_gaps || []).length} 项需要补充` : '关键证据已齐备'}</h3>${gaps}</div></article></div>${runHistoryHtml(runs)}<details class="technical-detail"><summary>查看当前规则版本、证据状态和决策轨迹</summary><div class="v2-head"><div><span class="v2-label">${esc(ruleText(result.rule_code))} · 版本 ${esc(result.rule_version)}</span><h3>${esc(result.primary_location)}</h3></div><div class="v2-states"><span>${esc(evidenceStatus(result.anomaly_status))}</span><span>${esc(evidenceStatus(result.cause_evidence_status))}</span><span>${esc(evidenceStatus(result.physical_status))}</span></div></div><ol class="trace">${trace}</ol></details>`;
  };
  const render = (data) => {
    const { task, documents = [], events = [] } = data;
    const status = task.status === 'pending_hq_review' && task.escalation_level === 'escalate_supervisor' ? { label:'督导处理中', css:'review' } : task.status === 'pending_hq_review' && task.escalation_level ? { label:'总部处理中', css:'review' } : statusInfo(task.status);
    const comparison = currentDiagnosis(data), result = comparison?.v2, packet = comparison?.fact_packet;
    const runs = data.diagnosis_runs || [], latestRun = runs.at(-1), accepted = data.action_plan || [];
    const material = data.anomaly?.material_name || task.material_names?.[0] || '';
    const businessDate = data.anomaly?.business_date || data.diagnosis_v2?.comparison?.business_date || '';
    const code = result?.rule_code || task.source_rule_code || '';
    const shortRule = code.includes('D2') || code.includes('NEGATIVE') ? 'D2' : code.includes('D1') || code.includes('COUNT') ? 'D1' : code.includes('S1') || code.includes('SAFETY') ? 'S1' : code.includes('T2') || code.includes('SELL') ? 'T2' : '规则';
    const ruleClass = `rule-${shortRule.toLowerCase()}`;
    const theoretical = packet?.quantities?.theoretical_closing?.value;
    const physical = packet?.physical_count?.value;
    const unit = comparison?.unit || data.anomaly?.unit || '';
    const evidenceGaps = result?.evidence_gaps || [];
    const docs = documents.length ? documents.map((item) => `<div class="document"><div><b>${esc(item.original_filename || item.document_no || item.order_no || item.receipt_no || item.id)}</b><small>${esc(item.document_type || '业务凭证')} · ${formatDate(item.received_at || item.created_at)}</small></div><a class="link" href="${documentHref(item, task)}">查看单据 →</a></div>`).join('') : '<div class="empty">暂无关联单据</div>';
    const eventRows = events.length ? `<ul>${events.map((item) => `<li>${esc(item.document_no || item.id)} · ${esc(item.material_name)} ${esc(item.qty)}${esc(item.unit)}</li>`).join('')}</ul>` : '';
    const timeRows = timeline(data).map((item) => `<div class="timeline-item"><h3>${esc(item.title)}</h3>${item.detail ? `<p>${esc(item.detail)}</p>` : ''}<div class="timeline-meta"><span>${formatDate(item.time)}</span><span>操作人：${esc(item.actor || '—')}</span></div></div>`).join('');
    const progress = `<div class="loop-timeline"><article class="done"><i></i><b>异常发现 · V2 首次研判</b><span>${formatDate(runs[0]?.created_at || task.created_at)} · ${esc(result?.rule_version || '规则版本待记录')}</span><small>冻结事实包并生成持续问题</small></article><article class="done"><i></i><b>建立跟进工单</b><span>${formatDate(task.created_at)} · 指派 ${esc(task.assigned_to || '待分配')}</span><small>纳入 ${accepted.length} 项执行动作</small></article><article class="${events.length || documents.length ? 'active' : ''}"><i></i><b>动作执行中</b><span>${events.length + documents.length} 条业务记录</span><small>${events.length || documents.length ? '处理事实已回到工单' : '等待执行已采纳动作'}</small></article><article class="${latestRun ? 'done' : ''}"><i></i><b>V2 重算验证</b><span>${latestRun ? `${formatDate(latestRun.created_at)} · ${esc(triggerText(latestRun.trigger))}` : '等待关键动作完成'}</span><small>${latestRun ? evidenceStatus(latestRun.anomaly_status) : '尚无处理后快照'}</small></article><article class="${task.status === 'closed' ? 'done' : ''}"><i></i><b>人工闭环</b><span>${task.status === 'closed' ? formatDate(task.closed_at) : '待填写最终原因与解决方式'}</span><small>门店采纳与总部确认后完成</small></article></div>`;
    const summaryTab = `<div class="tab-section"><h3 class="section-title">闭环进度</h3>${progress}</div><div class="tab-section"><h3 class="section-title">工单内容</h3>${taskBriefHtml(data)}</div>`;
    const recordsTab = `<div class="tab-section"><h3 class="section-title">关联单据与业务记录</h3><div class="document-list">${docs}</div>${eventRows}</div><div class="tab-section"><h3 class="section-title">操作日志</h3><div class="timeline">${timeRows}</div></div>${task.resolution ? `<div class="resolution ${task.status === 'closed' ? '' : 'pending'}">${esc(task.resolution)}</div>` : ''}`;
    const tabContent = activeTab === 'actions' ? actionPlanHtml(data) : activeTab === 'verification' ? correctionSummaryHtml(data) : activeTab === 'process' ? diagnosisHtml(data) : activeTab === 'records' ? recordsTab : summaryTab;
    const gateItems = [{ ok:timeline(data).length > 1, label:'有处理记录', desc:`${Math.max(0, timeline(data).length - 1)} 条操作记录` },{ ok:documents.length + events.length > 0, label:'有关联业务单据', desc:'收货、调拨、盘点或人工核查说明' },{ ok:runs.length > 1, label:'最新 V2 晚于关键动作', desc:latestRun ? formatDate(latestRun.created_at) : '暂无处理后重算' },{ ok:task.status === 'closed', label:'最终原因与解决方式', desc:'含操作人、门店采纳、总部确认' }];
    const canClose = latestRun && latestRun.anomaly_status === 'not_triggered';
    root.innerHTML = `<div class="breadcrumb"><a href="${taskListHref}">跟进工单</a><span>/</span><b>${esc(task.id)}</b></div><section class="wo-hero panel"><div class="wo-hero-main"><div class="wo-tags"><span class="rule-tag ${ruleClass}">${esc(shortRule)} · ${esc(ruleText(code).replace(/^D\d · /,''))}</span><span class="status ${status.css}">${status.label}</span><span class="chip">SLA：${esc(task.sla || '24 小时')}</span><span class="chip">负责人：${esc(task.assigned_to || '待分配')}</span></div><h1>${esc(material || task.title)} · ${esc(typeText(task.task_type))}</h1><p>${esc(task.store_code || '—')} · ${esc(result?.primary_hypothesis || task.instruction || '')}</p></div><div class="wo-hero-actions"><small>工单号 <code>${esc(task.id)}</code></small><div><button class="btn" id="reassess-task">手动重算</button>${task.status !== 'closed' ? `<button class="btn accent" type="button" data-open-closure>人工闭环</button>` : ''}</div>${!canClose && task.status !== 'closed' ? '<em>最新 V2 仍触发，不能选择“已恢复”</em>' : ''}</div><div class="wo-kpis"><div><span>理论库存</span><b class="${Number(theoretical) < 0 ? 'danger' : ''}">${theoretical == null ? '—' : `${qty(theoretical)} ${esc(unit)}`}</b></div><div><span>实物库存</span><b>${physical == null ? '待盘点' : `${qty(physical)} ${esc(unit)}`}</b></div><div><span>原因证据状态</span><b>${esc(evidenceStatus(result?.cause_evidence_status))}</b></div><div><span>规则版本</span><b><code>${esc(result?.rule_version || '—')}</code></b></div></div></section><div class="prototype-detail-layout"><main class="prototype-main panel"><nav class="prototype-tabs">${[['summary','问题摘要'],['actions','建议动作与执行'],['verification','库存修正与验证'],['process','系统研判过程'],['records','业务记录']].map(([key,label]) => `<button class="${activeTab === key ? 'active' : ''}" data-work-tab="${key}">${label}</button>`).join('')}</nav><div class="prototype-tab-content">${tabContent}</div></main><aside class="prototype-side"><section class="panel"><div class="panel-head"><h2>基础信息</h2></div><div class="panel-body"><dl class="side-info"><div><dt>门店</dt><dd>${esc(task.store_code || '—')}</dd></div><div><dt>物料</dt><dd>${esc(material || '—')}</dd></div><div><dt>单位</dt><dd>${esc(unit || '—')}</dd></div><div><dt>营业日</dt><dd>${esc(businessDate || '—')}</dd></div><div><dt>规则集</dt><dd><code>${esc(result?.ruleset_id || 'inventory-v2')}</code></dd></div><div><dt>负责人</dt><dd>${esc(task.assigned_to || '—')}</dd></div></dl></div></section><section class="panel"><div class="panel-head gate-head"><h2>关闭门禁</h2><span class="${canClose ? 'pass' : 'fail'}">${canClose ? '可正常关闭' : '条件不满足'}</span></div><div class="panel-body gate-list">${gateItems.map((item) => `<div><i class="${item.ok ? 'pass' : 'fail'}">${item.ok ? '✓' : '×'}</i><span><b>${item.label}</b><small>${item.desc}</small></span></div>`).join('')}${latestRun?.anomaly_status === 'triggered' ? '<div><i class="fail">!</i><span><b class="danger">最新 V2 仍触发</b><small>不能选择“已恢复”</small></span></div>' : ''}</div></section><section class="panel"><div class="panel-head"><h2>缺失证据</h2><span class="chip">${evidenceGaps.length} 项</span></div><div class="panel-body missing-list">${evidenceGaps.length ? evidenceGaps.map((gap) => `<div><i>●</i><span>${esc(gap.label || gap.explanation || gap.code || '待补证据')}</span></div>`).join('') : '<div class="empty compact">无缺失证据</div>'}</div></section><section class="panel"><div class="panel-head"><h2>新增处理记录</h2></div><div class="panel-body"><form class="note-form" id="note-form"><label class="field"><span>操作人（可不填）</span><input name="operator" maxlength="80" placeholder="总部运营 / 门店店长"></label><label class="field"><span>处理记录</span><textarea name="note" maxlength="500" required placeholder="填写核查事实与下一步"></textarea></label><button class="btn primary" type="submit">添加记录</button><div class="result" id="note-result"></div></form></div></section></aside></div>${task.status !== 'closed' ? `<div class="closure-modal" data-closure-modal hidden><div class="closure-dialog panel"><div class="panel-head modal-head"><h2>人工闭环确认</h2><button type="button" data-close-closure>×</button></div><div class="panel-body"><form class="note-form" id="closure-form"><label class="field"><span>最终结果</span><select name="outcome" required><option value="resolved">已恢复</option><option value="accepted_exception">接受例外</option><option value="false_positive">规则误判</option><option value="master_data_issue">主数据问题（转治理）</option><option value="unresolved">尚未解决</option></select></label><label class="field" id="follow-up-field" hidden><span>后续流向</span><select name="follow_up_action"><option value="reopen_store">重新交由门店处理</option><option value="escalate_supervisor">升级至区域督导</option><option value="escalate_hq">升级至总部运营</option><option value="escalate_governance">升级至主数据治理</option></select></label><label class="field"><span>最终原因</span><textarea name="final_cause" required></textarea></label><label class="field"><span>解决方式</span><textarea name="resolution_note" required></textarea></label><label class="field"><span>操作人</span><input name="operator" required></label><label class="check"><input type="checkbox" name="store_adopted">门店已采纳处理方案</label><label class="check"><input type="checkbox" name="hq_confirmed" required>总部确认本次结论</label><div class="modal-actions"><button class="btn" type="button" data-close-closure>取消</button><button class="btn accent" type="submit">重算并提交结论</button></div><div class="result" id="closure-result"></div></form></div></div></div>` : ''}`;
    const closureBody = root.querySelector('.closure-dialog > .panel-body');
    const closureForm = root.querySelector('#closure-form');
    if (closureBody && closureForm) {
      closureBody.classList.add('closure-modal-body');
      const left = document.createElement('div'); left.className = 'closure-left';
      left.innerHTML = `<div class="closure-context"><div><span class="rule-tag ${ruleClass}">${esc(shortRule)}</span><b>${esc(material || task.title)} · ${esc(task.store_code || '—')}</b></div><small>工单号 ${esc(task.id)} · ${timeline(data).length - 1} 条处理记录</small><p>处理前理论库存：<strong class="danger">${theoretical == null ? '—' : `${qty(theoretical)} ${esc(unit)}`}</strong>　最新理论库存：<strong>${latestRun?.theoretical_closing?.value == null ? '—' : `${qty(latestRun.theoretical_closing.value)} ${esc(unit)}`}</strong></p></div>`;
      closureForm.parentNode.insertBefore(left, closureForm); left.appendChild(closureForm);
      const gate = document.createElement('aside'); gate.className = 'closure-gate-panel';
      gate.innerHTML = `<h3>关闭门禁</h3><div class="gate-list">${gateItems.map((item) => `<div><i class="${item.ok ? 'pass' : 'fail'}">${item.ok ? '✓' : '−'}</i><span><b>${item.label}</b><small>${esc(item.desc)}</small></span></div>`).join('')}</div><div class="closure-ai-note"><b>AI 辅助提示</b><p>系统不得自动关闭工单。AI 仅辅助核对关闭门禁条件，最终闭环必须由人工确认。</p></div>`;
      closureBody.appendChild(gate);
    }
    bind(data);
  };
  const setLoading = (button, label) => { const original = button.innerHTML; button.disabled = true; button.innerHTML = `<span class="spinner"></span>${label}`; return () => { button.disabled = false; button.innerHTML = original; }; };
  const load = async () => {
    if (!id) throw new Error('缺少工单编号。');
    const data = await api(`/api/operation-tasks/${encodeURIComponent(id)}`);
    render(data);
  };
  const bind = (data) => {
    document.querySelectorAll('[data-work-tab]').forEach((button) => button.addEventListener('click', () => { activeTab = button.dataset.workTab; render(data); }));
    const closureModal = document.querySelector('[data-closure-modal]');
    document.querySelector('[data-open-closure]')?.addEventListener('click', () => { if (closureModal) closureModal.hidden = false; });
    document.querySelectorAll('[data-close-closure]').forEach((button) => button.addEventListener('click', () => { if (closureModal) closureModal.hidden = true; }));
    closureModal?.addEventListener('click', (event) => { if (event.target === closureModal) closureModal.hidden = true; });
    document.querySelectorAll('[data-followup-work-order]').forEach((button) => button.addEventListener('click', async () => {
      const restore = setLoading(button, '正在建立…');
      try {
        const result = await api(`/api/anomalies/${encodeURIComponent(button.dataset.followupWorkOrder)}/work-order`, { method:'POST' });
        const next = result.operationTask;
        if (!next?.id) throw new Error('后续工单已建立，但未返回工单编号。');
        location.href = workOrderHref(next.id);
      } catch (error) { alert(error.message); restore(); }
    }));
    document.querySelectorAll('[data-run-page]').forEach((button) => button.addEventListener('click', () => {
      const page = Number(button.dataset.runPage || 0);
      document.querySelectorAll('.run-row').forEach((row) => { row.hidden = Math.floor(Number(row.dataset.runIndex || 0) / 10) !== page; });
      document.querySelectorAll('[data-run-page]').forEach((item) => item.classList.toggle('active', item === button));
    }));
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
  load().catch((error) => { root.innerHTML = `<div class="fatal"><b>无法打开工单</b><br>${esc(error.message)}<br><br><a class="link" href="${taskListHref}">${isHqPortal ? '返回库存研判' : '返回我的任务'}</a></div>`; });
})();
