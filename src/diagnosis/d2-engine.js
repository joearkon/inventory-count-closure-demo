import { validateDiagnosisCase } from './contracts.js';

export const D2_RULESET = Object.freeze({
  ruleset_id: 'inventory-diagnosis-20260917-v1',
  rule_code: 'D2_NEGATIVE_STOCK',
  rule_version: '1.0.0-shadow',
  status: 'shadow'
});

export const D2_ACTIONS = Object.freeze({
  VIEW_PURCHASE: { action_id:'VIEW_PURCHASE', label:'查看订货与在途', mode:'link', route:'/purchase-orders/', requires_confirmation:false },
  VIEW_RECEIPTS: { action_id:'VIEW_RECEIPTS', label:'查看收货单', mode:'link', route:'/receipt-orders/', requires_confirmation:false },
  VIEW_TRANSFER: { action_id:'VIEW_TRANSFER', label:'查看调拨单', mode:'link', route:'/transfers/', requires_confirmation:false },
  VERIFY_DESTINATION_ACCEPTANCE: { action_id:'VERIFY_DESTINATION_ACCEPTANCE', label:'核对目标门店签收', mode:'manual', route:null, requires_confirmation:true },
  CREATE_SPOT_COUNT: { action_id:'CREATE_SPOT_COUNT', label:'下发单物料临时盘点', mode:'link', route:'/count-plans/?source=work_order', requires_confirmation:true },
  VIEW_FLOWS: { action_id:'VIEW_FLOWS', label:'查看相关库存流水', mode:'link', route:'/flows/', requires_confirmation:false },
  CREATE_RECEIPT_DRAFT: { action_id:'CREATE_RECEIPT_DRAFT', label:'建立收货补录草稿', mode:'draft', route:'/receipt-orders/#create', requires_confirmation:true },
  CREATE_RESTOCK_DRAFT: { action_id:'CREATE_RESTOCK_DRAFT', label:'建立紧急补货草稿', mode:'draft', route:'/purchase-orders/?urgency=urgent#create', requires_confirmation:true }
});

const value = (packet, key) => packet.quantities[key]?.status === 'confirmed' ? Number(packet.quantities[key].value) : null;
const trace = (nodeId, type, result, message, evidenceRefs = []) => ({ node_id:nodeId, type, result, message, evidence_refs:evidenceRefs });

export function evaluateD2(packet) {
  const unit = packet.unit;
  const tolerance = ({ g:50, kg:0.05, L:0.1, '个':1 })[unit] ?? 0;
  const theoretical = value(packet, 'theoretical_closing');
  const decisionTrace = [];
  if (theoretical == null) {
    decisionTrace.push(trace('D2-INPUT-001', 'require_evidence', 'missing', '理论期末不可用，无法执行 D2。'));
    return { anomaly_status:'rule_error', cause_evidence_status:'insufficient', physical_status:'insufficient', decision_trace:decisionTrace, recommended_action_ids:[] };
  }
  const triggered = theoretical < -tolerance;
  decisionTrace.push(trace('D2-TRIGGER-001', 'condition', triggered, triggered ? `理论期末 ${theoretical}${unit} 低于负库存容忍值 ${-tolerance}${unit}。` : `理论期末 ${theoretical}${unit} 未低于负库存容忍值 ${-tolerance}${unit}。`, packet.quantities.theoretical_closing.evidence_refs));
  if (!triggered) return { anomaly_status:'not_triggered', cause_evidence_status:'excluded', physical_status:packet.physical_count.status === 'confirmed' ? 'confirmed' : 'pending_count', decision_trace:decisionTrace, recommended_action_ids:[] };

  const expected = value(packet, 'opening') + value(packet, 'receipt') + value(packet, 'transfer_in') - value(packet, 'transfer_out') - value(packet, 'scrap') - value(packet, 'bom_consumption');
  const balanceMatches = Math.abs(expected - theoretical) < 0.0001;
  decisionTrace.push(trace('D2-BALANCE-001', 'calculate', balanceMatches ? 'matched' : 'mismatch', `库存重建：${value(packet, 'opening')} + ${value(packet, 'receipt')} + ${value(packet, 'transfer_in')} - ${value(packet, 'transfer_out')} - ${value(packet, 'scrap')} - ${value(packet, 'bom_consumption')} = ${expected}${unit}。`, [`${packet.fact_packet_id}:balance`]));

  const contributors = [
    { code:'transfer_out', label:'调拨出库', qty:value(packet, 'transfer_out') || 0 },
    { code:'scrap', label:'报损', qty:value(packet, 'scrap') || 0 },
    { code:'bom_consumption', label:'销售 BOM 消耗', qty:value(packet, 'bom_consumption') || 0 }
  ].sort((a, b) => b.qty - a.qty);
  const primary = contributors[0];
  decisionTrace.push(trace('D2-CONTRIBUTOR-001', 'rank', primary.code, `${primary.label} ${primary.qty}${unit} 是本期最大负向贡献项。`, packet.quantities[primary.code].evidence_refs));

  const threeDay = packet.windows.three_days;
  const inbound = Number(threeDay.totals.receipt || 0) + Number(threeDay.totals.transfer_in || 0);
  decisionTrace.push(trace('D2-INBOUND-001', 'condition', inbound > 0 ? 'found' : 'none_found', threeDay.status === 'confirmed' ? `近 3 日已确认入库合计 ${inbound}${unit}。` : `近 3 日当前可见入库合计 ${inbound}${unit}，历史覆盖不完整，不能据此断言门店没有到货或订货。`, threeDay.evidence_refs));

  const counted = packet.physical_count.status === 'confirmed';
  decisionTrace.push(trace('D2-COUNT-001', 'require_evidence', counted ? 'available' : 'missing', counted ? `最近有效实盘为 ${packet.physical_count.value}${unit}。` : '尚无有效实盘，无法确认是否已经影响门店实际可售。', packet.physical_count.evidence_refs));

  let location = '门店收货与库存记录';
  let hypothesis = '优先确认是否存在已到货但尚未入库的收货记录。';
  let actions = ['VIEW_FLOWS', 'CREATE_SPOT_COUNT', 'CREATE_RECEIPT_DRAFT'];
  if (primary.code === 'transfer_out' && primary.qty > 0) {
    location = '调拨出库与目标门店签收';
    hypothesis = `调拨出库 ${primary.qty}${unit} 是负库存第一贡献项，应先核对数量、单位、重复出库及目标门店签收。`;
    actions = ['VIEW_TRANSFER', 'VERIFY_DESTINATION_ACCEPTANCE', 'CREATE_SPOT_COUNT', 'VIEW_FLOWS'];
  } else if (primary.code === 'bom_consumption') {
    location = '销售消耗与补货衔接';
    hypothesis = `销售 BOM 消耗 ${primary.qty}${unit} 是负库存第一贡献项，应核对 BOM 用量、销售同步及入库补充。`;
    actions = ['VIEW_FLOWS', 'CREATE_SPOT_COUNT', 'CREATE_RESTOCK_DRAFT'];
  }
  decisionTrace.push(trace('D2-ACTION-001', 'suggest_action', actions, `按“${location}”顺序生成只读建议动作。`));

  const evidenceGaps = [];
  if (packet.data_availability.purchase_orders.status !== 'confirmed') evidenceGaps.push({ code:'purchase_orders', label:'订货与在途记录', state:packet.data_availability.purchase_orders.status, explanation:packet.data_availability.purchase_orders.note });
  if (primary.code === 'transfer_out' && packet.data_availability.destination_acceptance.status !== 'confirmed') evidenceGaps.push({ code:'destination_acceptance', label:'目标门店签收结果', state:packet.data_availability.destination_acceptance.status, explanation:packet.data_availability.destination_acceptance.note });
  const result = {
    case_id:`V2-${packet.fact_packet_id}`,
    ruleset_id:D2_RULESET.ruleset_id,
    rule_code:D2_RULESET.rule_code,
    rule_version:D2_RULESET.rule_version,
    fact_packet_id:packet.fact_packet_id,
    anomaly_status:'triggered',
    cause_evidence_status:primary.qty > 0 ? 'suspect' : 'insufficient',
    physical_status:counted ? 'confirmed' : 'pending_count',
    primary_location:location,
    primary_hypothesis:hypothesis,
    largest_contributor:primary,
    evidence_gaps:[...(!counted ? [{ code:'physical_count', label:'当前有效实盘', state:'not_found', explanation:'尚无有效实盘，无法确认是否影响门店实际可售' }] : []), ...evidenceGaps],
    missing_evidence:[...(!counted ? ['当前有效实盘'] : []), ...evidenceGaps.map((item) => item.label)],
    decision_trace:decisionTrace,
    recommended_action_ids:actions
  };
  const validation = validateDiagnosisCase(result);
  if (!validation.valid) throw new Error(`Invalid diagnosis case: ${validation.errors.join('; ')}`);
  return result;
}
