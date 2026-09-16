(() => {
  if (!document.body.matches('[data-view="hq"]')) return;
  const operation = document.querySelector('#operation-task-panel')?.closest('.section');
  const governance = document.querySelector('#governance-task-workspace');
  const anomaly = document.querySelector('#anomaly-workspace');
  const closed = document.querySelector('#closed-anomaly-workspace');
  if (!operation || !governance || !anomaly || !closed) return;
  const hub = document.createElement('section'); hub.className = 'section hq-task-hub';
  hub.innerHTML = '<div class="section-header"><div><div class="section-title">运营任务与闭环</div><div class="section-extra">门店执行、总部治理与异常研判统一在此处追踪；物料风险、台账和举证已归入库存管理。</div></div></div><div class="hub-tabs"><button class="hub-tab" data-hub="operation">主动运营任务</button><button class="hub-tab" data-hub="governance">总部治理工单</button><button class="hub-tab active" data-hub="anomaly">异常研判任务</button><button class="hub-tab" data-hub="closed">已闭环案例</button></div><div class="hub-body"></div>';
  operation.parentNode.insertBefore(hub, operation);
  const body = hub.querySelector('.hub-body');
  const groups = { operation, governance, anomaly, closed };
  Object.entries(groups).forEach(([name, node]) => { node.dataset.hub = name; body.appendChild(node); });
  const style = document.createElement('style');
  style.textContent = '.hq-task-hub{overflow:visible}.hq-task-hub>.section-header{margin-bottom:0}.hub-tabs{display:flex;gap:8px;padding:14px 20px 0;border-top:1px solid #f0f1f3}.hub-tab{border:1px solid #dcdfe5;background:#fff;color:#646a73;padding:7px 12px;border-radius:6px;cursor:pointer;font:13px inherit}.hub-tab.active{background:#3370ff;border-color:#3370ff;color:#fff}.hq-task-hub .hub-body>.section{display:none;margin:0;border:0;border-radius:0;box-shadow:none}.hq-task-hub .hub-body>.section.hub-visible{display:block}.hq-task-hub .hub-body>.section>.section-header{padding-top:16px}@media(max-width:760px){.hub-tabs{overflow:auto;padding:12px 14px 0}.hub-tab{white-space:nowrap}.hq-task-hub .hub-body>.section>.section-header{padding-left:14px;padding-right:14px}}';
  document.head.appendChild(style);
  function choose(name) { Object.entries(groups).forEach(([key, node]) => node.classList.toggle('hub-visible', key === name)); hub.querySelectorAll('[data-hub]').forEach((button) => button.classList.toggle('active', button.dataset.hub === name)); }
  hub.querySelectorAll('[data-hub]').forEach((button) => button.onclick = () => choose(button.dataset.hub));
  const focus = new URLSearchParams(location.search).get('focus'); choose(focus === 'operation' ? 'operation' : focus === 'governance' ? 'governance' : 'anomaly');
})();
