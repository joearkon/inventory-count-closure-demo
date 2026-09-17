import { buildFactPacket } from './facts.js';
import { D2_ACTIONS, D2_RULESET, evaluateD2 } from './d2-engine.js';

export function buildD2ShadowReport(calculated, materialCatalog = []) {
  const countPolicy = new Map(materialCatalog.map((item) => [String(item.material_name || '').trim().toLowerCase(), item.count_policy || (item.daily_count_enabled === false ? 'optional' : 'daily')]));
  const signals = (calculated.materialAnomalies || []).filter((item) => item.rule_code === 'NEGATIVE_THEORETICAL' && !['closed', 'auto_closed'].includes(item.status));
  const comparisons = signals.map((signal) => {
    const packet = buildFactPacket(signal, {
      ledgerSnapshots: calculated.ledgerSnapshots || [],
      materialEvents: calculated.materialEvents || [],
      purchaseOrders: calculated.purchaseOrders || [],
      receiptOrders: calculated.receiptOrders || [],
      storeTransferRequests: calculated.storeTransferRequests || [],
      countPolicy: countPolicy.get(String(signal.material_name || '').trim().toLowerCase()) || 'unknown',
      asOf: signal.updated_at || new Date().toISOString()
    });
    const v2 = evaluateD2(packet);
    return {
      signal_id:signal.id,
      store_code:signal.store_code,
      business_date:signal.business_date,
      material_name:signal.material_name,
      unit:signal.unit,
      v1:{ rule_code:signal.rule_code, evidence:signal.evidence, strategy:signal.strategy, evidence_detail:signal.evidence_detail },
      fact_packet:packet,
      v2:{ ...v2, actions:v2.recommended_action_ids.map((id) => D2_ACTIONS[id]).filter(Boolean) }
    };
  });
  return {
    mode:'shadow',
    writable:false,
    creates_work_orders:false,
    ruleset:D2_RULESET,
    generated_at:new Date().toISOString(),
    comparison_count:comparisons.length,
    comparisons
  };
}
