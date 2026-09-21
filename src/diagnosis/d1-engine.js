import { validateDiagnosisCase } from './contracts.js';

export const D1_RULESET = Object.freeze({ ruleset_id:'inventory-diagnosis-20260917-v1', rule_code:'D1_COUNT_VARIANCE', rule_version:'2.0.0', status:'active' });
const trace = (nodeId, type, result, message, evidenceRefs = []) => ({ node_id:nodeId, type, result, message, evidence_refs:evidenceRefs });
const metric = (packet, key) => packet.metrics?.[key]?.status === 'confirmed' ? Number(packet.metrics[key].value) : null;

export function evaluateD1(packet) {
  const delta = metric(packet, 'physical_delta'), threshold = metric(packet, 'variance_threshold');
  const decisionTrace = [];
  if (delta == null || threshold == null) return { anomaly_status:'rule_error', cause_evidence_status:'insufficient', physical_status:'pending_count', decision_trace:[trace('D1-INPUT-001','require_evidence','missing','缺少有效实盘或差异阈值，无法执行 D1。')], recommended_action_ids:[] };
  const triggered = Math.abs(delta) > threshold;
  decisionTrace.push(trace('D1-TRIGGER-001','condition',triggered,`实盘与理论相差 ${delta >= 0 ? '+' : ''}${delta}${packet.unit}，${triggered ? '超过' : '未超过'}阈值 ${threshold}${packet.unit}。`, packet.metrics.physical_delta.evidence_refs));
  if (!triggered) return { anomaly_status:'not_triggered', cause_evidence_status:'excluded', physical_status:'confirmed', decision_trace:decisionTrace, recommended_action_ids:[] };
  const positive = delta > 0;
  const location = positive ? '收货记录与盘点口径' : '报损、消耗与盘点执行';
  const hypothesis = positive ? `实盘比理论多 ${delta}${packet.unit}，优先核对漏记收货、单位换算与盘盈记录。` : `实盘比理论少 ${Math.abs(delta)}${packet.unit}，优先核对报损、销售消耗与盘点录入。`;
  decisionTrace.push(trace('D1-DIRECTION-001','rank',positive ? 'gain' : 'loss',hypothesis, packet.physical_count.evidence_refs));
  const gaps = [];
  if (positive && packet.data_availability.arrival_receipts.status !== 'confirmed') gaps.push({ code:'arrival_receipts', label:'正式收货单与流水对应关系', state:packet.data_availability.arrival_receipts.status, explanation:packet.data_availability.arrival_receipts.note });
  const result = { case_id:`V2-${packet.fact_packet_id}`, ruleset_id:D1_RULESET.ruleset_id, rule_code:D1_RULESET.rule_code, rule_version:D1_RULESET.rule_version, fact_packet_id:packet.fact_packet_id, anomaly_status:'triggered', cause_evidence_status:'suspect', physical_status:'confirmed', primary_location:location, primary_hypothesis:hypothesis, largest_contributor:{ code:positive ? 'positive_variance' : 'negative_variance', label:positive ? '盘盈差异' : '盘亏差异', qty:Math.abs(delta) }, evidence_gaps:gaps, missing_evidence:gaps.map((item) => item.label), decision_trace:decisionTrace, recommended_action_ids:positive ? ['VIEW_RECEIPTS','VIEW_FLOWS','CREATE_SPOT_COUNT'] : ['VIEW_FLOWS','CREATE_SPOT_COUNT'] };
  const validation = validateDiagnosisCase(result); if (!validation.valid) throw new Error(`Invalid D1 diagnosis case: ${validation.errors.join('; ')}`); return result;
}
