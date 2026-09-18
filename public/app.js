(function () {
  'use strict';

  const view = document.body.dataset.view;
  const documentTypes = {
    inventory_count: { label: '盘点单', action: '上传盘点单', copy: '盘点单会自动识别牛奶、糖浆、杯子，并核对理论库存。' },
    receipt: { label: '收货单', action: '上传收货单', copy: '收货单会模拟识别单号、收货日期与入库物料。' },
    scrap: { label: '报废单', action: '上传报废单', copy: '报废单会模拟识别报废原因、日期与报废物料。' }
  };
  let selectedDocumentType = 'inventory_count';
  let uploadBusy = false;
  let operationProofBusy = false;
  let latestStoreState = null;
  let latestHqState = null;
  let selectedOperationTaskId = null;
  let selectedOperationStatus = 'all';
  let selectedGovernanceTaskId = null;
  const api = (path, options) => fetch(path, { headers: { 'Content-Type': 'application/json' }, ...options })
    .then(async (response) => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '服务暂不可用');
      return data;
    });
  let storeBootstrapPromise = null;
  window.loadStoreBootstrap = window.loadStoreBootstrap || ((refresh = false) => {
    if (refresh) storeBootstrapPromise = null;
    if (!storeBootstrapPromise) {
      const storeCode = new URLSearchParams(window.location.search).get('store') || 'STORE001';
      storeBootstrapPromise = api(`/api/store/bootstrap?store=${encodeURIComponent(storeCode)}`)
        .catch((error) => { storeBootstrapPromise = null; throw error; });
    }
    return storeBootstrapPromise;
  });
  window.invalidateStoreBootstrap = () => { storeBootstrapPromise = null; };
  const esc = (value) => String(value == null ? '' : value).replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' }[c]));
  const statusText = (status) => ({ pending_hq_decision: '待总部决策', pending_store_recount: '待门店复盘', pending_hq_review: '待总部复核', closed: '已闭环' }[status] || '待处理');
  const operationStatusText = (status) => ({ pending_store_submission: '待门店执行', pending_hq_review: '待总部验收', closed: '已完成' }[status] || '待处理');
  const typeLabel = (type) => documentTypes[type]?.label || (type === 'operation_proof' ? '任务凭证' : '盘点单');

  function formatDate(value) {
    if (!value) return '-';
    return new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value));
  }

  function formatDuration(start, end) {
    if (!start || !end) return '-';
    const seconds = Math.max(0, Math.floor((new Date(end) - new Date(start)) / 1000));
    if (seconds < 60) return `闭环用时 ${Math.max(1, seconds)} 秒`;
    const minutes = Math.floor(seconds / 60);
    return minutes < 60 ? `闭环用时 ${minutes} 分钟` : `闭环用时 ${Math.floor(minutes / 60)} 小时 ${minutes % 60} 分钟`;
  }

  function setStoreMessage(message, tone) {
    const node = document.querySelector('#count-status');
    if (!node) return;
    node.className = `count-status ${tone || ''}`;
    node.textContent = message;
  }

  function setButtonLoading(button, text) {
    const original = button.innerHTML;
    button.disabled = true;
    button.classList.add('is-loading');
    button.innerHTML = `<span class="spinner"></span>${text}`;
    return () => {
      button.disabled = false;
      button.classList.remove('is-loading');
      button.innerHTML = original;
    };
  }

  function makePreviewData(file) {
    if (!file?.type?.startsWith('image/')) return Promise.resolve(null);
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onerror = () => resolve(null);
      reader.onload = () => {
        const image = new Image();
        image.onerror = () => resolve(null);
        image.onload = () => {
          const limit = 900; const scale = Math.min(1, limit / Math.max(image.width, image.height));
          const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(image.width * scale)); canvas.height = Math.max(1, Math.round(image.height * scale));
          const context = canvas.getContext('2d'); context.drawImage(image, 0, 0, canvas.width, canvas.height);
          let preview = canvas.toDataURL('image/jpeg', .72);
          if (preview.length > 340000) preview = canvas.toDataURL('image/jpeg', .5);
          resolve(preview.length <= 360000 ? preview : null);
        };
        image.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function documentLines(document) {
    if (!document.lines?.length) return `<div class="document-lines">${esc(document.note || '识别结果已写入单据记录。')}</div>`;
    return `<ul class="document-lines">${document.lines.map((line) => `<li>${esc(line.material_name)}：理论 ${line.theoretical_qty}${esc(line.unit)}，实盘 ${line.actual_qty}${esc(line.unit)}${line.match_status === 'variance' ? ' <b style="color:#d72a2a">差异较大</b>' : ' <span style="color:#2a9d3f">核对正常</span>'}</li>`).join('')}</ul>`;
  }

  function renderDocuments(documents) {
    const list = document.querySelector('#document-list');
    if (!list) return;
    if (!documents.length) {
      list.innerHTML = '<div class="document-record">尚无上传单据。盘点单提交后，会在这里保留识别记录和明细。</div>';
      return;
    }
    list.innerHTML = documents.slice(0, 5).map((document) => `<details class="document-record">
      <summary>${esc(typeLabel(document.document_type))} · ${esc(document.original_filename)} <span style="font-weight:400;color:#8f959e">${formatDate(document.received_at)}</span></summary>
      <div class="document-meta">单据编号：${esc(document.id)}<br>识别状态：已完成 · 置信度 ${Math.round((document.ocr_confidence || 0) * 100)}%<br>${esc(document.note || '')}</div>
      ${documentLines(document)}
    </details>`).join('');
  }

  function openDocumentDrawer(document) {
    const lines = document.lines?.length
      ? `<ul class="document-detail-lines">${document.lines.map((line) => `<li>${esc(line.material_name)}：理论 ${esc(line.theoretical_qty)}${esc(line.unit)}，识别数量 ${esc(line.actual_qty)}${esc(line.unit)}${line.match_status === 'variance' ? ' · <b style="color:#d72a2a">差异较大</b>' : ' · <span style="color:#2a9d3f">核对正常</span>'}</li>`).join('')}</ul>`
      : '<div class="document-no-preview">该凭证已归档；本次不需要提取物料明细。</div>';
    const image = document.preview_data
      ? `<div class="document-preview"><img src="${esc(document.preview_data)}" alt="${esc(document.original_filename)}"></div>`
      : '<div class="document-preview"><div class="document-no-preview">此历史凭证仅保留了文件名和 OCR 结果；新上传图片会在此保留可查看的缩略图。</div></div>';
    document.querySelector('#document-drawer-content').innerHTML = `<div class="drawer-head"><div><div class="live-eyebrow">门店上传凭证 · 已归档</div><h2 id="document-drawer-title">${esc(typeLabel(document.document_type))} · ${esc(document.original_filename)}</h2></div><button class="drawer-close" data-close-document-drawer aria-label="关闭凭证">×</button></div>
      <div class="drawer-block"><div class="drawer-grid"><div class="drawer-field"><span>单据编号</span>${esc(document.id)}</div><div class="drawer-field"><span>上传时间</span>${esc(formatDate(document.received_at))}</div><div class="drawer-field"><span>OCR 状态</span>已完成 · 置信度 ${Math.round((document.ocr_confidence || 0) * 100)}%</div><div class="drawer-field"><span>单据用途</span>${esc(typeLabel(document.document_type))}</div></div></div>
      <div class="drawer-block"><h3>凭证图片</h3>${image}</div>
      <div class="drawer-block"><h3>OCR 识别结果</h3><p style="font-size:14px;color:#4e5969;line-height:1.7">${esc(document.note || '已归档门店上传凭证。')}</p>${lines}</div>`;
    const drawer = document.querySelector('#document-drawer'); drawer.classList.add('open'); drawer.setAttribute('aria-hidden', 'false');
    drawer.querySelector('[data-close-document-drawer]').onclick = () => { drawer.classList.remove('open'); drawer.setAttribute('aria-hidden', 'true'); };
  }

  function openOperationProofDrawer(task, state) {
    const proofDocument = task.proof_document_id && (state.documents || []).find((item) => item.id === task.proof_document_id);
    if (proofDocument) return openDocumentDrawer(proofDocument);
    document.querySelector('#document-drawer-content').innerHTML = `<div class="drawer-head"><div><div class="live-eyebrow">门店上传凭证 · 历史归档</div><h2 id="document-drawer-title">${esc(task.proof_filename || '门店核查凭证')}</h2></div><button class="drawer-close" data-close-document-drawer aria-label="关闭凭证">×</button></div>
      <div class="drawer-block"><div class="drawer-grid"><div class="drawer-field"><span>关联任务</span>${esc(task.id)}</div><div class="drawer-field"><span>提交时间</span>${esc(formatDate(task.submitted_at))}</div><div class="drawer-field"><span>当前状态</span>${esc(operationStatusText(task.status))}</div><div class="drawer-field"><span>凭证类型</span>门店核查凭证</div></div></div>
      <div class="drawer-block"><h3>归档说明</h3><div class="document-preview"><div class="document-no-preview">该历史任务只保留了凭证登记信息；后续新上传的凭证会显示缩略图与 OCR 识别结果。</div></div></div>
      ${task.resolution ? `<div class="drawer-block"><h3>总部验收结论</h3><p style="font-size:14px;color:#2a9d3f;line-height:1.7">${esc(task.resolution)}</p></div>` : ''}`;
    const drawer = document.querySelector('#document-drawer'); drawer.classList.add('open'); drawer.setAttribute('aria-hidden', 'false');
    drawer.querySelector('[data-close-document-drawer]').onclick = () => { drawer.classList.remove('open'); drawer.setAttribute('aria-hidden', 'true'); };
  }

  function taskCard(task) {
    if (!task || task.status === 'pending_hq_decision') return '';
    const isRecount = task.status === 'pending_store_recount';
    const isClosed = task.status === 'closed';
    return `<div class="task-item count-task demo-flow ${isClosed ? 'closed-task' : ''}"><span class="store-demo-float">DEMO</span>
      <div class="task-icon ${isClosed ? 'green' : 'red'}">${isClosed ? '✓' : '🧾'}</div>
      <div class="task-body">
        <div class="task-title">${isClosed ? '盘点差异已闭环' : '指定商品复盘：牛奶'}<span class="badge-direct">${statusText(task.status)}</span></div>
        <div class="task-meta">${esc(task.diagnosis)}<br>责任人：${esc(task.assigned_to)}</div>
        ${isRecount ? '<details class="task-detail"><summary>查看复盘原因</summary><p>总部发现首次盘点与理论库存差异过大，需要只针对牛奶再盘一次；请确认是否录入错误或实际短缺。</p></details><div class="task-action"><button class="btn btn-primary" id="recount-btn">上传牛奶复盘单</button></div>' : ''}
        ${task.status === 'pending_hq_review' ? '<div class="task-action"><span class="pending-copy">复盘凭证已提交，等待总部运营复核。</span></div>' : ''}
        ${isClosed ? `<div class="task-action"><span class="closed-copy">${esc(task.resolution)} · ${formatDuration(task.created_at, task.closed_at)}</span></div>` : ''}
      </div>
    </div>`;
  }

  function dailyCountTask(task) {
    if (!task) return `<div class="task-item demo-flow"><span class="store-demo-float">DEMO</span>
      <div class="task-icon blue">📋</div><div class="task-body"><div class="task-title">今日盘点<span class="badge-direct">必做</span></div>
      <div class="task-meta">盘点牛奶、糖浆、杯子；上传盘点单后系统自动识别并核对理论库存。</div>
      <div class="task-action"><button class="btn btn-primary" id="daily-count-btn">去盘点</button></div></div></div>`;
    const isDone = task.status !== 'pending_store_recount';
    return `<div class="task-item demo-flow"><span class="store-demo-float">DEMO</span>
      <div class="task-icon ${isDone ? 'green' : 'yellow'}">${isDone ? '✓' : '🧾'}</div><div class="task-body"><div class="task-title">今日盘点<span class="badge-direct">${isDone ? '已完成' : '需复盘'}</span></div>
      <div class="task-meta">${task.status === 'pending_hq_decision' ? '首次盘点已完成；牛奶差异较大，系统已推送总部审核，等待是否要求复盘。' : task.status === 'pending_store_recount' ? '总部要求对牛奶单独复盘，请查看下方任务。' : task.status === 'pending_hq_review' ? '牛奶复盘已提交，等待总部最终确认。' : `本次盘点任务已完成闭环（${formatDuration(task.created_at, task.closed_at)}）。`}</div></div></div>`;
  }

  function operationStoreTask(task) {
    if (!task) return '';
    const isPending = task.status === 'pending_store_submission';
    const isReview = task.status === 'pending_hq_review';
    return `<div class="task-item count-task operation-task demo-flow ${task.status === 'closed' ? 'closed-task' : ''}"><span class="store-demo-float">优先处理</span>
      <div class="task-icon ${task.status === 'closed' ? 'green' : 'blue'}">${task.status === 'closed' ? '✓' : '📌'}</div>
      <div class="task-body"><div class="task-title">${esc(task.title)}<span class="badge-direct">${operationStatusText(task.status)}</span></div>
      <div class="task-code">工单 ${esc(task.id)}${task.source_anomaly_id ? ` · 来源研判 ${esc(task.source_anomaly_id)}` : ' · 来源：总部运营任务'}</div>
      <div class="task-meta">${esc(task.instruction)}<br>责任人：${esc(task.assigned_to)}</div>
      <details class="task-detail" open><summary>系统已核对</summary><p>下发时间：${esc(formatDate(task.created_at))}。任务来自后台统一工单；提交处理凭证后进入总部验收，并在同一条时间线保留操作人与结果。</p></details>
      ${isPending ? '<div class="task-action"><button class="btn btn-primary" id="operation-submit-btn">开始核对</button><button class="btn btn-outline" id="operation-ask-agent-btn" type="button">问门店助手</button></div>' : ''}
      ${isReview ? `<div class="task-action"><span class="pending-copy">已提交凭证：${esc(task.proof_filename)}；等待总部验收。</span></div>` : ''}
      ${task.status === 'closed' ? `<div class="task-action"><span class="closed-copy">${esc(task.resolution)} · ${formatDuration(task.created_at, task.closed_at)}</span></div>` : ''}
      </div></div>`;
  }

  function syncUploadControl(task) {
    const uploadButton = document.querySelector('#choose-document-file');
    const uploadLabel = document.querySelector('#upload-copy');
    const config = documentTypes[selectedDocumentType];
    const countBlocked = selectedDocumentType === 'inventory_count' && task && task.status !== 'closed';
    uploadButton.disabled = countBlocked || uploadBusy;
    uploadButton.textContent = config.action;
    uploadLabel.textContent = countBlocked && task.status === 'pending_hq_decision'
      ? '今日盘点已完成。牛奶差异正在等待总部审核；仍可上传收货单或报废单。'
      : countBlocked && task.status === 'pending_store_recount'
        ? '请通过下方“指定商品复盘”上传牛奶复盘单；仍可上传收货单或报废单。'
        : config.copy;
    document.querySelectorAll('[data-document-type]').forEach((button) => button.classList.toggle('active', button.dataset.documentType === selectedDocumentType));
  }

  function renderStore(state) {
    latestStoreState = state;
    const storeCode = new URLSearchParams(window.location.search).get('store') || state.storeCode || 'STORE001';
    const storeMaster = state.storeMaster || {};
    const headerCode = document.querySelector('#store-header-code'); if (headerCode) headerCode.textContent = storeMaster.store_code || storeCode;
    const headerName = document.querySelector('#store-header-name'); if (headerName) headerName.textContent = storeMaster.store_name || storeCode;
    const headerRole = document.querySelector('#store-header-role'); if (headerRole) headerRole.textContent = storeMaster.store_role || '门店';
    const footerName = document.querySelector('#store-footer-name'); if (footerName) footerName.textContent = `${storeMaster.store_name || storeCode} · ${storeMaster.store_code || storeCode}`;
    const headerDate = document.querySelector('#store-header-date'); if (headerDate) headerDate.textContent = new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', month: 'numeric', day: 'numeric', weekday: 'short' }).format(new Date());
    const storeOperationTasks = (state.operationTasks || []).filter((item) => (item.store_code || item.assigned_store_code || storeCode) === storeCode);
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(new Date());
    const overdueTasks = storeOperationTasks.filter((item) => item.status === 'pending_store_submission' && item.due_date && item.due_date < today);
    const riskCount = document.querySelector('#header-risk-count'); if (riskCount) riskCount.textContent = String(overdueTasks.length);
    const planCount = document.querySelector('#header-plan-count'); if (planCount) planCount.textContent = String((state.countPlans || []).filter((plan) => plan.store_code === storeCode && plan.business_date === today).length);
    const taskArea = document.querySelector('#count-task-area');
    if (taskArea) taskArea.innerHTML = taskCard(state.task);
    const actionableOperationTask = storeOperationTasks.find((item) => item.status === 'pending_store_submission') || null;
    document.querySelector('#operation-task-area').innerHTML = operationStoreTask(actionableOperationTask);
    renderDocuments(state.documents);
    const todoCount = document.querySelector('#todo-count');
    if (!state.task) {
      setStoreMessage('等待门店上传首次盘点单。', 'muted');
    } else if (state.task.status === 'pending_hq_decision') {
      setStoreMessage('首次盘点已完成。牛奶差异较大，已生成总部异常审核；暂不要求门店重复操作。', 'warning');
    } else if (state.task.status === 'pending_store_recount') {
      setStoreMessage('已生成复盘任务：请单独盘点牛奶并再次上传。', 'warning');
    } else if (state.task.status === 'pending_hq_review') {
      setStoreMessage('复盘已上传，总部刷新后可看到待复核任务。', 'success');
    } else {
      setStoreMessage(`本次盘点差异已完成闭环（${formatDuration(state.task.created_at, state.task.closed_at)}）。`, 'success');
    }
    window.storeTaskUiRefresh = () => {
      const operation = (latestStoreState?.operationTasks || []).filter((item) => (item.store_code || item.assigned_store_code || storeCode) === storeCode && item.status === 'pending_store_submission').length;
      const plans = (latestStoreState?.countPlans || []).filter((item) => item.store_code === storeCode && item.status === 'pending_store_count').length;
      const receipts = Number.isFinite(window.storePendingTransferCount) ? window.storePendingTransferCount : (latestStoreState?.storeTransferRequests || []).filter((item) => item.to_store_code === storeCode && item.status === 'pending_receipt').length;
      const total = operation + plans + receipts;
      if (todoCount) todoCount.textContent = String(total);
      const headerTodo = document.querySelector('#header-todo-count'); if (headerTodo) headerTodo.textContent = String(total);
      const summarySales = document.querySelector('#summary-sales'); if (summarySales) summarySales.textContent = `${Number(latestStoreState?.feishuImport?.latest_sales_qty || 0).toLocaleString('zh-CN')} 杯`;
      const activeRisks = (latestStoreState?.materialAnomalies || []).filter((item) => !['closed','auto_closed'].includes(item.status));
      const summaryRisk = document.querySelector('#summary-risk'); if (summaryRisk) summaryRisk.textContent = `${activeRisks.length} 项`;
      const scrapQty = (latestStoreState?.materialEvents || []).filter((event) => event.type === 'scrap' && event.status === 'active').reduce((sum, event) => sum + Number(event.qty || 0), 0);
      const summaryLoss = document.querySelector('#summary-loss'); if (summaryLoss) summaryLoss.textContent = scrapQty ? `${scrapQty.toLocaleString('zh-CN')} 单位` : '暂无报损流水';
      const summaryHealth = document.querySelector('#summary-health'); if (summaryHealth) { summaryHealth.textContent = activeRisks.length ? '需关注' : '正常'; summaryHealth.style.color = activeRisks.length ? '#d68a00' : '#2a9d3f'; }
      const empty = document.querySelector('#today-task-empty');
      if (empty) {
        empty.style.display = total ? 'none' : 'flex';
        empty.classList.add('is-ready');
        empty.innerHTML = '<span>✓</span><span>今天暂无待办，新的盘点、收货或总部任务会出现在这里</span>';
      }
    };
    window.storeTaskUiRefresh();
    syncUploadControl(state.task);
    document.querySelector('#recount-btn')?.addEventListener('click', () => openPicker('inventory_count', 'recheck'));
    document.querySelector('#daily-count-btn')?.addEventListener('click', () => openPicker('inventory_count', 'initial'));
    document.querySelector('#operation-submit-btn')?.addEventListener('click', () => document.querySelector('#operation-proof-file').click());
    document.querySelector('#operation-ask-agent-btn')?.addEventListener('click', async () => {
      if (!actionableOperationTask) return;
      const prompt = `我正在处理工单 ${actionableOperationTask.id}：${actionableOperationTask.title}。任务要求是：${actionableOperationTask.instruction}。请告诉我应该先核对什么，并带我完成下一步。`;
      if (typeof window.storeAgentAsk === 'function') await window.storeAgentAsk(prompt);
      else window.switchStoreTab?.('agent');
    });
  }

  function operationTaskAction(task) {
    if (task.status === 'pending_hq_review') return `<button class="btn btn-primary" data-close-operation="${task.id}">验收并关闭</button>`;
    if (task.status === 'pending_store_submission') return '<button class="btn" disabled>等待门店提交</button>';
    return '<button class="btn" disabled>已完成</button>';
  }

  function operationHqPanel(tasks, documents = []) {
    const task = tasks.find((item) => item.id === selectedOperationTaskId) || tasks[0] || null;
    const activeTask = tasks.find((item) => item.status !== 'closed');
    const rows = tasks.length ? tasks.slice(0, 5).map((item) => `<tr>
      <td>${esc(item.id)}</td><td>${esc(item.title)}</td><td>STORE001</td><td><span class="status-tag ${item.status === 'closed' ? 'closed' : item.status === 'pending_hq_review' ? 'assigned' : 'pending'}">${operationStatusText(item.status)}</span></td><td>${formatDate(item.created_at)}</td>
      <td><div class="btn-row"><a class="btn" href="/work-order/?id=${encodeURIComponent(item.id)}">查看详情</a>${operationTaskAction(item)}</div></td></tr>`).join('') : '<tr><td colspan="6" class="operation-empty">暂无主动运营任务。创建后会同步出现在门店待办。</td></tr>';
    const linkedDocuments = task ? (task.linked_document_ids || []).map((id) => documents.find((item) => item.id === id)).filter(Boolean) : [];
    const linkedDocumentHtml = linkedDocuments.length ? `<div style="margin-top:10px"><b style="font-size:13px">关联单据</b><div class="btn-row" style="margin-top:6px">${linkedDocuments.map((document) => `<button class="btn" data-open-operation-document="${document.id}">${esc(document.original_filename || document.id)}</button>`).join('')}</div></div>` : '';
    const detail = task ? `<div class="operation-detail" id="operation-detail-panel"><div class="live-eyebrow">任务详情 · ${operationStatusText(task.status)}</div><h3>${esc(task.title)}</h3><p>${esc(task.instruction)}</p><p style="margin-top:7px">责任人：${esc(task.assigned_to)} · 下发时间：${formatDate(task.created_at)}${task.proof_filename ? `<br>门店凭证：${esc(task.proof_filename)} · 提交时间：${formatDate(task.submitted_at)}` : ''}${task.resolution ? `<br><span style="color:#2a9d3f">${esc(task.resolution)} · ${formatDuration(task.created_at, task.closed_at)}</span>` : ''}</p>${linkedDocumentHtml}<div class="live-task-actions" style="margin-top:10px">${operationTaskAction(task)}</div></div>` : '';
    return `<div class="operation-workspace">
      <form class="operation-create" id="operation-create-form">
        <div class="operation-create-head"><div class="operation-create-title">创建门店运营任务</div><span class="status-tag ${activeTask ? 'pending' : 'closed'}">${activeTask ? '当前有进行中任务' : '可下发'}</span></div>
        <div class="operation-fields"><input id="operation-title" maxlength="40" value="冷藏温度巡检" aria-label="任务名称"><textarea id="operation-instruction" maxlength="240" aria-label="执行要求">请在开店前检查冷藏设备温度是否处于 0–4°C，拍摄温度计或设备面板作为凭证后提交。</textarea><button class="btn btn-primary" type="submit" ${activeTask ? 'disabled' : ''}>下发给 STORE001</button></div>
        <div class="operation-form-tip">一次只允许一个进行中任务，避免门店待办堆积；任务提交凭证后由总部验收关闭。</div>
      </form>
      ${detail}
      <div class="operation-list"><table><thead><tr><th>任务编号</th><th>任务名称</th><th>门店</th><th>状态</th><th>下发时间</th><th>操作</th></tr></thead><tbody>${rows}</tbody></table></div>
    </div>`;
  }

  function hqPanel(task, documents) {
    if (!task) return '<div class="live-empty">等待 STORE001 上传首次盘点单。上传后此处会自动出现规则研判与任务状态。</div>';
    const document = documents.find((item) => item.id === task.document_id);
    const actions = task.status === 'pending_hq_decision'
      ? `<button class="btn btn-primary" data-request-recount="${task.id}">要求门店重新盘点</button><button class="btn" data-end-audit="${task.id}">结束审核</button>`
      : task.status === 'pending_hq_review'
        ? `<button class="btn btn-primary" data-close-task="${task.id}">复核并关闭</button>`
        : task.status === 'pending_store_recount'
          ? '<button class="btn" disabled>等待门店复盘</button>'
          : '<button class="btn" disabled>任务已关闭</button>';
    return `<div class="live-task-panel">
      <div><div class="live-eyebrow">实时闭环任务 · ${statusText(task.status)}</div><strong>${esc(task.material_name)}盘点差异</strong><p>${esc(task.diagnosis)}</p>${task.resolution ? `<p class="resolution">${esc(task.resolution)} · ${formatDuration(task.created_at, task.closed_at)}</p>` : ''}
      ${document ? `<details id="task-document-details" style="margin-top:8px;font-size:12px;color:#4e5969"><summary style="cursor:pointer;color:#3370ff">查看首次盘点单与 OCR 明细</summary><div style="margin-top:6px">${esc(document.original_filename)} · ${formatDate(document.received_at)}${documentLines(document)}</div></details>` : ''}</div>
      <div class="live-task-actions">${actions}</div>
    </div>`;
  }

  function hqRow(task) {
    if (!task || task.status === 'closed') return '';
    const statusClass = task.status === 'pending_hq_review' ? 'assigned' : 'pending';
    const actionText = task.status === 'pending_hq_decision' ? '总部决定：要求复盘或结束审核' : task.status === 'pending_store_recount' ? '门店单独复盘并上传凭证' : '总部复核复盘结果';
    const operation = task.status === 'pending_hq_decision'
      ? `<button class="btn btn-primary" data-request-recount="${task.id}">要求复盘</button><button class="btn" data-end-audit="${task.id}">结束审核</button>`
      : task.status === 'pending_hq_review'
        ? `<button class="btn btn-primary" data-close-task="${task.id}">复核关闭</button>`
        : '<button class="btn" disabled>等待门店</button>';
    return `<tr class="live-row"><td>STORE001</td><td>盘点差异</td><td><span class="severity-tag high">高</span></td><td><span class="root-cause">盘点异常</span></td><td><span class="responsible">门店 / 总部</span></td><td class="desc-cell">${esc(task.material_name)}：理论 ${task.theoretical_qty}${task.unit}，首次 ${task.initial_qty}${task.unit}${task.recheck_qty != null ? `，复盘 ${task.recheck_qty}${task.unit}` : ''}</td><td class="action-cell">${actionText}</td><td><span class="status-tag ${statusClass}">${statusText(task.status)}</span></td><td><div class="btn-row"><button class="btn" data-show-task-detail>查看详情</button>${operation}</div></td></tr>`;
  }

  function hqClosedRow(task) {
    if (!task || task.status !== 'closed') return '';
    return `<tr class="live-closed-row"><td>STORE001</td><td>盘点差异</td><td><span class="severity-tag high">高</span></td><td>${esc(task.resolution || '总部已复核')}</td><td>${formatDuration(task.created_at, task.closed_at)}<br><span style="color:#8f959e;font-size:12px">关闭于 ${formatDate(task.closed_at)}</span></td></tr>`;
  }

  function bindHqAction(selector, label, request) {
    document.querySelectorAll(selector).forEach((button) => button.addEventListener('click', async () => {
      const restore = setButtonLoading(button, label);
      try { renderHq(await request(button)); }
      catch (error) { alert(error.message); restore(); }
    }));
  }

  function renderHq(state) {
    latestHqState = state;
    document.querySelector('#operation-task-panel').innerHTML = operationHqPanel(state.operationTasks || [], state.documents || []);
    document.querySelector('#live-task-panel').innerHTML = hqPanel(state.task, state.documents);
    document.querySelector('#live-anomaly-row').innerHTML = hqRow(state.task);
    document.querySelector('#live-closed-row').innerHTML = hqClosedRow(state.task);
    const pending = state.task && state.task.status !== 'closed' ? 1 : 0;
    document.querySelector('#live-pending-count').textContent = pending;
    document.querySelector('#live-closed-count').textContent = state.task?.status === 'closed' ? 1 : 0;
    bindHqAction('[data-close-task]', '正在关闭…', (button) => api(`/api/tasks/${button.dataset.closeTask}/close`, { method: 'POST' }));
    bindHqAction('[data-request-recount]', '正在指派…', (button) => api(`/api/tasks/${button.dataset.requestRecount}/request-recount`, { method: 'POST' }));
    bindHqAction('[data-end-audit]', '正在结束…', (button) => api(`/api/tasks/${button.dataset.endAudit}/end-audit`, { method: 'POST' }));
    bindHqAction('[data-close-operation]', '正在验收…', (button) => api(`/api/operation-tasks/${button.dataset.closeOperation}/close`, { method: 'POST' }));
    document.querySelector('#operation-create-form')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const button = event.currentTarget.querySelector('[type="submit"]');
      const title = event.currentTarget.querySelector('#operation-title').value;
      const instruction = event.currentTarget.querySelector('#operation-instruction').value;
      const restore = setButtonLoading(button, '正在下发…');
      try { renderHq(await api('/api/operation-tasks', { method: 'POST', body: JSON.stringify({ title, instruction, taskType: 'custom' }) })); }
      catch (error) { alert(error.message); restore(); }
    });
    document.querySelectorAll('[data-show-operation-detail]').forEach((button) => button.addEventListener('click', () => {
      selectedOperationTaskId = button.dataset.showOperationDetail;
      const task = (latestHqState?.operationTasks || []).find((item) => item.id === selectedOperationTaskId);
      if (task) openOperationDrawer(task, latestHqState);
    }));
    document.querySelectorAll('[data-show-task-detail]').forEach((button) => button.addEventListener('click', () => {
      const detail = document.querySelector('#task-document-details');
      if (detail) detail.open = true;
      document.querySelector('#live-task-panel')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }));
  }

  function openPicker(type, stage) {
    const input = document.querySelector('#document-file');
    selectedDocumentType = type;
    input.dataset.stage = stage;
    input.dataset.documentType = type;
    input.click();
  }

  async function submitSelectedDocument() {
    const input = document.querySelector('#document-file');
    const file = input.files?.[0];
    if (!file || uploadBusy) return;
    uploadBusy = true;
    const type = input.dataset.documentType || selectedDocumentType;
    const stage = input.dataset.stage || 'initial';
    const preview = document.querySelector('#count-preview');
    const previewImage = document.querySelector('#count-image-preview');
    const button = document.querySelector('#choose-document-file');
    const restore = setButtonLoading(button, '识别中…');
    preview.textContent = `已选择：${file.name} · 正在识别${typeLabel(type)}…`;
    if (previewImage && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => { previewImage.src = reader.result; previewImage.style.display = 'block'; };
      reader.readAsDataURL(file);
    }
    setStoreMessage('OCR 识别中，正在建立单据与识别明细。', 'warning');
    try {
      const previewData = await makePreviewData(file);
      const state = await api('/api/count-documents', { method: 'POST', body: JSON.stringify({ stage, documentType: type, filename: file.name, previewData, planNo: window.activeCountPlanNo || '' }) });
      preview.textContent = `已识别并建立${typeLabel(type)}：${file.name}；可在下方“单据记录”查看详情。`;
      uploadBusy = false;
      renderStore(state);
      window.activeCountPlanNo = '';
      window.storeCountPlanReload?.();
    } catch (error) {
      uploadBusy = false;
      restore();
      setStoreMessage(`提交失败：${error.message}`, 'error');
      syncUploadControl(null);
    } finally {
      input.value = '';
    }
  }

  async function submitOperationProof() {
    const input = document.querySelector('#operation-proof-file');
    const file = input.files?.[0];
    const task = latestStoreState?.operationTask;
    if (!file || !task || operationProofBusy) return;
    operationProofBusy = true;
    const button = document.querySelector('#operation-submit-btn');
    const restore = setButtonLoading(button, '提交中…');
    setStoreMessage(`正在上传巡检凭证：${file.name}。`, 'warning');
    try {
      const previewData = await makePreviewData(file);
      const state = await api(`/api/operation-tasks/${task.id}/submit`, { method: 'POST', body: JSON.stringify({ filename: file.name, previewData }) });
      operationProofBusy = false;
      renderStore(state);
      setStoreMessage('巡检凭证已提交，总部刷新后可验收关闭。', 'success');
    } catch (error) {
      operationProofBusy = false;
      restore();
      setStoreMessage(`提交失败：${error.message}`, 'error');
    } finally {
      input.value = '';
    }
  }

  const strategyMeta = {
    hq_direct: { label: '总部直接治理', hint: '主数据、规则或阈值由总部维护，不下发门店。' },
    hq_then_store: { label: '总部研判后下发门店', hint: '总部先确认口径和影响范围，再仅向目标门店下发动作。' },
    supply_action: { label: '供应链补货 / 调拨', hint: '数据可信时优先补货或调拨，不默认要求门店盘点。' },
    store_direct: { label: '门店直接处理', hint: '门店补充实物、单据或凭证后即可推进闭环。' },
    auto_monitor: { label: '自动监控', hint: '先持续观察规则波动，不主动打扰门店。' }
  };
  const storeStrategyById = {
    'ANM-ST-001': 'hq_then_store', 'ANM-ST-002': 'hq_then_store', 'ANM-ST-003': 'store_direct', 'ANM-ST-004': 'hq_then_store',
    'ANM-ST-005': 'store_direct', 'ANM-ST-006': 'store_direct', 'ANM-ST-007': 'hq_direct', 'ANM-ST-008': 'store_direct',
    'ANM-ST-009': 'store_direct', 'ANM-ST-010': 'hq_then_store', 'ANM-ST-011': 'store_direct', 'ANM-ST-012': 'store_direct',
    'ANM-ST-013': 'auto_monitor', 'ANM-ST-014': 'store_direct', 'ANM-ST-015': 'store_direct', 'ANM-ST-016': 'hq_then_store'
  };
  const governanceConfigs = {
    'ANM-SKU-002': { button: '创建 BOM 工单', target: 'ANM-SKU-002 · Roasted Oolong Milk Tea · SKU 配方缺失', title: 'Roasted Oolong Milk Tea · BOM 维护工单', owner: '商品 / 数据治理', instruction: '补齐 Roasted Oolong Milk Tea 的 BOM、单位和物料映射，重新运行理论消耗校验，并确认受影响门店库存台账。' },
    'ANM-SKU-003': { button: '创建单位治理工单', target: 'ANM-SKU-003 · 黑糖珍珠 · 物料单位异常', title: '黑糖珍珠 · 单位换算治理工单', owner: '数据治理', instruction: '统一黑糖珍珠库存基准单位并维护 kg / g 换算规则；回算历史库存台账后，仅筛选仍存在严重偏差的门店进行复盘。' }
  };

  const seedStoreAnomalies = [
    ['ANM-ST-001','STORE004','负库存销售','high','收货未录','加盟商','黑糖冻期末 -0.5kg，但昨日销售 12 杯','盘点实际库存 + 补录入库单','pending_hq_decision'],
    ['ANM-ST-002','STORE004','负库存销售','high','收货未录','加盟商','鲜牛奶期末 -1.2L，但昨日销售 8 杯含奶款','盘点 + 报损登记','pending_hq_decision'],
    ['ANM-ST-003','STORE004','库存预警','high','订货未触发','加盟商','黑糖珍珠期末 0.3kg < 安全库存 5kg','紧急调拨（从 STORE005）','pending_store_recount'],
    ['ANM-ST-004','STORE004','消耗 vs 入库失衡','high','盘点误差','加盟商','9/10 消耗 8kg 但入库 0（连续 3 天）','核查收货是否漏录','pending_hq_decision'],
    ['ANM-ST-005','STORE004','盘点差异','high','实物盘点异常','加盟商','红茶叶盘点值较理论库存低 62%','复核盘点并上传凭证','pending_hq_decision'],
    ['ANM-ST-006','STORE002','收货单缺失','high','收货未登记','加盟商','昨日到货牛奶 30L 未发现对应收货单','补录收货单并核对数量','pending_hq_decision'],
    ['ANM-ST-007','STORE003','理论消耗异常','high','BOM 待核对','商品 / 门店','焙香乌龙奶茶销量 43 杯，但物料理论消耗未生成','核查 SKU 配方与物料映射','pending_hq_decision'],
    ['ANM-ST-008','STORE007','报损异常','high','报损登记滞后','加盟商','鲜牛奶报损率 8.2%，连续两天未录明细','补充报损原因与照片','pending_hq_decision'],
    ['ANM-ST-009','STORE008','盘点差异','high','单位录入错误','加盟商','杯子实盘 99,999 个，明显偏离销售与历史区间','重新盘点并确认单位','pending_hq_decision'],
    ['ANM-ST-010','STORE009','负库存销售','high','库存台账失真','加盟商','糖浆库存为负仍连续销售 3 天','盘点并补录收货 / 调拨','pending_hq_decision'],
    ['ANM-ST-011','STORE005','无盘点（7天）','mid','系统 / 流程缺陷','混合责任','连续 7 天无盘点记录','强制盘点 + 店长说明','closed','盘点单 PD-20260910-001 OCR 识别一致','2 小时 14 分钟'],
    ['ANM-ST-012','STORE006','无报损（7天）','mid','系统 / 流程缺陷','总部','连续 7 天无报损登记（实际应有损耗）','核查报损流程','closed','报损单 3 张 + 店长说明','4 小时 32 分钟'],
    ['ANM-ST-013','STORE001','差异说明','mid','正常波动','加盟商','盘点差异 < 5%，在正常阈值内','保留记录，无需处理','closed','盘点单与理论库存差异 < 5%','1 小时 03 分钟'],
    ['ANM-ST-014','STORE010','收货单缺失','mid','流程未执行','加盟商','连续 3 天存在入库流水但无收货确认','核对收货并补录单据','pending_hq_decision'],
    ['ANM-ST-015','STORE011','临期损耗偏高','mid','订货节奏失衡','加盟商','鲜牛奶临期报损连续两天高于阈值','调整订货建议并复核报损','pending_store_recount'],
    ['ANM-ST-016','STORE012','库存预警','mid','安全库存不足','加盟商','杯子可用库存低于安全库存 1 天用量','下发补货 / 调拨任务','pending_hq_decision']
  ].map(([id, subject, type, severity, root, owner, desc, action, status, evidence, duration], index) => ({ id, task_no: `JDG-${id}`, created_at: `2026-09-10T00:${String(30 + index).padStart(2, '0')}:00.000Z`, subject, type, severity, root, owner, desc, action, status, strategy: storeStrategyById[id] || 'store_direct', evidence: evidence || '系统规则与近 7 天库存流水', duration: duration || null, timeline: [{ title: '系统规则发现异常', time: '9/10 08:30' }, { title: status === 'closed' ? '总部完成闭环处理' : '等待运营研判或门店执行', time: '9/10 09:00' }] }));

  const seedSkuAnomalies = [
    { id: 'ANM-SKU-001', subject: '鲜牛奶', type: '跨店库存异常聚集', severity: 'high', root: '安全库存 / 收货规则待治理', owner: '供应链 / 营运', desc: 'STORE001、STORE004、STORE009 同时出现盘点差异或负库存，涉及 3 家门店。', action: '总部先核查安全库存、收货规则与单位口径；确认后再向目标门店下发核查。', status: 'pending_hq_decision', strategy: 'hq_then_store', evidence: '关联门店异常 3 条；近 7 天库存与销售流水', timeline: [{ title: '系统聚合识别跨店异常', time: '9/10 10:00' }, { title: '等待供应链与营运联合研判', time: '9/10 10:10' }] },
    { id: 'ANM-SKU-002', subject: 'Roasted Oolong Milk Tea', type: 'SKU 配方缺失', severity: 'high', root: 'BOM 主数据缺失', owner: '商品 / 数据治理', desc: 'SKU 已产生销售，但未配置可计算的 BOM；影响理论消耗与库存核算。', action: '总部补齐配方、单位与物料映射后回算，不下发门店处理。', status: 'pending_hq_governance', strategy: 'hq_direct', evidence: 'SKU 销售记录 + BOM 缺失校验', timeline: [{ title: '销售拆解任务发现无 BOM', time: '9/10 11:20' }, { title: '等待商品主档维护', time: '9/10 11:25' }] },
    { id: 'ANM-SKU-003', subject: '黑糖珍珠', type: '物料单位异常', severity: 'mid', root: '单位换算待确认', owner: '数据治理', desc: '多店库存单位混用 kg / g，导致安全库存与消耗差异不可比。', action: '统一库存单位并维护换算规则；回算后再筛选需门店复盘的门店。', status: 'pending_hq_governance', strategy: 'hq_direct', evidence: '4 家门店单位字段与历史台账对比', timeline: [{ title: '检测到跨门店单位不一致', time: '9/10 13:00' }, { title: '等待总部维护单位换算规则', time: '9/10 13:15' }] },
    { id: 'ANM-SKU-004', subject: '塑料杯', type: '耗用偏离', severity: 'mid', root: '领用 / 损耗记录不全', owner: '营运', desc: 'SKU 销量与杯子理论耗用在 3 家门店持续偏离，需判断为报损漏记还是规格替代。', action: '持续监控偏离趋势；超过阈值后再进入总部研判。', status: 'closed', strategy: 'auto_monitor', evidence: '抽查 3 家门店领用单与销售明细', duration: '5 小时 08 分钟', timeline: [{ title: '跨店耗用偏离预警', time: '9/10 14:00' }, { title: '总部抽查后关闭，进入自动监控', time: '9/10 19:08' }] },
    { id: 'ANM-SKU-005', subject: 'Brown Sugar Boba Milk Tea 400 N', type: '今日 BOM 消耗触发库存核查', severity: 'high', root: '黑糖原料滚动库存为负', owner: '加盟商', desc: 'STORE001 今日销售 12 杯；黑糖珍珠按 BOM 每杯 0.02kg，理论消耗 0.24kg。滚动期初 -2.56kg，计算后 -3.50kg，需先由门店核实实存与单据。', action: '下发门店核查：盘点黑糖珍珠、黑糖冻、半成品奶茶等实存，补充当日收货 / 报损凭证；总部验收后自动关闭。', status: 'pending_hq_decision', strategy: 'hq_then_store', evidence: '2026-09-13 销售批次 · SKU011 真实 BOM 9 项拆解 · 门店库存台账', timeline: [{ title: '销售同步完成并拆解 SKU011 BOM', time: '9/13 10:00' }, { title: '黑糖珍珠理论结存低于 0，进入总部研判', time: '9/13 10:02' }] }
  ].map((anomaly, index) => ({ ...anomaly, task_no: `JDG-${anomaly.id}`, created_at: `2026-09-10T02:${String(index * 10).padStart(2, '0')}:00.000Z` }));

  let selectedAnomalyDimension = 'store';
  let selectedAnomalyId = null;
  let activeAnomalyPage = 1;
  let closedAnomalyPage = 1;
  const anomalyPageSize = 10;
  const demoAnomalyIds = new Set(['ANM-ST-002', 'ANM-SKU-002', 'ANM-SKU-005']);
  function isDemoAnomaly() { return false; }
  function demoMark() { return ''; }
  function anomalyTaskNo(anomaly) { return anomaly.task_no || anomaly.judgment_task_no || `JDG-${anomaly.id}`; }
  function anomalyCreatedAt(anomaly) { return anomaly.created_at || anomaly.createdAt || anomaly.task?.created_at || null; }

  function dynamicInventoryAnomaly(task, state) {
    if (!task) return null;
    const evidence = state.documents.find((document) => document.id === task.document_id);
    return { id: task.id, task_no: task.judgment_task_no || `JDG-${task.id}`, created_at: task.created_at, subject: task.store_code, type: '盘点差异', severity: task.severity, root: '盘点异常', owner: '门店 / 总部', desc: `${task.material_name}：理论 ${task.theoretical_qty}${task.unit}，首次盘点 ${task.initial_qty}${task.unit}${task.recheck_qty != null ? `，复盘 ${task.recheck_qty}${task.unit}` : ''}`, action: task.status === 'pending_hq_decision' ? '总部决定：要求复盘或结束审核' : task.status === 'pending_store_recount' ? '门店单独复盘并上传凭证' : task.status === 'pending_hq_review' ? '总部复核复盘结果' : '已完成闭环', status: task.status, strategy: task.status === 'pending_hq_decision' ? 'hq_then_store' : 'store_direct', evidence: evidence ? `${evidence.original_filename} · OCR ${Math.round((evidence.ocr_confidence || 0) * 100)}%` : '盘点单识别记录', documentId: task.document_id, duration: task.closed_at ? formatDuration(task.created_at, task.closed_at) : null, dynamic: true, task, timeline: state.audits.map((audit) => ({ title: `${audit.actor_role} · ${audit.action}：${audit.detail}`, time: formatDate(audit.created_at) })) };
  }

  function governanceTaskFor(anomaly, state = latestHqState) {
    return (state?.governanceTasks || []).filter((task) => task.source_anomaly_id === anomaly.id)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0] || null;
  }

  function operationTaskFor(anomaly, state = latestHqState) {
    return (state?.operationTasks || []).filter((task) => task.source_anomaly_id === anomaly.id)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0] || null;
  }

  function hydratedStoreAnomalies(state) {
    return seedStoreAnomalies.map((anomaly) => {
      const task = operationTaskFor(anomaly, state);
      if (!task) return anomaly;
      const timeline = task.status === 'closed'
        ? [{ title: `关联门店核查任务 ${task.id} 已完成：${task.resolution || '总部已验收'}`, time: formatDate(task.closed_at) }]
        : [{ title: `已下发门店核查任务 ${task.id}，等待门店提交凭证`, time: formatDate(task.created_at) }];
      if (task.status === 'closed') return {
        ...anomaly,
        status: 'closed',
        action: '关联门店核查任务已完成，异常自动闭环。',
        evidence: `${task.id} · ${task.proof_filename || '门店核查凭证'} · ${task.resolution || '总部已验收'}`,
        duration: formatDuration(task.created_at, task.closed_at),
        operationTask: task,
        timeline: [...anomaly.timeline, ...timeline]
      };
      return {
        ...anomaly,
        status: task.status === 'pending_hq_review' ? 'pending_hq_review' : 'store_task_in_progress',
        action: task.status === 'pending_hq_review' ? '门店已提交凭证，等待总部验收。' : `门店核查任务已下发：${task.title}`,
        evidence: `关联门店任务 ${task.id} · 状态：${operationStatusText(task.status)}`,
        operationTask: task,
        timeline: [...anomaly.timeline, ...timeline]
      };
    });
  }

  function hydratedSkuAnomalies(state) {
    return seedSkuAnomalies.map((anomaly) => {
      const operationTask = operationTaskFor(anomaly, state);
      if (operationTask) {
        const taskTimeline = operationTask.status === 'closed'
          ? [{ title: `关联门店核查任务 ${operationTask.id} 已完成：${operationTask.resolution || '总部已验收'}`, time: formatDate(operationTask.closed_at) }]
          : [{ title: operationTask.status === 'pending_hq_review' ? `门店已提交 ${operationTask.id} 凭证，等待总部验收` : `已下发门店核查任务 ${operationTask.id}，等待门店提交凭证`, time: formatDate(operationTask.submitted_at || operationTask.created_at) }];
        return operationTask.status === 'closed'
          ? { ...anomaly, status: 'closed', action: '关联门店核查任务已完成，SKU 异常自动闭环。', evidence: `${operationTask.id} · ${operationTask.proof_filename || '门店核查凭证'} · ${operationTask.resolution || '总部已验收'}`, duration: formatDuration(operationTask.created_at, operationTask.closed_at), operationTask, timeline: [...anomaly.timeline, ...taskTimeline] }
          : { ...anomaly, status: operationTask.status === 'pending_hq_review' ? 'pending_hq_review' : 'store_task_in_progress', action: operationTask.status === 'pending_hq_review' ? '门店已提交凭证，等待总部验收。' : `门店核查任务已下发：${operationTask.title}`, evidence: `关联门店任务 ${operationTask.id} · 状态：${operationStatusText(operationTask.status)}`, operationTask, timeline: [...anomaly.timeline, ...taskTimeline] };
      }
      const task = governanceTaskFor(anomaly, state);
      if (!task) return anomaly;
      const taskTimeline = task.status === 'closed'
        ? [{ title: `总部治理工单已关闭：${task.resolution || '已完成治理'}`, time: formatDate(task.closed_at) }]
        : [{ title: `已创建总部治理工单 ${task.id}，等待 ${task.owner} 处理`, time: formatDate(task.created_at) }];
      return task.status === 'closed'
        ? { ...anomaly, status: 'closed', action: '总部已完成治理并安排重新校验', evidence: task.resolution || `总部治理工单 ${task.id} 已关闭`, duration: formatDuration(task.created_at, task.closed_at), governanceTask: task, timeline: [...anomaly.timeline, ...taskTimeline] }
        : { ...anomaly, status: 'hq_governance_in_progress', action: `总部治理中：${task.title}`, evidence: `关联治理工单 ${task.id} · 责任方：${task.owner}`, governanceTask: task, timeline: [...anomaly.timeline, ...taskTimeline] };
    });
  }

  function materialInventoryAnomalies(state) {
    const ruleMeta = {
      BASELINE_INVALID: { type: '台账期初异常', root: '期初 / 历史台账未校准', action: '总部先核对首日实盘、收货与历史期末；基线有效后重新回算，不下发门店。' },
      NEGATIVE_THEORETICAL: { type: '理论库存为负', root: '库存与消耗待研判', action: '总部先核对 BOM、单位、期初和收货；数据可信后再决定是否下发门店盘点核查。' },
      BELOW_SAFETY_STOCK: { type: '低于安全库存', root: '补货 / 调拨风险', action: '优先创建补货或调拨动作；不默认要求门店盘点。' }
    };
    return (state.materialAnomalies || []).map((item) => {
      const meta = ruleMeta[item.rule_code] || { type: '物料库存异常', root: '库存规则触发', action: '总部研判后处理。' };
      const operationTask = operationTaskFor(item, state);
      const closed = ['closed', 'auto_closed'].includes(item.status);
      const timeline = [{ title: '物料库存回算完成', time: formatDate(item.created_at) }];
      if (operationTask) timeline.push({ title: operationTask.status === 'closed' ? `关联执行任务 ${operationTask.id} 已完成并验收` : operationTask.status === 'pending_hq_review' ? `门店已提交 ${operationTask.id}，等待总部验收` : `已下发执行任务 ${operationTask.id}，等待门店处理`, time: formatDate(operationTask.closed_at || operationTask.submitted_at || operationTask.created_at) });
      if (closed || operationTask?.status === 'closed') return {
        id: item.id, task_no: item.judgment_task_no || `JDG-${item.id}`, created_at: item.created_at, store_code: item.store_code, subject: item.material_name, type: meta.type, severity: item.severity, root: meta.root, owner: item.owner,
        desc: `${item.store_code || '未标注门店'} · ${item.business_date} · 理论期末 ${item.theoretical_closing_qty}${item.unit}${item.safety_qty != null ? `；安全库存 ${item.safety_qty}${item.unit}` : ''}。`, action: item.closure_reason || '关联执行任务已验收，研判完成闭环。', status: 'closed', strategy: item.strategy, evidence: item.evidence, duration: '已完成闭环', materialInventory: true, operationTask, timeline
      };
      const flowing = operationTask ? {
        status: operationTask.status === 'pending_hq_review' ? 'pending_hq_review' : 'store_task_in_progress',
        action: operationTask.status === 'pending_hq_review' ? `门店已提交 ${operationTask.id}，等待总部验收。` : `关联执行任务 ${operationTask.id} 已下发，等待门店处理。`,
        evidence: `关联执行任务 ${operationTask.id} · 状态：${operationStatusText(operationTask.status)}`
      } : {};
      return {
        id: item.id, task_no: item.judgment_task_no || `JDG-${item.id}`, created_at: item.created_at, store_code: item.store_code, subject: item.material_name, type: meta.type, severity: item.severity, root: meta.root, owner: item.owner,
        desc: `${item.store_code || '未标注门店'} · ${item.business_date} · 理论期末 ${item.theoretical_closing_qty}${item.unit}${item.safety_qty != null ? `；安全库存 ${item.safety_qty}${item.unit}` : ''}。`,
        action: flowing.action || meta.action,
        status: flowing.status || item.status, strategy: item.strategy, evidence: flowing.evidence || item.evidence,
        duration: null, materialInventory: true, operationTask,
        timeline: [...timeline, { title: '已进入异常研判任务', time: formatDate(item.updated_at) }]
      };
    });
  }

  function currentAnomalies(state) {
    const applyManualClosures = (items) => items.map((anomaly) => {
      const closure = (state.anomalyClosures || []).find((item) => item.anomaly_id === anomaly.id);
      if (!closure) return anomaly;
      return { ...anomaly, status: 'closed', action: '总部结束研判：该条异常按规则误判或已知口径差异关闭。', evidence: closure.closure_reason, duration: formatDuration(closure.closed_at, closure.closed_at), manualClosure: closure, timeline: [...anomaly.timeline, { title: `总部结束研判：${closure.closure_reason}`, time: formatDate(closure.closed_at) }] };
    });
    if (selectedAnomalyDimension === 'sku') return applyManualClosures(materialInventoryAnomalies(state));
    const dynamic = dynamicInventoryAnomaly(state.task, state);
    const material = materialInventoryAnomalies(state);
    return applyManualClosures(dynamic ? [dynamic, ...material] : material);
  }

  function anomalyStatus(anomaly) { return anomaly.status === 'closed' ? '已闭环' : anomaly.status === 'pending_hq_governance' ? '待总部治理' : anomaly.status === 'hq_governance_in_progress' ? '总部治理中' : anomaly.status === 'pending_supply_action' ? '待供应处理' : anomaly.status === 'store_task_in_progress' ? '已下发门店' : anomaly.status === 'pending_hq_decision' || anomaly.status === 'pending_hq_review' ? '待总部处理' : anomaly.status === 'pending_store_recount' ? '待门店处理' : '处理中'; }
  function anomalyStatusClass(anomaly) { return anomaly.status === 'closed' ? 'closed' : anomaly.status === 'store_task_in_progress' || anomaly.status === 'pending_store_recount' ? 'assigned' : 'pending'; }

  function relatedOperationTask(anomaly, state = latestHqState) {
    return (state?.operationTasks || []).find((task) => task.source_anomaly_id === anomaly.id && task.status !== 'closed');
  }

  function relatedGovernanceTask(anomaly, state = latestHqState) {
    return (state?.governanceTasks || []).find((task) => task.source_anomaly_id === anomaly.id && task.status !== 'closed');
  }

  function anomalyAction(anomaly, state = latestHqState) {
    if (anomaly.materialInventory) {
      const task = anomaly.operationTask || operationTaskFor(anomaly, state);
      if (task) return `${task.status === 'pending_hq_review' ? `<button class="btn btn-primary" data-close-operation="${task.id}">验收并关闭</button>` : ''}<button class="btn" data-show-operation-detail="${task.id}">${task.status === 'closed' ? '查看闭环任务' : '查看关联任务'}</button>${demoMark(anomaly)}`;
      const supply = anomaly.strategy === 'supply_action';
      return `<button class="btn btn-primary" data-create-material-action="${anomaly.id}" data-material-store="${anomaly.store_code || 'STORE001'}" data-material-type="${supply ? 'supply_replenishment' : 'material_inventory_check'}" data-material-title="${esc(supply ? `${anomaly.subject}补货 / 调拨确认` : `${anomaly.subject}库存核查`)}" data-material-instruction="${esc(supply ? `请确认${anomaly.subject}当前可用库存，并完成补货或调拨入库登记；完成后上传收货或调拨凭证。` : `请盘点${anomaly.subject}实际库存，核对当日销售、收货、报损与调拨记录；上传盘点或相关凭证后提交。`)}">${supply ? '下发补货 / 调拨确认' : '下发门店核查'}</button>${demoMark(anomaly)}`;
    }
    if (anomaly.id === 'ANM-ST-002' || anomaly.id === 'ANM-SKU-005') {
      const task = anomaly.operationTask || operationTaskFor(anomaly, state);
      return task
        ? `${task.status === 'pending_hq_review' ? `<button class="btn btn-primary" data-close-operation="${task.id}">验收并关闭</button>` : ''}<button class="btn" data-show-operation-detail="${task.id}">${task.status === 'closed' ? '查看闭环任务' : '查看关联任务'}</button>${demoMark(anomaly)}`
        : `<button class="btn btn-primary" data-create-store-action="${anomaly.id}">下发核查任务</button>${demoMark(anomaly)}`;
    }
    if (anomaly.strategy === 'hq_direct' && governanceConfigs[anomaly.id]) {
      const task = anomaly.governanceTask || governanceTaskFor(anomaly, state);
      return task
        ? `<button class="btn" data-open-governance-detail="${task.id}">${task.status === 'closed' ? '查看治理结论' : '治理工单处理中'}</button>${demoMark(anomaly)}`
        : `<button class="btn btn-primary" data-open-governance-create="${anomaly.id}">${governanceConfigs[anomaly.id].button}</button>${demoMark(anomaly)}`;
    }
    if (!anomaly.dynamic) {
      if (anomaly.strategy === 'store_direct') return '<button class="btn" disabled>下发门店处理</button>';
      if (anomaly.strategy === 'hq_then_store') return '<button class="btn" disabled>研判后下发</button>';
      if (anomaly.strategy === 'supply_action') return '<button class="btn" disabled>补货 / 调拨</button>';
      if (anomaly.strategy === 'auto_monitor') return '<button class="btn" disabled>持续监控</button>';
      return '<button class="btn" disabled>总部治理</button>';
    }
    if (anomaly.status === 'pending_hq_decision') return `<button class="btn btn-primary" data-request-recount="${anomaly.id}">要求复盘</button><button class="btn" data-end-audit="${anomaly.id}">结束审核</button>${demoMark(anomaly)}`;
    if (anomaly.status === 'pending_hq_review') return `<button class="btn btn-primary" data-close-task="${anomaly.id}">复核关闭</button>${demoMark(anomaly)}`;
    return '';
  }

  function openAnomalyDrawer(anomaly, state) {
    selectedAnomalyId = anomaly.id;
    const traceFields = [['研判任务编号', anomalyTaskNo(anomaly)], ['异常编号', anomaly.id], ['创建日期', formatDate(anomalyCreatedAt(anomaly))]];
    const fields = selectedAnomalyDimension === 'sku'
      ? [['诊断主体', anomaly.subject], ['影响范围', anomaly.desc.match(/\d 家门店|多店|跨店/)?.[0] || 'SKU / 物料维度'], ['责任方', anomaly.owner], ...traceFields]
      : [['门店', anomaly.materialInventory ? (anomaly.store_code || '未标注门店') : anomaly.subject], ['研判主体', anomaly.materialInventory ? anomaly.subject : '门店库存'], ['责任方', anomaly.owner], ['根因研判', anomaly.root], ...traceFields];
    if (anomaly.operationTask) fields.splice(3, 0, ['关联门店任务', anomaly.operationTask.id]);
    document.querySelector('#anomaly-drawer-content').innerHTML = `<div class="drawer-head"><div><div class="live-eyebrow">${selectedAnomalyDimension === 'sku' ? 'SKU / 物料异常详情' : '门店异常详情'} · ${anomalyStatus(anomaly)}</div><h2 id="drawer-title">${esc(anomaly.subject)} · ${esc(anomaly.type)}</h2></div><button class="drawer-close" data-close-drawer aria-label="关闭详情">×</button></div>
      <div class="drawer-block"><div class="drawer-grid">${fields.map(([label, value]) => `<div class="drawer-field"><span>${label}</span>${esc(value)}</div>`).join('')}<div class="drawer-field"><span>处理策略</span>${esc(strategyMeta[anomaly.strategy || 'store_direct'].label)}</div><div class="drawer-field"><span>严重程度</span><span class="severity-tag ${anomaly.severity}">${anomaly.severity === 'high' ? '高' : '中'}</span></div><div class="drawer-field"><span>当前状态</span><span class="status-tag ${anomalyStatusClass(anomaly)}">${anomalyStatus(anomaly)}</span></div></div></div>
      <div class="drawer-block"><h3>异常描述</h3><p style="font-size:14px;color:#4e5969;line-height:1.7">${esc(anomaly.desc)}</p></div>
      <div class="drawer-block"><h3>建议动作</h3><p style="font-size:14px;color:#4e5969;line-height:1.7">${esc(anomaly.action)}</p></div>
      <div class="drawer-block"><h3>凭证与判定依据</h3><p style="font-size:14px;color:#4e5969;line-height:1.7">${esc(anomaly.evidence)}</p>${anomaly.documentId ? `<div class="live-task-actions" style="margin-top:10px"><button class="btn" data-open-document="${anomaly.documentId}">查看门店盘点单</button></div>` : ''}</div>
      <div class="drawer-block"><h3>处理时间线</h3><div class="timeline">${anomaly.timeline.map((item) => `<div class="timeline-item"><b>${esc(item.title)}</b><br><span style="color:#8f959e;font-size:12px">${esc(item.time)}</span></div>`).join('')}</div></div>
      ${anomaly.status === 'closed' ? `<div class="drawer-block"><h3>闭环结果</h3><p style="color:#2a9d3f">已完成闭环 · ${esc(anomaly.duration || '已记录闭环凭证')}</p>${anomaly.operationTask ? `<div class="live-task-actions" style="margin-top:10px"><button class="btn" data-show-operation-detail="${anomaly.operationTask.id}">查看关联任务</button></div>` : ''}</div>` : `<div class="drawer-block"><div class="live-task-actions">${anomalyAction(anomaly, state) || '<span style="font-size:13px;color:#8f959e">该异常正在由责任方处理中。</span>'}<select class="btn" data-close-reason aria-label="结束研判原因"><option>已通知门店，等待执行或回传</option><option>消息 / 数据同步延迟，暂不重复处理</option><option>相关处理已完成，等待系统回算</option><option>经核对为规则误判或已知口径差异</option></select><button class="btn" data-close-anomaly="${anomaly.id}">结束研判</button></div><p style="margin:10px 0 0;color:#8f959e;font-size:12px">关闭原因会写入审计记录；后续飞书同步不会重新打开人工关闭的研判。</p></div>`}`;
    const drawer = document.querySelector('#anomaly-drawer'); drawer.classList.add('open'); drawer.setAttribute('aria-hidden', 'false');
    drawer.querySelector('[data-close-drawer]').addEventListener('click', closeAnomalyDrawer);
    drawer.querySelectorAll('[data-request-recount]').forEach((button) => button.addEventListener('click', () => runHqTaskAction(button, '正在指派…', `/api/tasks/${button.dataset.requestRecount}/request-recount`)));
    drawer.querySelectorAll('[data-end-audit]').forEach((button) => button.addEventListener('click', () => runHqTaskAction(button, '正在结束…', `/api/tasks/${button.dataset.endAudit}/end-audit`)));
    drawer.querySelectorAll('[data-close-task]').forEach((button) => button.addEventListener('click', () => runHqTaskAction(button, '正在关闭…', `/api/tasks/${button.dataset.closeTask}/close`)));
    drawer.querySelectorAll('[data-open-document]').forEach((button) => button.onclick = () => { const document = state.documents.find((item) => item.id === button.dataset.openDocument); if (document) openDocumentDrawer(document); });
    drawer.querySelectorAll('[data-close-anomaly]').forEach((button) => button.onclick = async () => {
      const restore = setButtonLoading(button, '正在关闭…');
      try { const reason = drawer.querySelector('[data-close-reason]')?.value; const next = await api(`/api/anomalies/${button.dataset.closeAnomaly}/close`, { method: 'POST', body: JSON.stringify({ reason }) }); closeAnomalyDrawer(); renderHq(next); }
      catch (error) { alert(error.message); restore(); }
    });
    bindActionableAnomalyButtons(drawer);
  }

  function closeAnomalyDrawer() { const drawer = document.querySelector('#anomaly-drawer'); drawer.classList.remove('open'); drawer.setAttribute('aria-hidden', 'true'); }

  async function runHqTaskAction(button, label, path) {
    const restore = setButtonLoading(button, label);
    try { const state = await api(path, { method: 'POST' }); closeAnomalyDrawer(); renderHq(state); }
    catch (error) { alert(error.message); restore(); }
  }

  function renderOperationTasks(state) {
    const tasks = state.operationTasks || [];
    const group = (task) => task.status === 'closed' ? 'closed' : task.status === 'pending_hq_review' ? 'hq' : task.status === 'pending_store_submission' ? 'store' : 'pending';
    const labels = { all: '全部', pending: '待处理', store: '门店处理中', hq: '待总部确认', closed: '已闭环' };
    const counts = Object.fromEntries(Object.keys(labels).map((key) => [key, key === 'all' ? tasks.length : tasks.filter((task) => group(task) === key).length]));
    const visible = tasks.filter((task) => selectedOperationStatus === 'all' || group(task) === selectedOperationStatus);
    const metrics = `<div class="operation-metrics"><div class="operation-metric"><span>待处理</span><b class="warn">${counts.pending}</b></div><div class="operation-metric"><span>门店处理中</span><b class="warn">${counts.store}</b></div><div class="operation-metric"><span>待总部确认</span><b class="warn">${counts.hq}</b></div><div class="operation-metric"><span>已闭环</span><b class="success">${counts.closed}</b></div></div>`;
    const filters = `<div class="dimension-tabs" aria-label="工单状态筛选">${Object.entries(labels).map(([key, label]) => `<button class="dimension-tab ${selectedOperationStatus === key ? 'active' : ''}" data-operation-filter="${key}">${label} ${counts[key]}</button>`).join('')}</div>`;
    const table = visible.length ? `<div class="operation-list"><table><thead><tr><th>任务编号</th><th>任务名称</th><th>门店</th><th>状态</th><th>下发时间</th><th>操作</th></tr></thead><tbody>${visible.map((task) => `<tr><td>${esc(task.id)}</td><td>${esc(task.title)}</td><td>${esc(task.store_code || 'STORE001')}</td><td><span class="status-tag ${task.status === 'closed' ? 'closed' : task.status === 'pending_hq_review' ? 'assigned' : 'pending'}">${labels[group(task)]}</span></td><td>${formatDate(task.created_at)}</td><td><div class="btn-row">${operationTaskAction(task)}<a class="btn" href="/work-order/?id=${encodeURIComponent(task.id)}">查看详情</a></div></td></tr>`).join('')}</tbody></table></div>` : `<div class="operation-empty">${tasks.length ? `当前没有“${labels[selectedOperationStatus]}”状态的工单。` : '暂无跟进工单。库存或销售复盘建立工单后，会在这里统一跟踪。'}</div>`;
    document.querySelector('#operation-task-panel').innerHTML = `<div class="operation-workspace">${metrics}${filters}${table}</div>`;
  }

  function operationTypeText(type) {
    return ({ custom:'主动运营任务', diagnosis_negative_inventory:'负库存核查', diagnosis_count_variance:'盘点差异复核', diagnosis_safety_stock:'安全库存跟进', diagnosis_sell_in_ratio:'销入比核查', receipt_evidence:'收货凭证核查', sku_inventory_check:'SKU 库存核查', inventory_receipt_check:'收货与库存核查', qa_regression:'测试工单' }[type] || '跟进工单');
  }

  function operationTimeline(task, state) {
    const events = [{ title:'工单已创建', detail:task.instruction, actor:'', time:task.created_at, order:0 }];
    (state.audits || []).filter((item) => item.task_id === task.id).forEach((item) => events.push({ title:item.action, detail:item.detail, actor:item.actor_role || '', time:item.created_at, order:1 }));
    if (task.submitted_at && !events.some((item) => item.time === task.submitted_at)) events.push({ title:'门店已提交处理凭证', detail:task.proof_filename || '凭证已归档', actor:'', time:task.submitted_at, order:2 });
    if (task.closed_at && !events.some((item) => item.time === task.closed_at)) events.push({ title:'工单已闭环', detail:task.resolution || '处理完成', actor:'', time:task.closed_at, order:3 });
    return events.sort((a, b) => new Date(a.time || 0) - new Date(b.time || 0) || a.order - b.order);
  }

  function closeOperationDrawer() {
    const drawer = document.querySelector('#operation-drawer');
    drawer?.classList.remove('open'); drawer?.setAttribute('aria-hidden', 'true');
  }

  function openOperationDrawer(task, state) {
    if (!task) return;
    selectedOperationTaskId = task.id;
    const group = task.status === 'closed' ? '已闭环' : task.status === 'pending_hq_review' ? '待总部确认' : task.status === 'pending_store_submission' ? '门店处理中' : '待处理';
    const anomaly = (state.materialAnomalies || []).find((item) => item.id === task.source_anomaly_id);
    const linkedDocuments = (task.linked_document_ids || []).map((id) => (state.documents || []).find((item) => item.id === id)).filter(Boolean);
    const linkedEvents = (task.linked_event_ids || []).map((id) => (state.materialEvents || []).find((item) => item.id === id)).filter(Boolean);
    const timeline = operationTimeline(task, state);
    const material = anomaly?.material_name || task.material_names?.[0] || '';
    const sourceDetail = anomaly
      ? `<b>当前判断来源：规则引擎 · ${esc(task.source_rule_code || anomaly.rule_code || '未标注规则')}</b>${esc(anomaly.material_name || '')}${anomaly.unit ? `（${esc(anomaly.unit)}）` : ''} · ${esc(anomaly.primary_location?.title || anomaly.primary_attribution || '待验证位置')}<br>关联研判：${esc(anomaly.judgment_task_no || anomaly.id)}`
      : `<b>当前判断来源：人工创建</b>暂未关联库存研判。后续 LLM 建议会作为独立时间线记录追加，不覆盖原始工单与人工处理记录。`;
    const documentButtons = linkedDocuments.length
      ? linkedDocuments.map((item) => `<button class="btn" data-open-operation-document="${esc(item.id)}">${esc(item.original_filename || item.id)}</button>`).join('')
      : '<span style="color:#8f959e;font-size:13px">暂无关联单据</span>';
    const eventList = linkedEvents.length ? `<ul class="document-detail-lines">${linkedEvents.map((item) => `<li>${esc(item.document_no || item.id)} · ${esc(item.material_name)} ${esc(item.qty)}${esc(item.unit)}</li>`).join('')}</ul>` : '';
    document.querySelector('#operation-drawer-content').innerHTML = `<div class="drawer-head"><div><div class="live-eyebrow">跟进工单 · ${group}</div><h2 id="operation-drawer-title">${esc(task.title)}</h2></div><button class="drawer-close" data-close-operation-drawer aria-label="关闭工单详情">×</button></div>
      <div class="drawer-block"><div class="drawer-grid"><div class="drawer-field"><span>工单编号</span>${esc(task.id)}</div><div class="drawer-field"><span>当前状态</span><span class="status-tag ${task.status === 'closed' ? 'closed' : task.status === 'pending_hq_review' ? 'assigned' : 'pending'}">${group}</span></div><div class="drawer-field"><span>工单类型</span>${esc(operationTypeText(task.task_type))}</div><div class="drawer-field"><span>门店 / 主体</span>${esc(task.store_code || '—')}</div><div class="drawer-field"><span>责任角色</span>${esc(task.assigned_to || '—')}</div><div class="drawer-field"><span>当前操作人</span>${esc(task.last_operator || '—')}</div><div class="drawer-field"><span>创建时间</span>${esc(formatDate(task.created_at))}</div><div class="drawer-field"><span>最近更新</span>${esc(formatDate(task.updated_at || task.submitted_at || task.created_at))}</div></div></div>
      <div class="drawer-block"><h3>任务详情</h3><p style="font-size:14px;color:#4e5969;line-height:1.7">${esc(task.instruction)}</p></div>
      <div class="drawer-block"><h3>来源与判断记录</h3><div class="work-order-source">${sourceDetail}</div></div>
      <div class="drawer-block"><h3>关联单据与业务记录</h3><div class="btn-row">${documentButtons}</div>${eventList}</div>
      <div class="drawer-block"><h3>处理时间线</h3><div class="timeline">${timeline.map((item) => `<div class="timeline-item"><b>${esc(item.title)}</b>${item.detail ? `<p>${esc(item.detail)}</p>` : ''}<div class="timeline-meta"><span>${esc(formatDate(item.time))}</span><span>操作人：${esc(item.actor || '—')}</span></div></div>`).join('')}</div></div>
      ${task.resolution ? `<div class="drawer-block"><h3>闭环结论</h3><div class="work-order-source"><b>处理完成</b>${esc(task.resolution)}</div></div>` : ''}
      <div class="drawer-block"><h3>新增处理记录</h3><form class="work-order-note-form" data-operation-note="${esc(task.id)}"><label>操作人（可不填）<input name="operator" maxlength="80" placeholder="—"></label><label>处理记录<textarea name="note" maxlength="500" required placeholder="记录已核对事项、待办或判断依据"></textarea></label><button class="btn btn-primary" type="submit">添加记录</button></form></div>
      <div class="drawer-block"><h3>工单操作</h3><div class="live-task-actions">${operationTaskAction(task)}${task.proof_filename ? `<button class="btn" data-open-operation-proof="${esc(task.id)}">查看门店凭证</button>` : ''}<a class="btn" href="/flows/?store=${encodeURIComponent(task.store_code || '')}${material ? `&material=${encodeURIComponent(material)}` : ''}">查看库存流水</a><a class="btn" href="/count-plans/?source=work_order&work_order=${encodeURIComponent(task.id)}">下发关联盘点</a></div></div>`;
    const drawer = document.querySelector('#operation-drawer'); drawer.classList.add('open'); drawer.setAttribute('aria-hidden', 'false');
    drawer.querySelector('[data-close-operation-drawer]').onclick = closeOperationDrawer;
    drawer.querySelectorAll('[data-open-operation-document]').forEach((button) => button.onclick = () => { const item = (state.documents || []).find((document) => document.id === button.dataset.openOperationDocument); if (item) openDocumentDrawer(item); });
    drawer.querySelectorAll('[data-open-operation-proof]').forEach((button) => button.onclick = () => openOperationProofDrawer(task, state));
    drawer.querySelectorAll('[data-close-operation]').forEach((button) => button.onclick = async () => { const restore = setButtonLoading(button, '正在验收…'); try { const next = await api(`/api/operation-tasks/${task.id}/close`, { method:'POST' }); renderHq(next); openOperationDrawer((next.operationTasks || []).find((item) => item.id === task.id), next); } catch (error) { alert(error.message); restore(); } });
    drawer.querySelector('[data-operation-note]')?.addEventListener('submit', async (event) => { event.preventDefault(); const button = event.currentTarget.querySelector('[type="submit"]'); const restore = setButtonLoading(button, '正在保存…'); try { const next = await api(`/api/operation-tasks/${task.id}/notes`, { method:'POST', body:JSON.stringify({ operator:event.currentTarget.operator.value, note:event.currentTarget.note.value }) }); renderHq(next); openOperationDrawer((next.operationTasks || []).find((item) => item.id === task.id), next); } catch (error) { alert(error.message); restore(); } });
  }

  function governanceStatusText(status) { return status === 'closed' ? '已完成' : '待总部治理'; }

  function openGovernanceDrawer(task) {
    document.querySelector('#governance-drawer-content').innerHTML = `<div class="drawer-head"><div><div class="live-eyebrow">总部治理工单 · ${governanceStatusText(task.status)}</div><h2 id="governance-drawer-title">${esc(task.title)}</h2></div><button class="drawer-close" data-close-governance-drawer aria-label="关闭详情">×</button></div>
      <div class="drawer-block"><div class="drawer-grid"><div class="drawer-field"><span>工单编号</span>${esc(task.id)}</div><div class="drawer-field"><span>关联异常</span>${esc(task.source_anomaly_id || '—')}</div><div class="drawer-field"><span>责任方</span>${esc(task.owner)}</div><div class="drawer-field"><span>当前状态</span><span class="status-tag ${task.status === 'closed' ? 'closed' : 'pending'}">${governanceStatusText(task.status)}</span></div><div class="drawer-field"><span>创建时间</span>${esc(formatDate(task.created_at))}</div>${task.closed_at ? `<div class="drawer-field"><span>闭环时长</span>${esc(formatDuration(task.created_at, task.closed_at))}</div>` : ''}</div></div>
      <div class="drawer-block"><h3>治理要求</h3><p style="font-size:14px;color:#4e5969;line-height:1.7">${esc(task.instruction)}</p></div>
      ${task.resolution ? `<div class="drawer-block"><h3>治理结论</h3><p style="font-size:14px;color:#2a9d3f;line-height:1.7">${esc(task.resolution)}</p></div>` : ''}
      <div class="drawer-block"><div class="live-task-actions">${task.status === 'pending' ? `<button class="btn btn-primary" data-close-governance="${task.id}">完成治理并关闭</button>` : '<button class="btn" disabled>已完成</button>'}</div></div>`;
    const drawer = document.querySelector('#governance-drawer'); drawer.classList.add('open'); drawer.setAttribute('aria-hidden', 'false');
    drawer.querySelector('[data-close-governance-drawer]').onclick = () => { drawer.classList.remove('open'); drawer.setAttribute('aria-hidden', 'true'); };
    drawer.querySelectorAll('[data-close-governance]').forEach((button) => button.onclick = async () => {
      const restore = setButtonLoading(button, '正在关闭…');
      try { const state = await api(`/api/governance-tasks/${button.dataset.closeGovernance}/close`, { method: 'POST' }); drawer.classList.remove('open'); drawer.setAttribute('aria-hidden', 'true'); renderHq(state); }
      catch (error) { alert(error.message); restore(); }
    });
  }

  function renderGovernanceTasks(state) {
    const tasks = state.governanceTasks || [];
    const selected = tasks.find((task) => task.id === selectedGovernanceTaskId) || tasks[0];
    const pending = tasks.filter((task) => task.status === 'pending').length;
    const closed = tasks.filter((task) => task.status === 'closed').length;
    document.querySelector('#governance-summary-copy').textContent = `待处理 ${pending} 项 · 已完成 ${closed} 项`;
    const content = tasks.length ? `<div class="operation-workspace"><div class="operation-detail" id="governance-detail-panel"><div class="live-eyebrow">工单摘要 · ${governanceStatusText(selected.status)}</div><h3>${esc(selected.title)}</h3><p>${esc(selected.instruction)}</p><p style="margin-top:7px">责任方：${esc(selected.owner)} · 创建时间：${formatDate(selected.created_at)}${selected.resolution ? `<br><span style="color:#2a9d3f">${esc(selected.resolution)} · ${formatDuration(selected.created_at, selected.closed_at)}</span>` : ''}</p><div class="live-task-actions" style="margin-top:10px">${selected.status === 'pending' ? `<button class="btn btn-primary" data-close-governance="${selected.id}">完成治理并关闭</button>` : '<button class="btn" disabled>已完成</button>'}<button class="btn" data-open-governance-detail="${selected.id}">查看详情</button></div></div><div class="operation-list"><table><thead><tr><th>操作</th><th>工单编号</th><th>治理事项</th><th>责任方</th><th>状态</th><th>创建时间</th></tr></thead><tbody>${tasks.map((task) => `<tr><td><div class="btn-row">${task.status === 'pending' ? `<button class="btn btn-primary" data-close-governance="${task.id}">完成治理</button>` : ''}<button class="btn" data-open-governance-detail="${task.id}">查看详情</button></div></td><td>${esc(task.id)}</td><td>${esc(task.title)}</td><td>${esc(task.owner)}</td><td><span class="status-tag ${task.status === 'closed' ? 'closed' : 'pending'}">${governanceStatusText(task.status)}</span></td><td>${formatDate(task.created_at)}</td></tr>`).join('')}</tbody></table></div></div>` : '<div class="operation-empty">暂无总部治理工单。SKU / 物料异常中的“创建 BOM 工单”会在这里生成可追踪的治理闭环。</div>';
    document.querySelector('#governance-task-panel').innerHTML = content;
  }

  function renderAnomalyWorkspace(state) {
    const all = currentAnomalies(state).sort((a, b) => new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0)); const active = all.filter((item) => item.status !== 'closed'); const closed = all.filter((item) => item.status === 'closed');
    const activePages = Math.max(1, Math.ceil(active.length / anomalyPageSize)); const closedPages = Math.max(1, Math.ceil(closed.length / anomalyPageSize));
    activeAnomalyPage = Math.min(activeAnomalyPage, activePages); closedAnomalyPage = Math.min(closedAnomalyPage, closedPages);
    const activePageItems = active.slice((activeAnomalyPage - 1) * anomalyPageSize, activeAnomalyPage * anomalyPageSize);
    const closedPageItems = closed.slice((closedAnomalyPage - 1) * anomalyPageSize, closedAnomalyPage * anomalyPageSize);
    const pager = (page, pages, total, kind) => total <= anomalyPageSize ? '' : `<span>第 ${page} / ${pages} 页 · 共 ${total} 条</span><button class="btn" data-anomaly-page="${kind}" data-page="${page - 1}" ${page === 1 ? 'disabled' : ''}>上一页</button><button class="btn" data-anomaly-page="${kind}" data-page="${page + 1}" ${page === pages ? 'disabled' : ''}>下一页</button>`;
    const high = all.filter((item) => item.severity === 'high').length; const mid = all.filter((item) => item.severity === 'mid').length;
    document.querySelector('#kpi-new-count').textContent = all.length; document.querySelector('#kpi-new-sub').textContent = `高 ${high} / 中 ${mid}`;
    document.querySelector('#kpi-open-count').textContent = active.length; document.querySelector('#kpi-closed-count').textContent = closed.length;
    document.querySelector('#kpi-rate').textContent = `${all.length ? Math.round(closed.length / all.length * 100) : 0}%`; document.querySelector('#kpi-rate-sub').textContent = `${closed.length} / ${all.length}`;
    document.querySelector('#anomaly-active-copy').textContent = `${selectedAnomalyDimension === 'sku' ? 'SKU / 物料' : '门店'}异常 · 待研判与处理中`;
    document.querySelector('#anomaly-summary-copy').textContent = `共 ${all.length} 条 · 处理中 ${active.length} 条`;
    document.querySelectorAll('[data-anomaly-tab]').forEach((button) => button.classList.toggle('active', button.dataset.anomalyTab === selectedAnomalyDimension));
    document.querySelector('#anomaly-active-rows').innerHTML = activePageItems.map((item) => `<tr class="${isDemoAnomaly(item) ? 'demo-row' : ''}"><td>${isDemoAnomaly(item) ? '<span class="demo-float">DEMO</span>' : ''}<div class="btn-row">${anomalyAction(item, state)}<button class="btn" data-open-anomaly="${item.id}">查看详情</button></div></td><td><b>${esc(anomalyTaskNo(item))}</b><br><span style="color:#8f959e;font-size:12px">${esc(item.id)}</span></td><td>${esc(formatDate(anomalyCreatedAt(item)))}</td><td>${esc(item.subject)}</td><td>${esc(item.type)}</td><td><span class="severity-tag ${item.severity}">${item.severity === 'high' ? '高' : '中'}</span></td><td><span class="strategy-tag">${esc(strategyMeta[item.strategy || 'store_direct'].label)}</span></td><td><span class="root-cause">${esc(item.root)}</span></td><td><span class="responsible">${esc(item.owner)}</span></td><td class="desc-cell">${esc(item.desc)}</td><td class="action-cell">${esc(item.action)}</td><td><span class="status-tag ${anomalyStatusClass(item)}">${anomalyStatus(item)}</span></td></tr>`).join('') || '<tr><td colspan="12" class="operation-empty">当前没有待处理异常。</td></tr>';
    document.querySelector('#anomaly-closed-rows').innerHTML = closedPageItems.map((item) => `<tr><td><b>${esc(anomalyTaskNo(item))}</b><br><span style="color:#8f959e;font-size:12px">${esc(item.id)}</span></td><td>${esc(formatDate(anomalyCreatedAt(item)))}</td><td>${esc(item.subject)}</td><td>${esc(item.type)}</td><td><span class="severity-tag ${item.severity}">${item.severity === 'high' ? '高' : '中'}</span></td><td>${esc(item.evidence)}</td><td>${esc(item.duration || '已闭环')}</td><td><button class="btn" data-open-anomaly="${item.id}">查看详情</button></td></tr>`).join('') || '<tr><td colspan="8" class="operation-empty">当前维度暂无已闭环案例。</td></tr>';
    document.querySelector('#anomaly-active-pager').innerHTML = pager(activeAnomalyPage, activePages, active.length, 'active');
    document.querySelector('#anomaly-closed-pager').innerHTML = pager(closedAnomalyPage, closedPages, closed.length, 'closed');
    document.querySelectorAll('[data-anomaly-tab]').forEach((button) => button.onclick = () => { selectedAnomalyDimension = button.dataset.anomalyTab; activeAnomalyPage = 1; closedAnomalyPage = 1; renderHq(latestHqState); });
    document.querySelectorAll('[data-anomaly-page]').forEach((button) => button.onclick = () => { if (button.dataset.anomalyPage === 'active') activeAnomalyPage = Number(button.dataset.page); else closedAnomalyPage = Number(button.dataset.page); renderHq(latestHqState); });
    document.querySelectorAll('[data-open-anomaly]').forEach((button) => button.onclick = () => { const anomaly = all.find((item) => item.id === button.dataset.openAnomaly); if (anomaly) openAnomalyDrawer(anomaly, state); });
    document.querySelectorAll('[data-request-recount]').forEach((button) => button.onclick = () => runHqTaskAction(button, '正在指派…', `/api/tasks/${button.dataset.requestRecount}/request-recount`));
    document.querySelectorAll('[data-end-audit]').forEach((button) => button.onclick = () => runHqTaskAction(button, '正在结束…', `/api/tasks/${button.dataset.endAudit}/end-audit`));
    document.querySelectorAll('[data-close-task]').forEach((button) => button.onclick = () => runHqTaskAction(button, '正在关闭…', `/api/tasks/${button.dataset.closeTask}/close`));
    bindActionableAnomalyButtons(document);
  }

  function bindActionableAnomalyButtons(scope) {
    scope.querySelectorAll('[data-create-material-action]').forEach((button) => button.onclick = async () => {
      const restore = setButtonLoading(button, '正在下发…');
      try {
        const state = await api('/api/operation-tasks', { method: 'POST', body: JSON.stringify({
          sourceAnomalyId: button.dataset.createMaterialAction, storeCode: button.dataset.materialStore,
          taskType: button.dataset.materialType, title: button.dataset.materialTitle, instruction: button.dataset.materialInstruction
        }) });
        closeAnomalyDrawer(); renderHq(state);
      } catch (error) { alert(error.message); restore(); }
    });
    scope.querySelectorAll('[data-create-store-action]').forEach((button) => button.onclick = async () => {
      const restore = setButtonLoading(button, '正在下发…');
      try {
        const state = await api('/api/operation-tasks', { method: 'POST', body: JSON.stringify({
          sourceAnomalyId: button.dataset.createStoreAction,
          taskType: button.dataset.createStoreAction === 'ANM-SKU-005' ? 'sku_inventory_check' : 'inventory_receipt_check',
          title: button.dataset.createStoreAction === 'ANM-SKU-005' ? '黑糖原料库存核查（SKU011）' : '鲜牛奶负库存核查',
          instruction: button.dataset.createStoreAction === 'ANM-SKU-005'
            ? '请核查 Brown Sugar Boba Milk Tea 400 N 今日销售涉及的黑糖珍珠、黑糖冻、半成品奶茶、冰块等实存；核对当日收货与报损记录；上传盘点单或收货 / 报损凭证后提交。'
            : '请盘点鲜牛奶实际库存，并核对昨日收货单、报损登记和库存台账；上传盘点单或收货凭证后提交。'
        }) });
        closeAnomalyDrawer(); renderHq(state);
      } catch (error) { alert(error.message); restore(); }
    });
    scope.querySelectorAll('[data-open-governance-create]').forEach((button) => button.onclick = () => { window.location.href = `/governance-task-create/?anomaly=${encodeURIComponent(button.dataset.openGovernanceCreate)}`; });
    scope.querySelectorAll('[data-show-operation-detail]').forEach((button) => button.onclick = () => { window.location.href = `/work-order/?id=${encodeURIComponent(button.dataset.showOperationDetail)}`; });
    scope.querySelectorAll('[data-open-governance-detail]').forEach((button) => button.onclick = () => { const task = (latestHqState?.governanceTasks || []).find((item) => item.id === button.dataset.openGovernanceDetail); if (task) { closeAnomalyDrawer(); openGovernanceDrawer(task); } });
  }

  function renderDailyPlans(state) {
    const plans = (state.countPlans || []).slice().sort((a, b) => String(b.business_date || '').localeCompare(String(a.business_date || '')) || String(b.created_at || '').localeCompare(String(a.created_at || '')));
    const pending = plans.filter((plan) => plan.status === 'pending_store_count').length;
    const review = plans.filter((plan) => plan.status === 'pending_hq_review').length;
    const summary = document.querySelector('#daily-plan-summary'); if (summary) summary.textContent = review ? `待总部复核 ${review} 项 · 待门店执行 ${pending} 项` : `待门店执行 ${pending} 项`;
    const panel = document.querySelector('#daily-plan-panel'); if (!panel) return;
    panel.innerHTML = `<div class="operation-list"><table><thead><tr><th>计划任务号</th><th>营业日期</th><th>门店</th><th>默认物料</th><th>门店提交</th><th>状态</th><th>创建时间</th></tr></thead><tbody>${plans.map((plan) => `<tr><td><b>${esc(plan.plan_no || plan.id)}</b></td><td>${esc(plan.business_date)}</td><td>${esc(plan.store_code)}</td><td>${Number(plan.material_count || 0)} 项</td><td>${Number(plan.submitted_material_count || 0)} / ${Number(plan.material_count || 0)} 项</td><td><span class="status-tag ${plan.status === 'pending_hq_review' ? 'assigned' : plan.status === 'closed' ? 'closed' : 'pending'}">${plan.status === 'pending_hq_review' ? '待总部复核' : plan.status === 'closed' ? '已完成' : '待门店盘点'}</span></td><td>${formatDate(plan.created_at)}</td></tr>`).join('') || '<tr><td colspan="7" class="operation-empty">尚未生成每日盘点计划。</td></tr>'}</tbody></table></div>`;
  }

  function renderHq(state) {
    latestHqState = state; renderOperationTasks(state); renderDailyPlans(state); renderGovernanceTasks(state);
    document.querySelectorAll('[data-open-task-create]').forEach((button) => button.onclick = () => { window.location.href = '/task-create/'; });
    document.querySelectorAll('[data-show-operation-detail]').forEach((button) => button.onclick = () => { window.location.href = `/work-order/?id=${encodeURIComponent(button.dataset.showOperationDetail)}`; });
    document.querySelectorAll('[data-operation-filter]').forEach((button) => button.onclick = () => { selectedOperationStatus = button.dataset.operationFilter; renderHq(latestHqState); });
    document.querySelectorAll('[data-close-operation]').forEach((button) => button.onclick = async () => { const restore = setButtonLoading(button, '正在验收…'); try { renderHq(await api(`/api/operation-tasks/${button.dataset.closeOperation}/close`, { method: 'POST' })); } catch (error) { alert(error.message); restore(); } });
    document.querySelectorAll('[data-open-governance-detail]').forEach((button) => button.onclick = () => { const task = (state.governanceTasks || []).find((item) => item.id === button.dataset.openGovernanceDetail); if (task) openGovernanceDrawer(task); });
    document.querySelectorAll('[data-close-governance]').forEach((button) => button.onclick = async () => { const restore = setButtonLoading(button, '正在关闭…'); try { renderHq(await api(`/api/governance-tasks/${button.dataset.closeGovernance}/close`, { method: 'POST' })); } catch (error) { alert(error.message); restore(); } });
    document.querySelectorAll('[data-open-document]').forEach((button) => button.onclick = () => { const document = state.documents.find((item) => item.id === button.dataset.openDocument); if (document) openDocumentDrawer(document); });
    document.querySelectorAll('[data-open-operation-proof]').forEach((button) => button.onclick = () => { const task = (state.operationTasks || []).find((item) => item.id === button.dataset.openOperationProof); if (task) openOperationProofDrawer(task, state); });
    document.querySelectorAll('[data-open-operation-document]').forEach((button) => button.onclick = () => { const document = (state.documents || []).find((item) => item.id === button.dataset.openOperationDocument); if (document) openDocumentDrawer(document); });
  }

  function initTaskCreate() {
    const templates = {
      cold: { title: '冷藏温度巡检', instruction: '请在开店前检查冷藏设备温度是否处于 0–4°C，拍摄温度计或设备面板作为凭证后提交。' },
      handover: { title: '晚班收银交接检查', instruction: '请核对晚班现金、POS 退款与交接签字，拍摄交接单作为凭证后提交。' },
      receipt: { title: '收货单据核对', instruction: '请核对当日入库数量与收货单据是否一致，拍摄收货单作为凭证后提交。' }
    };
    document.querySelectorAll('[data-template]').forEach((button) => button.addEventListener('click', () => {
      document.querySelectorAll('[data-template]').forEach((item) => item.classList.toggle('active', item === button));
      const template = templates[button.dataset.template];
      document.querySelector('#create-task-title').value = template.title;
      document.querySelector('#create-task-instruction').value = template.instruction;
    }));
    document.querySelector('#task-create-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = event.currentTarget; const button = form.querySelector('[type="submit"]'); const notice = document.querySelector('#task-create-notice');
      const restore = setButtonLoading(button, '正在下发…'); notice.className = 'notice'; notice.textContent = '';
      try {
        const state = await api('/api/operation-tasks', { method: 'POST', body: JSON.stringify({ title: document.querySelector('#create-task-title').value, instruction: document.querySelector('#create-task-instruction').value, taskType: 'custom' }) });
        notice.className = 'notice success'; notice.textContent = '任务已下发，门店待办已同步更新；正在返回运营任务中心。';
        window.setTimeout(() => { window.location.href = `/?focus=operation&task=${state.operationTask.id}`; }, 650);
      } catch (error) { notice.className = 'notice error'; notice.textContent = error.message; restore(); }
    });
  }

  function initGovernanceCreate() {
    const params = new URLSearchParams(window.location.search);
    const anomalyId = params.get('anomaly') || 'ANM-SKU-002';
    const config = governanceConfigs[anomalyId] || governanceConfigs['ANM-SKU-002'];
    document.querySelector('#governance-task-target').textContent = config.target;
    document.querySelector('#governance-task-title').value = config.title;
    document.querySelector('#governance-task-owner').value = config.owner;
    document.querySelector('#governance-task-instruction').value = config.instruction;
    const form = document.querySelector('#governance-task-create-form');
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const button = form.querySelector('[type="submit"]'); const notice = document.querySelector('#governance-task-create-notice');
      const restore = setButtonLoading(button, '正在创建…'); notice.className = 'notice'; notice.textContent = '';
      try {
        const state = await api('/api/governance-tasks', { method: 'POST', body: JSON.stringify({
          sourceAnomalyId: anomalyId,
          title: document.querySelector('#governance-task-title').value,
          instruction: document.querySelector('#governance-task-instruction').value,
          owner: document.querySelector('#governance-task-owner').value
        }) });
        notice.className = 'notice success'; notice.textContent = '总部治理工单已创建，正在返回运营任务中心。';
        window.setTimeout(() => { window.location.href = `/?dimension=sku&focus=governance&task=${state.governanceTasks[0].id}`; }, 650);
      } catch (error) { notice.className = 'notice error'; notice.textContent = error.message; restore(); }
    });
  }

  async function load() {
    try {
      const state = view === 'store' ? await window.loadStoreBootstrap() : await api('/api/state');
      const params = new URLSearchParams(window.location.search);
      if (view === 'hq' && ['store', 'sku'].includes(params.get('dimension'))) selectedAnomalyDimension = params.get('dimension');
      if (view === 'store') renderStore(state); else if (view === 'hq') renderHq(state);
      if (view === 'hq' && params.get('focus') === 'inventory') {
        if (params.get('materialAnomaly')) selectedAnomalyDimension = 'store';
        const taskId = params.get('materialAnomaly') || params.get('task'); const anomaly = currentAnomalies(state).find((item) => item.id === taskId || item.task_no === taskId);
        if (anomaly) openAnomalyDrawer(anomaly, state);
      }
      if (view === 'hq' && params.get('focus') === 'operation') {
        selectedOperationTaskId = params.get('task');
        if (selectedOperationTaskId) window.location.replace(`/work-order/?id=${encodeURIComponent(selectedOperationTaskId)}`);
      }
      if (view === 'hq' && params.get('focus') === 'governance') {
        selectedGovernanceTaskId = params.get('task'); renderHq(state); document.querySelector('#governance-detail-panel')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    } catch (error) {
      if (view === 'store') {
        setStoreMessage(`加载失败：${error.message}`, 'error');
        const empty = document.querySelector('#today-task-empty');
        if (empty) {
          empty.style.display = 'flex';
          empty.classList.add('is-ready');
          empty.innerHTML = '<span aria-hidden="true">!</span><span>今日任务加载失败，请刷新重试</span>';
        }
      } else document.querySelector('#live-task-panel').innerHTML = `<div class="live-empty">加载失败：${esc(error.message)}</div>`;
    }
  }

  if (view === 'store') {
    const input = document.querySelector('#document-file');
    document.querySelector('#choose-document-file').addEventListener('click', () => openPicker(selectedDocumentType, 'initial'));
    document.querySelectorAll('[data-document-type]').forEach((button) => button.addEventListener('click', () => {
      selectedDocumentType = button.dataset.documentType;
      syncUploadControl(latestStoreState?.task);
    }));
    input.addEventListener('change', submitSelectedDocument);
    document.querySelector('#operation-proof-file').addEventListener('change', submitOperationProof);
    document.querySelectorAll('[data-common-action]').forEach((button) => button.addEventListener('click', () => {
      const action = button.dataset.commonAction;
      if (window.storeOperationOpen) return window.storeOperationOpen(action);
      window.switchStoreTab?.('ops');
      if (action === 'transfer') return document.querySelector('#store-transfer-request-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      if (action === 'count') return document.querySelector('#plan-count-btn')?.click() || document.querySelector('#daily-count-task')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      selectedDocumentType = action === 'scrap' ? 'scrap' : 'receipt';
      syncUploadControl(latestStoreState?.task);
      document.querySelector('#document-upload-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }));
  }
  if (view === 'task-create') initTaskCreate();
  if (view === 'governance-create') initGovernanceCreate();
  document.addEventListener('click', async (event) => {
    const reset = event.target.closest('[data-reset-demo]');
    if (!reset || !confirm('确认清空本次演示产生的单据、异常和任务吗？')) return;
    const restore = setButtonLoading(reset, '正在重置…');
    try {
      const state = await api('/api/demo/reset', { method: 'POST' });
      window.invalidateStoreBootstrap?.();
      if (view === 'store') renderStore(state); else if (view === 'hq') renderHq(state);
    } catch (error) {
      alert(error.message);
      restore();
    }
  });
  // 总部首屏只保留决策信息；完整根因、凭证与时间线进入详情抽屉，避免宽表挤压。
  function renderAnomalyWorkspace(state) {
    const all = currentAnomalies(state).sort((a, b) => new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0));
    const active = all.filter((item) => item.status !== 'closed'); const closed = all.filter((item) => item.status === 'closed');
    const activePages = Math.max(1, Math.ceil(active.length / anomalyPageSize)); const closedPages = Math.max(1, Math.ceil(closed.length / anomalyPageSize));
    activeAnomalyPage = Math.min(activeAnomalyPage, activePages); closedAnomalyPage = Math.min(closedAnomalyPage, closedPages);
    const activeItems = active.slice((activeAnomalyPage - 1) * anomalyPageSize, activeAnomalyPage * anomalyPageSize);
    const closedItems = closed.slice((closedAnomalyPage - 1) * anomalyPageSize, closedAnomalyPage * anomalyPageSize);
    const high = all.filter((item) => item.severity === 'high').length; const mid = all.filter((item) => item.severity === 'mid').length;
    const subjectCell = (item) => { const store = item.store_code || (/^STORE/.test(item.subject || '') ? item.subject : '总部 / 跨店'); const subject = item.materialInventory ? item.subject : (store === item.subject ? item.owner : item.subject); return `<b>${esc(store)}</b><small>${esc(subject || item.owner || '—')}</small>`; };
    const taskCell = (item) => `${isDemoAnomaly(item) ? '<span class="demo-float">DEMO</span><br>' : ''}<b class="task-no">${esc(anomalyTaskNo(item))}</b><small>${esc(item.id)} · ${esc(formatDate(anomalyCreatedAt(item)))}</small>`;
    const riskCell = (item) => `<span class="risk-title">${esc(item.type)}</span><br><span class="severity-tag ${item.severity}">${item.severity === 'high' ? '高风险' : '中风险'}</span>`;
    const strategyCell = (item) => `<span class="strategy-tag">${esc(strategyMeta[item.strategy || 'store_direct'].label)}</span><small>${esc(item.root)}</small>`;
    const page = (current, total, count, kind) => count <= anomalyPageSize ? '' : `<span>第 ${current} / ${total} 页 · 共 ${count} 条</span><button class="btn" data-anomaly-page="${kind}" data-page="${current - 1}" ${current === 1 ? 'disabled' : ''}>上一页</button><button class="btn" data-anomaly-page="${kind}" data-page="${current + 1}" ${current === total ? 'disabled' : ''}>下一页</button>`;
    document.querySelector('#kpi-new-count').textContent = all.length; document.querySelector('#kpi-new-sub').textContent = `高 ${high} / 中 ${mid}`;
    document.querySelector('#kpi-open-count').textContent = active.length; document.querySelector('#kpi-closed-count').textContent = closed.length;
    document.querySelector('#kpi-rate').textContent = `${all.length ? Math.round(closed.length / all.length * 100) : 0}%`; document.querySelector('#kpi-rate-sub').textContent = `${closed.length} / ${all.length}`;
    document.querySelector('#anomaly-active-copy').textContent = `${selectedAnomalyDimension === 'sku' ? 'SKU / 物料' : '门店'}异常 · 待研判与处理中`;
    document.querySelector('#anomaly-summary-copy').textContent = `共 ${all.length} 条 · 处理中 ${active.length} 条`;
    document.querySelectorAll('[data-anomaly-tab]').forEach((button) => button.classList.toggle('active', button.dataset.anomalyTab === selectedAnomalyDimension));
    document.querySelector('#anomaly-active-rows').innerHTML = activeItems.map((item) => `<tr class="${isDemoAnomaly(item) ? 'demo-row' : ''}"><td>${taskCell(item)}</td><td>${subjectCell(item)}</td><td>${riskCell(item)}</td><td>${strategyCell(item)}</td><td class="compact-copy">${esc(item.action)}</td><td><span class="status-tag ${anomalyStatusClass(item)}">${anomalyStatus(item)}</span></td><td><div class="btn-row">${anomalyAction(item, state)}<button class="btn" data-open-anomaly="${item.id}">详情</button></div></td></tr>`).join('') || '<tr><td colspan="7" class="operation-empty">当前没有待处理异常。</td></tr>';
    document.querySelector('#anomaly-closed-rows').innerHTML = closedItems.map((item) => `<tr><td>${taskCell(item)}</td><td>${subjectCell(item)}</td><td>${riskCell(item)}</td><td class="compact-copy">${esc(item.action || item.evidence || '已完成闭环')}</td><td><span class="status-tag closed">已闭环</span></td><td><button class="btn" data-open-anomaly="${item.id}">详情</button></td></tr>`).join('') || '<tr><td colspan="6" class="operation-empty">当前维度暂无已闭环案例。</td></tr>';
    document.querySelector('#anomaly-active-pager').innerHTML = page(activeAnomalyPage, activePages, active.length, 'active'); document.querySelector('#anomaly-closed-pager').innerHTML = page(closedAnomalyPage, closedPages, closed.length, 'closed');
    document.querySelectorAll('[data-anomaly-tab]').forEach((button) => button.onclick = () => { selectedAnomalyDimension = button.dataset.anomalyTab; activeAnomalyPage = 1; closedAnomalyPage = 1; renderHq(latestHqState); });
    document.querySelectorAll('[data-anomaly-page]').forEach((button) => button.onclick = () => { if (button.dataset.anomalyPage === 'active') activeAnomalyPage = Number(button.dataset.page); else closedAnomalyPage = Number(button.dataset.page); renderHq(latestHqState); });
    document.querySelectorAll('[data-open-anomaly]').forEach((button) => button.onclick = () => { const anomaly = all.find((item) => item.id === button.dataset.openAnomaly); if (anomaly) openAnomalyDrawer(anomaly, state); });
    document.querySelectorAll('[data-request-recount]').forEach((button) => button.onclick = () => runHqTaskAction(button, '正在指派…', `/api/tasks/${button.dataset.requestRecount}/request-recount`));
    document.querySelectorAll('[data-end-audit]').forEach((button) => button.onclick = () => runHqTaskAction(button, '正在结束…', `/api/tasks/${button.dataset.endAudit}/end-audit`));
    document.querySelectorAll('[data-close-task]').forEach((button) => button.onclick = () => runHqTaskAction(button, '正在关闭…', `/api/tasks/${button.dataset.closeTask}/close`));
    bindActionableAnomalyButtons(document);
  }

  // 总部首页不再把每个物料信号伪装成独立研判任务；它只汇总真正的门店日结研判单。
  renderAnomalyWorkspace = function(state) {
    const all = (state.diagnosisCases || []).slice().sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at));
    const active = all.filter((item) => item.status !== 'closed'); const closed = all.filter((item) => item.status === 'closed');
    const high = all.filter((item) => item.severity === 'high').length; const mid = all.filter((item) => item.severity === 'mid').length;
    document.querySelector('#kpi-new-count').textContent = all.length; document.querySelector('#kpi-new-sub').textContent = `高 ${high} / 中 ${mid}`;
    document.querySelector('#kpi-open-count').textContent = active.length; document.querySelector('#kpi-closed-count').textContent = closed.length;
    document.querySelector('#kpi-rate').textContent = `${all.length ? Math.round(closed.length / all.length * 100) : 0}%`; document.querySelector('#kpi-rate-sub').textContent = `${closed.length} / ${all.length}`;
    document.querySelectorAll('[data-anomaly-tab]').forEach((tab) => { tab.style.display = 'none'; });
    document.querySelector('#anomaly-active-copy').textContent = '门店日结研判单：物料信号已在台账中归集，研判过程单独闭环。';
    document.querySelector('#anomaly-summary-copy').textContent = `共 ${all.length} 张 · 处理中 ${active.length} 张`;
    const row = (item) => `<tr><td><b>${esc(item.case_no)}</b><small>${esc(item.opened_business_date)} 首次触发 · 最新 ${esc(item.latest_business_date)}</small></td><td><b>${esc(item.store_code)}</b><small>${Number(item.signal_count || 0)} 条物料信号</small></td><td><span class="risk-title">${item.scope === 'full_store_count' ? '多物料台账异常' : item.scope === 'count_variance_review' ? '实盘差异复核' : '日结库存风险'}</span><br><span class="severity-tag ${item.severity}">${item.severity === 'high' ? '高风险' : '中风险'}</span></td><td><span class="strategy-tag">${item.scope === 'full_store_count' ? '先治理，必要时全盘' : item.scope === 'count_variance_review' ? '物料详情 + 定向复盘' : '排除法处理'}</span><small>${esc((item.materials || []).join('、'))}</small></td><td class="compact-copy">${esc((item.recommended_actions || []).map((action) => action.label).join('；'))}</td><td><span class="status-tag ${item.status === 'closed' ? 'closed' : ['awaiting_store_count','targeted_count_dispatched'].includes(item.status) ? 'assigned' : 'pending'}">${esc(item.closure_mode === 'hq_forced' ? '总部强制结案' : (({open:'待总部排除',awaiting_store_count:'等待门店全盘',targeted_count_dispatched:'等待定向盘点',pending_verification:'等待总部验证',needs_hq_action:'盘点后仍有差异',pending_hq_close:'待总部结案',closed:'已结案'})[item.status] || item.status))}</span></td><td><a class="btn" href="/diagnosis/?store=${encodeURIComponent(item.store_code)}&date=${encodeURIComponent(item.latest_business_date)}">进入研判</a></td></tr>`;
    document.querySelector('#anomaly-active-rows').innerHTML = active.map(row).join('') || '<tr><td colspan="7" class="operation-empty">当前没有待处理日结研判单。</td></tr>';
    document.querySelector('#anomaly-closed-rows').innerHTML = closed.map(row).join('') || '<tr><td colspan="6" class="operation-empty">当前暂无已结案日结研判单。</td></tr>';
    document.querySelector('#anomaly-active-pager').innerHTML = ''; document.querySelector('#anomaly-closed-pager').innerHTML = '';
  };
  load();
}());
