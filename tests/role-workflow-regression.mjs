const base = (process.env.BASE_URL || 'http://127.0.0.1:8787').replace(/\/$/, '');

async function login(accountId, portal) {
  const response = await fetch(`${base}/api/auth/demo-login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ account_id: accountId, portal })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`login ${accountId}: ${response.status} ${payload.error || ''}`);
  return { account: payload.account, cookie: (response.headers.get('set-cookie') || '').split(';')[0] };
}

async function request(session, path, options = {}) {
  const headers = new Headers(options.headers || {});
  headers.set('cookie', session.cookie);
  if (options.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
  const response = await fetch(`${base}${path}`, { ...options, headers });
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

async function ok(session, path, options = {}) {
  const result = await request(session, path, options);
  if (!result.response.ok) throw new Error(`${path}: ${result.response.status} ${result.payload.error || ''}`);
  return result.payload;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const hq = await login('ACC-HQ-WANG', 'hq');
const store = await login('ACC-STORE-LI', 'mobile');
const supervisor = await login('ACC-SUP-RINA', 'mobile');
const runId = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
const results = [];

const created = await ok(hq, '/api/operation-tasks', {
  method: 'POST',
  body: JSON.stringify({
    storeCode: 'STORE001',
    businessDate: '2026-09-18',
    taskType: 'role_flow_regression',
    title: `回归任务 ${runId}`,
    instruction: '核对黑糖珍珠库存，记录处理结论并提交一张测试凭证。'
  })
});
const task = created.operationTask;
assert(task?.id && task.status === 'pending_store_submission', '总部创建任务失败');
results.push({ case: 'HQ-01', status: 'PASS', evidence: { task_id: task.id, state: task.status } });

const storeBootstrap = await ok(store, '/api/store/bootstrap?store=STORE001');
assert((storeBootstrap.operationTasks || []).some((item) => item.id === task.id), '门店端未展示总部新建任务');
results.push({ case: 'STORE-01', status: 'PASS', evidence: { visible_task_id: task.id, account: store.account.display_name } });

const forbiddenDispatch = await request(store, '/api/operation-tasks', {
  method: 'POST',
  body: JSON.stringify({ storeCode: 'STORE001', title: '门店越权下发测试', instruction: '该请求不应创建任务。' })
});
assert(forbiddenDispatch.response.status === 403, `门店越权下发应返回 403，实际 ${forbiddenDispatch.response.status}`);
results.push({ case: 'AUTH-03', status: 'PASS', evidence: { store_dispatch_status: forbiddenDispatch.response.status } });

const supervisorBootstrap = await ok(supervisor, '/api/store/bootstrap?store=STORE001');
assert((supervisorBootstrap.operationTasks || []).some((item) => item.id === task.id), '督导未看到辖区门店任务');
results.push({ case: 'SUP-01', status: 'PASS', evidence: { visible_task_id: task.id, account: supervisor.account.display_name } });

await ok(supervisor, `/api/operation-tasks/${encodeURIComponent(task.id)}/notes`, {
  method: 'POST',
  body: JSON.stringify({ operator: supervisor.account.display_name, note: '区域督导已查看门店核对过程，等待门店提交凭证。' })
});
results.push({ case: 'SUP-02', status: 'PASS', evidence: { action: '协助记录', task_id: task.id } });

const submitted = await ok(store, `/api/operation-tasks/${encodeURIComponent(task.id)}/submit`, {
  method: 'POST',
  body: JSON.stringify({ filename: `role-flow-${runId}.png`, previewData: 'data:image/png;base64,iVBORw0KGgo=' })
});
const submittedTask = (submitted.operationTasks || []).find((item) => item.id === task.id);
assert(submittedTask?.status === 'pending_hq_review' && submittedTask.proof_document_id, '门店凭证提交未进入总部验收');
results.push({ case: 'STORE-02', status: 'PASS', evidence: { state: submittedTask.status, proof_document_id: submittedTask.proof_document_id } });

const forbiddenClose = await request(store, `/api/operation-tasks/${encodeURIComponent(task.id)}/close`, {
  method: 'POST',
  body: JSON.stringify({ outcome: 'resolved' })
});
assert(forbiddenClose.response.status === 403, `门店越权关闭应返回 403，实际 ${forbiddenClose.response.status}`);
results.push({ case: 'AUTH-01', status: 'PASS', evidence: { store_close_status: forbiddenClose.response.status } });

const closed = await ok(hq, `/api/operation-tasks/${encodeURIComponent(task.id)}/close`, {
  method: 'POST',
  body: JSON.stringify({
    outcome: 'resolved',
    final_cause: '本地回归确认：门店完成核对并提交凭证',
    resolution_note: '总部验收测试凭证，确认流程闭环。',
    operator: hq.account.display_name,
    store_adopted: true,
    hq_confirmed: true
  })
});
const closedTask = (closed.operationTasks || []).find((item) => item.id === task.id);
assert(closedTask?.status === 'closed' && closedTask.closure?.operator === hq.account.display_name, '总部闭环失败');
results.push({ case: 'HQ-02', status: 'PASS', evidence: { state: closedTask.status, operator: closedTask.closure.operator } });

const hqState = await ok(hq, '/api/state');
const anomaly = (hqState.materialAnomalies || []).find((item) => !['closed', 'auto_closed'].includes(item.status));
let inventoryTask = anomaly
  ? (hqState.operationTasks || []).find((item) => item.source_anomaly_id === anomaly.id && item.status !== 'closed')
  : null;
if (anomaly && !inventoryTask) {
  const workOrder = await ok(hq, `/api/anomalies/${encodeURIComponent(anomaly.id)}/work-order`, { method: 'POST' });
  inventoryTask = workOrder.operationTask;
}
if (!inventoryTask) {
  const syntheticInventoryTask = await ok(hq, '/api/operation-tasks', {
    method: 'POST',
    body: JSON.stringify({
      storeCode: 'STORE001',
      businessDate: '2026-09-18',
      taskType: 'diagnosis_negative_inventory',
      sourceRuleCode: 'NEGATIVE_THEORETICAL',
      title: `库存负数核查 ${runId}`,
      instruction: '核对调拨出库、目标门店签收、收货和盘点记录，并提交处理凭证。'
    })
  });
  inventoryTask = syntheticInventoryTask.operationTask;
}
assert(inventoryTask?.task_type === 'diagnosis_negative_inventory', '库存工单未建立');
const storeAfterWorkOrder = await ok(store, '/api/store/bootstrap?store=STORE001');
assert((storeAfterWorkOrder.operationTasks || []).some((item) => item.id === inventoryTask.id), '库存工单未展示到门店端');
const supervisorDetail = await ok(supervisor, `/api/operation-tasks/${encodeURIComponent(inventoryTask.id)}`);
assert(supervisorDetail.task?.id === inventoryTask.id, '督导无法查看辖区库存工单详情');
results.push({ case: 'INV-01', status: 'PASS', evidence: { anomaly_id: anomaly?.id || null, task_id: inventoryTask.id, rule: anomaly?.rule_code || inventoryTask.source_rule_code || null, fixture: anomaly ? '真实异常关联工单' : '隔离环境库存主题工单' } });

const outOfScope = await request(store, '/api/store/bootstrap?store=STORE003');
assert(outOfScope.response.status === 403, `门店越权访问其他门店应返回 403，实际 ${outOfScope.response.status}`);
results.push({ case: 'AUTH-02', status: 'PASS', evidence: { cross_store_status: outOfScope.response.status } });

console.log(JSON.stringify({
  base,
  generated_at: new Date().toISOString(),
  summary: { passed: results.length, failed: 0 },
  results,
  open_gaps: [
    {
      id: 'FLOW-GAP-01',
      severity: 'P0',
      title: '工单尚无正式转派督导动作',
      detail: '督导可按辖区查看并写处理记录，但任务没有 assignee account/role 状态、转派接口、接收动作和转派审计。'
    },
    {
      id: 'FLOW-GAP-02',
      severity: 'P1',
      title: '线上任务创建页仍是旧合同',
      detail: '尚未保存原型中的营业日、期限、责任角色、执行范围和验收凭证要求。'
    },
    {
      id: 'FLOW-GAP-03',
      severity: 'P1',
      title: '干净隔离状态没有天然库存异常',
      detail: '无飞书销售/库存快照时，回归使用库存主题工单验证多角色展示；V2 异常来源、快照和重算由现有规则与闭环测试覆盖。'
    }
  ]
}, null, 2));
