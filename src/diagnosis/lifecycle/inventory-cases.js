import { getRuleEngine, SUPPORTED_RULE_CODES } from '../engine/registry.js';

const normalizeKey = (value) => String(value || '').trim().toLowerCase().replace(/[\s\-_/，,、()（）]/g, '');

export function inventoryRuleFamily(ruleCode) {
  return getRuleEngine(ruleCode)?.family || 'other';
}

export function inventoryRuleLabel(ruleCode) {
  return ({ NEGATIVE_THEORETICAL:'D2 · 负库存', COUNT_VARIANCE:'D1 · 理论与实盘差异', BELOW_SAFETY_STOCK:'S1 · 低于安全库存', SELL_IN_IMBALANCE:'T2 · 销入比异常' })[ruleCode] || ruleCode;
}

export function inventoryFamilyLabel(family) {
  return ({ inventory_accuracy:'库存准确性', supply_risk:'供应保障', replenishment_balance:'补货节奏' })[family] || '库存问题';
}

export function stableInventoryCaseId(key) {
  let hash = 2166136261;
  for (let index = 0; index < key.length; index += 1) { hash ^= key.charCodeAt(index); hash = Math.imul(hash, 16777619); }
  return `ICS-${(hash >>> 0).toString(16).toUpperCase().padStart(8, '0')}`;
}

export function inventoryObservation(signal) {
  const detail = signal.evidence_detail || {};
  return {
    observation_id:`OBS-${signal.id}`,
    signal_id:signal.id,
    business_date:signal.business_date,
    calculated_at:signal.updated_at || signal.created_at,
    store_code:signal.store_code,
    material_name:signal.material_name,
    unit:signal.unit,
    rule_code:signal.rule_code,
    rule_label:inventoryRuleLabel(signal.rule_code),
    rule_family:inventoryRuleFamily(signal.rule_code),
    anomaly_status:signal.status,
    theoretical_qty:detail.theoretical_qty ?? signal.theoretical_closing_qty ?? null,
    physical_qty:detail.physical_qty ?? null,
    safety_qty:signal.safety_qty ?? null,
    opening_qty:detail.opening_qty ?? null,
    receipt_qty:detail.receipt_qty ?? null,
    transfer_in_qty:detail.transfer_in_qty ?? null,
    transfer_out_qty:detail.transfer_out_qty ?? null,
    scrap_qty:detail.scrap_qty ?? null,
    bom_consumption_qty:detail.bom_consumption_qty ?? null,
    sell_in_ratio:detail.sell_in_ratio ?? null,
    evidence:signal.evidence || '',
    source_batch_id:signal.source_batch_id || null
  };
}

function inventoryCaseStatus(task, hasCurrentSignal, closedVerified) {
  if (closedVerified) return 'closed';
  if (task?.status === 'pending_store_submission' || task?.status === 'pending_hq_review') return 'in_progress';
  if (hasCurrentSignal) return 'open';
  return 'pending_verification';
}

export function refreshInventoryCases(value, updatedAt = new Date().toISOString()) {
  const latestBusinessDate = value.feishuImport?.latest_business_date || null;
  const supported = new Set(SUPPORTED_RULE_CODES);
  const baseGroups = new Map();
  for (const signal of (value.materialAnomalies || []).filter((item) => supported.has(item.rule_code))) {
    const family = inventoryRuleFamily(signal.rule_code);
    const baseKey = `${signal.store_code}|${normalizeKey(signal.material_name)}|${signal.unit || ''}|${family}`;
    const rows = baseGroups.get(baseKey) || [];
    rows.push(signal); baseGroups.set(baseKey, rows);
  }
  const previous = new Map((value.inventoryCases || []).map((item) => [item.issue_key, item]));
  const cases = [];
  for (const [baseKey, baseSignals] of baseGroups) {
    baseSignals.sort((left, right) => String(left.business_date).localeCompare(String(right.business_date)) || String(left.updated_at || '').localeCompare(String(right.updated_at || '')));
    const allSignalIds = new Set(baseSignals.map((item) => item.id));
    const verifiedClosures = (value.operationTasks || []).filter((task) => {
      if (task.status !== 'closed' || !allSignalIds.has(task.source_anomaly_id)) return false;
      const latestRun = (task.diagnosis_runs || []).find((run) => run.id === task.latest_diagnosis_run_id) || (task.diagnosis_runs || []).at(-1);
      return latestRun?.anomaly_status === 'not_triggered';
    }).sort((left, right) => String(left.business_date || '').localeCompare(String(right.business_date || '')) || String(left.closed_at || '').localeCompare(String(right.closed_at || '')));
    const segmentGroups = new Map();
    for (const signal of baseSignals) {
      const segmentIndex = verifiedClosures.filter((task) => String(task.business_date || '') < String(signal.business_date || '')).length;
      const rows = segmentGroups.get(segmentIndex) || [];
      rows.push(signal); segmentGroups.set(segmentIndex, rows);
    }
    let priorCaseId = null;
    for (const [segmentIndex, signals] of [...segmentGroups.entries()].sort((left, right) => left[0] - right[0])) {
      signals.sort((left, right) => String(left.business_date).localeCompare(String(right.business_date)) || String(left.updated_at || '').localeCompare(String(right.updated_at || '')));
      const first = signals[0], latest = signals.at(-1), family = inventoryRuleFamily(latest.rule_code);
      const issueKey = segmentIndex === 0 ? baseKey : `${baseKey}|recurrence:${first.business_date}`;
      const signalIds = new Set(signals.map((item) => item.id));
      const tasks = (value.operationTasks || []).filter((task) => signalIds.has(task.source_anomaly_id)).sort((left, right) => String(left.updated_at || left.created_at).localeCompare(String(right.updated_at || right.created_at)));
      const activeTask = [...tasks].reverse().find((task) => task.status !== 'closed') || null;
      const closedTask = [...tasks].reverse().find((task) => task.status === 'closed') || null;
      const latestRun = closedTask ? (closedTask.diagnosis_runs || []).find((run) => run.id === closedTask.latest_diagnosis_run_id) || (closedTask.diagnosis_runs || []).at(-1) : null;
      const closedVerified = Boolean(closedTask && latestRun?.anomaly_status === 'not_triggered');
      const currentSignals = signals.filter((item) => item.business_date === latestBusinessDate && !['closed', 'auto_closed'].includes(item.status));
      const currentSignal = currentSignals.at(-1) || latest;
      const existing = previous.get(issueKey);
      const caseId = existing?.id || stableInventoryCaseId(issueKey);
      const observations = signals.map(inventoryObservation);
      const status = inventoryCaseStatus(activeTask, currentSignals.length > 0, closedVerified);
      const assignedTo = activeTask?.assigned_to || closedTask?.assigned_to || currentSignal.owner || '待分配';
      const latestDetail = currentSignal.evidence_detail || {};
      const caseItem = {
        ...(existing || {}), id:caseId,
        case_no:existing?.case_no || `IC-${currentSignal.store_code}-${caseId.slice(-6)}`,
        issue_key:issueKey, store_code:currentSignal.store_code, material_name:currentSignal.material_name, unit:currentSignal.unit,
        rule_family:family, family_label:inventoryFamilyLabel(family), current_rule_code:currentSignal.rule_code,
        current_rule_label:inventoryRuleLabel(currentSignal.rule_code), status,
        opened_business_date:first.business_date, latest_business_date:latest.business_date,
        first_seen_at:first.created_at || first.updated_at, last_seen_at:latest.updated_at || latest.created_at,
        signal_ids:[...signalIds], observation_ids:observations.map((item) => item.observation_id), observations:[...observations].reverse(), observation_count:observations.length,
        active_work_order_id:activeTask?.id || null, work_order_ids:tasks.map((task) => task.id), assigned_to:assignedTo,
        owner:currentSignal.owner || null, severity:signals.some((item) => item.severity === 'high') ? 'high' : 'mid',
        latest_values:{ theoretical_qty:latestDetail.theoretical_qty ?? currentSignal.theoretical_closing_qty ?? null, physical_qty:latestDetail.physical_qty ?? null, safety_qty:currentSignal.safety_qty ?? null, sell_in_ratio:latestDetail.sell_in_ratio ?? null },
        latest_evidence:currentSignal.evidence || '', resolution:closedTask?.resolution || null,
        closed_at:closedVerified ? closedTask.closed_at : null, updated_at:activeTask?.updated_at || closedTask?.updated_at || latest.updated_at || updatedAt,
        contract_version:'inventory-case-v3.0', recurrence_of_case_id:segmentIndex > 0 ? (existing?.recurrence_of_case_id || priorCaseId) : null, recurrence_index:segmentIndex
      };
      for (const task of tasks) task.inventory_case_id = caseId;
      cases.push(caseItem); priorCaseId = caseId;
    }
  }
  value.inventoryCases = cases.sort((left, right) => {
    const statusRank = { open:0, in_progress:1, pending_verification:2, closed:3 };
    return (statusRank[left.status] ?? 9) - (statusRank[right.status] ?? 9) || String(right.latest_business_date).localeCompare(String(left.latest_business_date)) || String(left.material_name).localeCompare(String(right.material_name), 'zh-CN');
  });
  return value.inventoryCases;
}

export function inventoryCasesView(value, updatedAt = new Date().toISOString()) {
  const cases = refreshInventoryCases(value, updatedAt);
  const count = (statuses) => cases.filter((item) => statuses.includes(item.status)).length;
  return {
    contract_version:'inventory-case-v3.0', latest_business_date:value.feishuImport?.latest_business_date || null,
    summary:{ total:cases.length, active:count(['open', 'in_progress']), new_today:cases.filter((item) => item.opened_business_date === value.feishuImport?.latest_business_date && ['open', 'in_progress'].includes(item.status)).length, persistent:cases.filter((item) => item.opened_business_date !== item.latest_business_date && ['open', 'in_progress'].includes(item.status)).length, pending_verification:count(['pending_verification']), closed:count(['closed']) },
    cases
  };
}
