import { validateDiagnosisCase } from './contracts.js';

export const T2_RULESET = Object.freeze({ ruleset_id:'inventory-diagnosis-20260917-v1', rule_code:'T2_SELL_IN_IMBALANCE', rule_version:'1.0.0-shadow', status:'shadow' });
const trace = (nodeId, type, result, message, evidenceRefs = []) => ({ node_id:nodeId, type, result, message, evidence_refs:evidenceRefs });
const metric = (packet, key) => packet.metrics?.[key]?.status === 'confirmed' ? Number(packet.metrics[key].value) : null;

export function evaluateT2(packet) {
  const ratio = metric(packet, 'sell_in_ratio'), decisionTrace = [];
  if (ratio == null) return { anomaly_status:'rule_error', cause_evidence_status:'insufficient', physical_status:packet.physical_count.status === 'confirmed' ? 'confirmed' : 'pending_count', decision_trace:[trace('T2-INPUT-001','require_evidence','missing','销入比不可计算，无法执行 T2。')], recommended_action_ids:[] };
  const low = ratio < 0.3, high = ratio > 3, triggered = low || high;
  decisionTrace.push(trace('T2-TRIGGER-001','condition',triggered,`当前销入比 ${ratio}，${low ? '低于下限 0.3' : high ? '高于上限 3.0' : '位于 0.3–3.0 范围内'}。`, packet.metrics.sell_in_ratio.evidence_refs));
  if (!triggered) return { anomaly_status:'not_triggered', cause_evidence_status:'excluded', physical_status:packet.physical_count.status === 'confirmed' ? 'confirmed' : 'pending_count', decision_trace:decisionTrace, recommended_action_ids:[] };
  const receipt = packet.quantities.receipt.value, consumption = packet.quantities.bom_consumption.value;
  const location = low ? '收货批量与销售消耗衔接' : '销售消耗、BOM 与入库记录';
  const hypothesis = low ? `收货 ${receipt}${packet.unit}，BOM 消耗仅 ${consumption}${packet.unit}；优先核对是否批量备货、半成品生产入库或动销偏低。` : `BOM 消耗 ${consumption}${packet.unit} 明显高于收货 ${receipt}${packet.unit}；优先核对漏记收货、BOM 用量与销售同步。`;
  decisionTrace.push(trace('T2-DIRECTION-001','rank',low ? 'low_ratio' : 'high_ratio',hypothesis,[...packet.quantities.receipt.evidence_refs,...packet.quantities.bom_consumption.evidence_refs]));
  const gaps = [];
  if (packet.data_availability.arrival_receipts.status !== 'confirmed') gaps.push({ code:'arrival_receipts', label:'正式收货单与流水对应关系', state:packet.data_availability.arrival_receipts.status, explanation:packet.data_availability.arrival_receipts.note });
  const result = { case_id:`V2-${packet.fact_packet_id}`, ruleset_id:T2_RULESET.ruleset_id, rule_code:T2_RULESET.rule_code, rule_version:T2_RULESET.rule_version, fact_packet_id:packet.fact_packet_id, anomaly_status:'triggered', cause_evidence_status:'suspect', physical_status:packet.physical_count.status === 'confirmed' ? 'confirmed' : 'pending_count', primary_location:location, primary_hypothesis:hypothesis, largest_contributor:{ code:low ? 'receipt_exceeds_consumption' : 'consumption_exceeds_receipt', label:low ? '收货高于消耗' : '消耗高于收货', qty:Math.abs(Number(receipt || 0) - Number(consumption || 0)) }, evidence_gaps:gaps, missing_evidence:gaps.map((item) => item.label), decision_trace:decisionTrace, recommended_action_ids:low ? ['VIEW_RECEIPTS','VIEW_FLOWS','CREATE_SPOT_COUNT'] : ['VIEW_RECEIPTS','VIEW_FLOWS','CREATE_RESTOCK_DRAFT'] };
  const validation = validateDiagnosisCase(result); if (!validation.valid) throw new Error(`Invalid T2 diagnosis case: ${validation.errors.join('; ')}`); return result;
}
