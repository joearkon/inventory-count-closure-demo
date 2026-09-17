import { validateDiagnosisCase } from './contracts.js';

export const S1_RULESET = Object.freeze({ ruleset_id:'inventory-diagnosis-20260917-v1', rule_code:'S1_SAFETY_STOCK', rule_version:'1.0.0-shadow', status:'shadow' });
const trace = (nodeId, type, result, message, evidenceRefs = []) => ({ node_id:nodeId, type, result, message, evidence_refs:evidenceRefs });
const quantity = (packet, key) => packet.quantities[key]?.status === 'confirmed' ? Number(packet.quantities[key].value) : null;
const metric = (packet, key) => packet.metrics?.[key]?.status === 'confirmed' ? Number(packet.metrics[key].value) : null;

export function evaluateS1(packet) {
  const theoretical = quantity(packet, 'theoretical_closing'), safety = metric(packet, 'safety_stock'), decisionTrace = [];
  if (theoretical == null || safety == null) return { anomaly_status:'rule_error', cause_evidence_status:'insufficient', physical_status:packet.physical_count.status === 'confirmed' ? 'confirmed' : 'pending_count', decision_trace:[trace('S1-INPUT-001','require_evidence','missing','缺少理论库存或安全库存配置，无法执行 S1。')], recommended_action_ids:[] };
  const triggered = theoretical < safety;
  decisionTrace.push(trace('S1-TRIGGER-001','condition',triggered,`理论库存 ${theoretical}${packet.unit}，${triggered ? '低于' : '不低于'}安全库存 ${safety}${packet.unit}。`, packet.quantities.theoretical_closing.evidence_refs));
  if (!triggered) return { anomaly_status:'not_triggered', cause_evidence_status:'excluded', physical_status:packet.physical_count.status === 'confirmed' ? 'confirmed' : 'pending_count', decision_trace:decisionTrace, recommended_action_ids:[] };
  const counted = packet.physical_count.status === 'confirmed', shortage = safety - theoretical;
  const countAligned = counted && Math.abs(Number(packet.physical_count.value) - theoretical) <= (metric(packet, 'variance_threshold') || 0);
  decisionTrace.push(trace('S1-COUNT-001','condition',countAligned ? 'aligned' : counted ? 'mismatch' : 'missing',countAligned ? `实盘 ${packet.physical_count.value}${packet.unit} 与理论库存一致，低库存为真实状态。` : counted ? `实盘 ${packet.physical_count.value}${packet.unit} 与理论库存仍有差异，补货前需先复核。` : '尚无有效实盘，补货前建议确认现场库存。', packet.physical_count.evidence_refs));
  const gaps = [];
  if (packet.data_availability.purchase_orders.status !== 'confirmed') gaps.push({ code:'purchase_orders', label:'订货与在途记录', state:packet.data_availability.purchase_orders.status, explanation:packet.data_availability.purchase_orders.note });
  const result = { case_id:`V2-${packet.fact_packet_id}`, ruleset_id:S1_RULESET.ruleset_id, rule_code:S1_RULESET.rule_code, rule_version:S1_RULESET.rule_version, fact_packet_id:packet.fact_packet_id, anomaly_status:'triggered', cause_evidence_status:countAligned ? 'suspect' : 'insufficient', physical_status:counted ? 'confirmed' : 'pending_count', primary_location:'补货与调拨安排', primary_hypothesis:`当前距安全库存缺口 ${shortage}${packet.unit}；${countAligned ? '实盘已确认缺口，优先检查在途并安排补货或调拨。' : '先确认现场库存，再决定补货或调拨。'}`, largest_contributor:{ code:'safety_shortage', label:'安全库存缺口', qty:shortage }, evidence_gaps:gaps, missing_evidence:gaps.map((item) => item.label), decision_trace:decisionTrace, recommended_action_ids:['VIEW_PURCHASE','CREATE_RESTOCK_DRAFT','VIEW_TRANSFER','VIEW_FLOWS'] };
  const validation = validateDiagnosisCase(result); if (!validation.valid) throw new Error(`Invalid S1 diagnosis case: ${validation.errors.join('; ')}`); return result;
}
