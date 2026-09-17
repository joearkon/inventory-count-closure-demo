export const CLOSURE_OUTCOMES = Object.freeze({
  resolved: '已恢复',
  accepted_exception: '接受例外',
  false_positive: '规则误判',
  master_data_issue: '主数据问题',
  unresolved: '尚未解决'
});

export function evaluateClosureGate({ outcome, finalCause, resolutionNote, operator, storeAdopted, hqConfirmed, latestRun, requireReassessment = true, evidenceCount = 0, noteCount = 0 } = {}) {
  const errors = [];
  if (!CLOSURE_OUTCOMES[outcome]) errors.push('请选择有效的最终处理结果。');
  if (!String(finalCause || '').trim()) errors.push('请填写最终原因。');
  if (!String(resolutionNote || '').trim()) errors.push('请填写解决方式。');
  if (!String(operator || '').trim()) errors.push('请填写操作人。');
  if (typeof storeAdopted !== 'boolean') errors.push('请确认门店是否采纳。');
  if (hqConfirmed !== true) errors.push('请由总部确认本次结论。');
  if (requireReassessment && !latestRun) errors.push('请先完成一次处理后的 V2 重算。');
  if (Number(evidenceCount) + Number(noteCount) <= 0) errors.push('请至少关联一项业务凭证或添加一条人工处理记录。');
  if (requireReassessment && outcome === 'resolved' && latestRun?.anomaly_status !== 'not_triggered') errors.push('最新 V2 仍触发异常，不能标记为“已恢复”；请继续处理或选择其他结论。');
  return { ok:errors.length === 0, errors, outcome_label:CLOSURE_OUTCOMES[outcome] || null };
}
