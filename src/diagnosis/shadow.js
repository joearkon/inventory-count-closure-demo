import { buildFactPacket } from './facts.js';
import { D2_ACTIONS, D2_RULESET, evaluateD2 } from './d2-engine.js';
import { D1_RULESET, evaluateD1 } from './d1-engine.js';
import { S1_RULESET, evaluateS1 } from './s1-engine.js';
import { T2_RULESET, evaluateT2 } from './t2-engine.js';

const ENGINES = Object.freeze({
  NEGATIVE_THEORETICAL: { ruleset:D2_RULESET, evaluate:evaluateD2 },
  COUNT_VARIANCE: { ruleset:D1_RULESET, evaluate:evaluateD1 },
  BELOW_SAFETY_STOCK: { ruleset:S1_RULESET, evaluate:evaluateS1 },
  SELL_IN_IMBALANCE: { ruleset:T2_RULESET, evaluate:evaluateT2 }
});

export function buildDiagnosisShadowReport(calculated, materialCatalog = []) {
  const countPolicy = new Map(materialCatalog.map((item) => [String(item.material_name || '').trim().toLowerCase(), item.count_policy || (item.daily_count_enabled === false ? 'optional' : 'daily')]));
  const signals = (calculated.materialAnomalies || []).filter((item) => ENGINES[item.rule_code] && !['closed', 'auto_closed'].includes(item.status));
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
    const engine = ENGINES[signal.rule_code];
    const evaluated = engine.evaluate(packet);
    // Engines may exit early when a rule no longer triggers. Keep identity
    // metadata on every result so recovered snapshots remain auditable.
    const v2 = {
      ...evaluated,
      ruleset_id:evaluated.ruleset_id || engine.ruleset.ruleset_id,
      rule_code:evaluated.rule_code || engine.ruleset.rule_code,
      rule_version:evaluated.rule_version || engine.ruleset.rule_version,
      fact_packet_id:evaluated.fact_packet_id || packet.fact_packet_id
    };
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
    ruleset:{ ruleset_id:D2_RULESET.ruleset_id, rule_code:'D1_D2_S1_T2', rule_version:D2_RULESET.rule_version, status:'shadow' },
    generated_at:new Date().toISOString(),
    comparison_count:comparisons.length,
    counts_by_rule:Object.fromEntries(Object.keys(ENGINES).map((code) => [code, comparisons.filter((item) => item.v1.rule_code === code).length])),
    comparisons
  };
}

export const buildD2ShadowReport = buildDiagnosisShadowReport;
