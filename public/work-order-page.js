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
  const problemHeroHtml = (data) => {
    const comparison = currentDiagnosis(data), result = comparison?.v2, packet = comparison?.fact_packet;
    if (!comparison || !result || !packet) return `<section class="problem-hero neutral"><div><span class="hero-kicker">人工工单</span><h2>${esc(data.task.title)}</h2><p>${esc(data.task.instruction)}</p></div></section>`;
    const theoretical = packet.quantities?.theoretical_closing?.value;
    const unit = comparison.unit || '';
    const runs = data.diagnosis_runs || [];
    const currentStage = data.task.status === 'closed' || runs.at(-1)?.anomaly_status === 'not_triggered' ? 4 : 2;
    const stages = ['发现问题', '核查处理', 'V2 重算', '人工闭环'];
    return `<section class="problem-hero"><div class="hero-main"><span class="hero-kicker">${esc(ruleText(result.rule_code))} · ${esc(evidenceStatus(result.anomaly_status))}</span><h2>${esc(comparison.material_name)} 当前理论库存 <strong>${theoretical == null ? '无法计算' : `${esc(theoretical)} ${esc(unit)}`}</strong></h2><p>${esc(result.primary_hypothesis)}</p><div class="hero-facts"><span>首要排查：<b>${esc(result.primary_location)}</b></span><span>实盘：<b>${packet.physical_count?.value == null ? '未取得' : `${esc(packet.physical_count.value)} ${esc(unit)}`}</b></span><span>证据缺口：<b>${(result.evidence_gaps || []).length} 项</b></span><span>已保存 V2：<b>${runs.length} 次</b></span></div></div><div class="stage-track">${stages.map((label, index) => `<div class="stage ${index + 1 < currentStage ? 'done' : index + 1 === currentStage ? 'current' : ''}"><i>${index + 1 < currentStage ? '✓' : index + 1}</i><span>${label}</span></div>`).join('')}</div></section>`;
  };
  const taskBriefHtml = (data) => {
    const comparison = currentDiagnosis(data), result = comparison?.v2, packet = comparison?.fact_packet;
    if (!comparison || !result || !packet) return `<p class="instruction">${esc(data.task.instruction)}</p>`;
    const code = result.rule_code || data.task.source_rule_code || '';
    const material = `${comparison.material_name}（${comparison.unit}）`;
    const plans = code.includes('D2') ? [
      '核对最大负向流水的数量、单位、单号及是否重复记账。',
      '确认调拨目标门店是否实际到货并完成签收。',
      '若流水仍无法解释库存，完成一次该物料临时盘点。',
      '处理完成后由系统重新运行 V2，再提交人工结论。'
    ] : code.includes('D1') ? [
      '复核实盘数量、盘点单位和盘点凭证。', '核对收货、报损、调拨及库存调整流水。', '确认差异来源后重新运行 V2。'
    ] : code.includes('S1') ? [
      '确认现场库存与在途订货。', '判断是否影响营业并选择补货或调拨。', '到货或调拨签收后重新运行 V2。'
    ] : [
      '核对统计周期内的收货与销售 BOM 消耗。', '排查漏记、重复流水及销量变化。', '补齐证据后重新运行 V2。'
    ];
    return `<div class="task-goal"><span>处理目标</span><h3>确认“${esc(result.primary_location)}”是否为真实原因，并把处理结果带回库存台账。</h3><p>${esc(material)} · ${esc(data.task.store_code)} · ${esc(comparison.business_date)}</p></div><div class="task-columns"><div><h4>需要完成</h4><ol class="task-checklist">${plans.map((item) => `<li>${esc(item)}</li>`).join('')}</ol></div><div><h4>完成标准</h4><ul class="criteria"><li>至少关联一项业务凭证或人工核查记录</li><li>关键动作完成后产生最新 V2 快照</li><li>填写最终原因、解决方式和操作人</li><li>异常仍触发时不得选择“已恢复”</li></ul></div></div>`;
  };
  const actionPlanHtml = (data) => {
    const comparison = currentDiagnosis(data), actions = comparison?.v2?.actions || [];
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
    return actions.length ? `<div class="action-plan">${actions.map((item, index) => { const info = meta[item.action_id] || { reason:'按研判结果补充证据并记录处理结果。', owner:data.task.assigned_to || '待分配' }; const state = info.done ? '已完成' : info.ready ? '可查看' : '待处理'; const href = item.route ? actionUrl(item.route, data.task, comparison.material_name, comparison.business_date) : '#note-form'; return `<article class="action-card ${info.done ? 'done' : ''}"><div class="action-rank">${info.done ? '✓' : index + 1}</div><div class="action-content"><div class="action-title"><div><span>建议动作 ${index + 1}</span><h3>${esc(item.label)}</h3></div><em class="action-state">${state}</em></div><p>${esc(info.reason)}</p><div class="action-meta"><span>责任角色：${esc(info.owner)}</span>${item.requires_confirmation ? '<span>需要人工确认</span>' : '<span>只读核查</span>'}</div><a class="btn ${index === 0 && !info.done ? 'primary' : ''}" href="${esc(href)}">${item.mode === 'manual' ? '记录核查结果' : esc(item.label)}</a></div></article>`; }).join('')}</div>` : '<div class="good">最新 V2 未生成新的处理动作，可以进入人工闭环确认。</div>';
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
    const followUpHtml = followUps.length ? `<div class="follow-up-alert"><div><span>修正后发现新的问题</span><h4>${followUps.map((item) => esc(ruleText(item.rule_code))).join('、')}</h4><p>${followUps.map((item) => esc(item.evidence || '需要进一步核查。')).join('<br>')}</p></div><div class="follow-up-actions"><a class="btn" href="/diagnosis/">查看研判证据</a>${followUps.map((item) => `<button class="btn primary" type="button" data-followup-work-order="${esc(item.id)}">建立后续工单</button>`).join('')}</div></div>` : (latest.anomaly_status === 'not_triggered' ? '<div class="correction-clear">✓ 原异常恢复，当前没有发现同物料的后续异常。</div>' : '');
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
    const status = task.status === 'pending_hq_review' && task.escalation_level ? { label:'总部处理中', css:'review' } : statusInfo(task.status);
    const material = data.anomaly?.material_name || task.material_names?.[0] || '';
    const businessDate = data.anomaly?.business_date || data.diagnosis_v2?.comparison?.business_date || '';
    const docs = documents.length ? documents.map((item) => `<div class="document"><div><b>${esc(item.original_filename || item.document_no || item.order_no || item.receipt_no || item.id)}</b><small>${esc(item.document_type || '业务凭证')} · ${formatDate(item.received_at || item.created_at)}</small></div><a class="link" href="${documentHref(item, task)}">查看单据 →</a></div>`).join('') : '<div class="empty">暂无关联单据</div>';
    const eventRows = events.length ? `<ul>${events.map((item) => `<li>${esc(item.document_no || item.id)} · ${esc(item.material_name)} ${esc(item.qty)}${esc(item.unit)}</li>`).join('')}</ul>` : '';
    const timeRows = timeline(data).map((item) => `<div class="timeline-item"><h3>${esc(item.title)}</h3>${item.detail ? `<p>${esc(item.detail)}</p>` : ''}<div class="timeline-meta"><span>${formatDate(item.time)}</span><span>操作人：${esc(item.actor || '—')}</span></div></div>`).join('');
    root.innerHTML = `<header class="page-head"><div><div class="eyebrow">跟进工单 · ${esc(task.id)}</div><h1>${esc(task.title)}</h1><p class="subtitle">${esc(task.store_code || '—')} · ${esc(typeText(task.task_type))}</p></div><span class="status ${status.css}">${status.label}</span></header>
      ${problemHeroHtml(data)}
      <div class="layout"><div class="stack">
        <section class="panel task-panel"><div class="panel-head"><span class="section-index">01</span><div><h2>本次任务</h2><p>先明确需要完成什么，以及什么条件下才能结束。</p></div></div><div class="panel-body">${taskBriefHtml(data)}</div></section>
        <section class="panel action-panel"><div class="panel-head"><span class="section-index">02</span><div><h2>建议动作与执行</h2><p>按优先级处理；完成业务动作后系统会自动重新研判。</p></div></div><div class="panel-body">${actionPlanHtml(data)}</div></section>
        <section class="panel correction-panel"><div class="panel-head"><span class="section-index">03</span><div><h2>库存修正与验证</h2><p>把业务动作、库存变化和规则复核串成一条可读的闭环链路。</p></div></div><div class="panel-body">${correctionSummaryHtml(data)}</div></section>
        <section class="panel"><div class="panel-head split"><div class="section-heading"><span class="section-index">04</span><div><h2>系统研判过程</h2><p>从触发、回溯到首要判断，所有结论均可追溯。</p></div></div><button class="btn" id="reassess-task">重新研判并保存快照</button></div><div class="panel-body">${diagnosisHtml(data)}</div></section>
        <details class="panel compact-meta"><summary><span>工单基础信息与判断来源</span><small>编号、责任角色、创建时间及规则来源</small></summary><div class="panel-body"><div class="meta-grid"><div class="meta"><span>工单编号</span>${esc(task.id)}</div><div class="meta"><span>门店 / 主体</span>${esc(task.store_code || '—')}</div><div class="meta"><span>责任角色</span>${esc(task.assigned_to || '—')}</div><div class="meta"><span>当前操作人</span>${esc(task.last_operator || '—')}</div><div class="meta"><span>创建时间</span>${formatDate(task.created_at)}</div><div class="meta"><span>最近更新</span>${formatDate(task.updated_at || task.submitted_at || task.created_at)}</div></div><div class="source">${sourceHtml(data)}</div></div></details>
        <section class="panel"><div class="panel-head"><h2>关联单据与业务记录</h2></div><div class="panel-body"><div class="document-list">${docs}</div>${eventRows}</div></section>
        <details class="panel audit-panel"><summary><span>审计记录与处理时间线</span><small>共 ${timeline(data).length} 条 · 点击展开</small></summary><div class="panel-body"><div class="timeline">${timeRows}</div></div></details>
        ${task.resolution ? `<section class="panel"><div class="panel-head"><h2>${task.status === 'closed' ? '闭环结论' : '最近一次处理结论'}</h2></div><div class="panel-body"><div class="resolution ${task.status === 'closed' ? '' : 'pending'}">${esc(task.resolution)}</div></div></section>` : ''}
      </div><aside class="stack side-column">
        <section class="panel progress-panel"><div class="panel-head"><h2>当前处理状态</h2></div><div class="panel-body"><div class="progress-main"><span class="status ${status.css}">${status.label}</span><h3>${esc(task.assigned_to || '待分配')}</h3><p>最近更新 ${formatDate(task.updated_at || task.submitted_at || task.created_at)}</p></div><a class="side-link" href="${actionUrl('/flows/', task, material, businessDate)}">查看该物料库存流水 →</a><a class="side-link" href="/#operation-task-panel">返回工单列表 →</a></div></section>
        <section class="panel"><div class="panel-head"><h2>新增处理记录</h2><p>人工核查结果会进入时间线，也可作为闭环证据。</p></div><div class="panel-body"><form class="note-form" id="note-form"><label class="field"><span>操作人（可不填）</span><input name="operator" maxlength="80" placeholder="例如：总部运营 / 门店店长"></label><label class="field"><span>处理记录</span><textarea name="note" maxlength="500" required placeholder="例如：已联系目标门店，确认货物尚未到店"></textarea></label><div class="form-actions"><span class="hint">保存后写入工单时间线</span><button class="btn primary" type="submit">添加记录</button></div><div class="result" id="note-result"></div></form></div></section>
        ${task.status !== 'closed' ? `<section class="panel closure-panel"><div class="panel-head"><h2>人工闭环确认</h2><p>提交时自动运行最新 V2，并执行关闭门禁。</p></div><div class="panel-body"><form class="note-form" id="closure-form"><label class="field"><span>最终结果</span><select name="outcome" required><option value="resolved">已恢复</option><option value="accepted_exception">接受例外</option><option value="false_positive">规则误判</option><option value="master_data_issue">主数据问题（转治理）</option><option value="unresolved">尚未解决</option></select></label><label class="field" id="follow-up-field" hidden><span>尚未解决时的后续流向</span><select name="follow_up_action"><option value="reopen_store">重新交由门店处理</option><option value="escalate_hq">升级至总部运营</option><option value="escalate_governance">升级至主数据治理</option></select></label><label class="field"><span>最终原因</span><textarea name="final_cause" required placeholder="确认后的真实原因"></textarea></label><label class="field"><span>解决方式 / 下一步</span><textarea name="resolution_note" required placeholder="已做什么，或接下来由谁做什么"></textarea></label><label class="field"><span>操作人</span><input name="operator" required placeholder="总部运营 / 门店店长"></label><label class="check"><input type="checkbox" name="store_adopted">门店已采纳处理方案</label><label class="check"><input type="checkbox" name="hq_confirmed" required>总部确认本次结论</label><button class="btn primary" type="submit">重算并提交结论</button><div class="result" id="closure-result"></div></form></div></section>` : ''}
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
    document.querySelectorAll('[data-followup-work-order]').forEach((button) => button.addEventListener('click', async () => {
      const restore = setLoading(button, '正在建立…');
      try {
        const result = await api(`/api/anomalies/${encodeURIComponent(button.dataset.followupWorkOrder)}/work-order`, { method:'POST' });
        const next = result.operationTask;
        if (!next?.id) throw new Error('后续工单已建立，但未返回工单编号。');
        location.href = `/work-order/?id=${encodeURIComponent(next.id)}`;
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
  load().catch((error) => { root.innerHTML = `<div class="fatal"><b>无法打开工单</b><br>${esc(error.message)}<br><br><a class="link" href="/#operation-task-panel">返回工单列表</a></div>`; });
})();
