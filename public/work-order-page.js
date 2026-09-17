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
  const render = (data) => {
    const { task, documents = [], events = [] } = data;
    const status = statusInfo(task.status);
    const material = data.anomaly?.material_name || task.material_names?.[0] || '';
    const docs = documents.length ? documents.map((item) => { const href = item.document_type === 'purchase_order' ? `/procurement-detail/?type=purchase&id=${encodeURIComponent(item.id)}` : item.document_type === 'receipt_order' ? `/procurement-detail/?type=receipt&id=${encodeURIComponent(item.id)}` : `/documents/?document=${encodeURIComponent(item.id)}`; return `<div class="document"><div><b>${esc(item.original_filename || item.document_no || item.order_no || item.receipt_no || item.id)}</b><small>${esc(item.document_type || '业务凭证')} · ${formatDate(item.received_at || item.created_at)}</small></div><a class="link" href="${href}">查看单据 →</a></div>`; }).join('') : '<div class="empty">暂无关联单据</div>';
    const eventRows = events.length ? `<ul>${events.map((item) => `<li>${esc(item.document_no || item.id)} · ${esc(item.material_name)} ${esc(item.qty)}${esc(item.unit)}</li>`).join('')}</ul>` : '';
    const timeRows = timeline(data).map((item) => `<div class="timeline-item"><h3>${esc(item.title)}</h3>${item.detail ? `<p>${esc(item.detail)}</p>` : ''}<div class="timeline-meta"><span>${formatDate(item.time)}</span><span>操作人：${esc(item.actor || '—')}</span></div></div>`).join('');
    root.innerHTML = `<header class="page-head"><div><div class="eyebrow">跟进工单 · ${esc(task.id)}</div><h1>${esc(task.title)}</h1><p class="subtitle">${esc(task.store_code || '—')} · ${esc(typeText(task.task_type))}</p></div><span class="status ${status.css}">${status.label}</span></header>
      <div class="layout"><div class="stack">
        <section class="panel"><div class="panel-head"><h2>工单信息</h2></div><div class="panel-body"><div class="meta-grid"><div class="meta"><span>工单编号</span>${esc(task.id)}</div><div class="meta"><span>门店 / 主体</span>${esc(task.store_code || '—')}</div><div class="meta"><span>责任角色</span>${esc(task.assigned_to || '—')}</div><div class="meta"><span>当前操作人</span>${esc(task.last_operator || '—')}</div><div class="meta"><span>创建时间</span>${formatDate(task.created_at)}</div><div class="meta"><span>最近更新</span>${formatDate(task.updated_at || task.submitted_at || task.created_at)}</div></div></div></section>
        <section class="panel"><div class="panel-head"><h2>任务详情</h2></div><div class="panel-body"><p class="instruction">${esc(task.instruction)}</p></div></section>
        <section class="panel"><div class="panel-head"><h2>来源与判断记录</h2></div><div class="panel-body"><div class="source">${sourceHtml(data)}</div></div></section>
        <section class="panel"><div class="panel-head"><h2>关联单据与业务记录</h2></div><div class="panel-body"><div class="document-list">${docs}</div>${eventRows}</div></section>
        <section class="panel"><div class="panel-head"><h2>处理时间线</h2></div><div class="panel-body"><div class="timeline">${timeRows}</div></div></section>
        ${task.resolution ? `<section class="panel"><div class="panel-head"><h2>闭环结论</h2></div><div class="panel-body"><div class="resolution">${esc(task.resolution)}</div></div></section>` : ''}
      </div><aside class="stack">
        <section class="panel"><div class="panel-head"><h2>新增处理记录</h2></div><div class="panel-body"><form class="note-form" id="note-form"><label class="field"><span>操作人（可不填）</span><input name="operator" maxlength="80" placeholder="例如：总部运营 / 门店店长"></label><label class="field"><span>处理记录</span><textarea name="note" maxlength="500" required placeholder="记录已核对事项、处理结果或下一步"></textarea></label><div class="form-actions"><span class="hint">保存后写入工单时间线</span><button class="btn primary" type="submit">添加记录</button></div><div class="result" id="note-result"></div></form></div></section>
        <section class="panel"><div class="panel-head"><h2>工单操作</h2></div><div class="panel-body"><div class="action-list">${task.status === 'pending_hq_review' ? '<button class="btn primary" id="close-task">验收并关闭</button>' : `<button class="btn" disabled>${task.status === 'closed' ? '工单已闭环' : '等待门店提交'}</button>`}<a class="btn" href="/flows/?store=${encodeURIComponent(task.store_code || '')}${material ? `&material=${encodeURIComponent(material)}` : ''}">查看库存流水</a><a class="btn" href="/count-plans/?source=work_order&work_order=${encodeURIComponent(task.id)}">下发关联盘点</a><a class="btn" href="/purchase-orders/?source_work_order_id=${encodeURIComponent(task.id)}&store=${encodeURIComponent(task.store_code || '')}${material ? `&material=${encodeURIComponent(material)}` : ''}&urgency=urgent#create">建立紧急补货草稿</a><a class="btn" href="/receipt-orders/?source_work_order_id=${encodeURIComponent(task.id)}&store=${encodeURIComponent(task.store_code || '')}${material ? `&material=${encodeURIComponent(material)}` : ''}#create">建立收货草稿</a><a class="btn" href="/#operation-task-panel">返回工单列表</a></div></div></section>
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
    document.getElementById('close-task')?.addEventListener('click', async (event) => {
      if (!confirm('确认凭证无误并关闭这张工单吗？')) return;
      const restore = setLoading(event.currentTarget, '正在关闭…');
      try { await api(`/api/operation-tasks/${encodeURIComponent(data.task.id)}/close`, { method:'POST' }); await load(); }
      catch (error) { alert(error.message); restore(); }
    });
  };
  load().catch((error) => { root.innerHTML = `<div class="fatal"><b>无法打开工单</b><br>${esc(error.message)}<br><br><a class="link" href="/#operation-task-panel">返回工单列表</a></div>`; });
})();
