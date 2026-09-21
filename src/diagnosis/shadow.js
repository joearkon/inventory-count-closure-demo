import { D2_RULESET } from './d2-engine.js';
import { RULE_REGISTRY, SUPPORTED_RULE_CODES } from './engine/registry.js';
import { evaluateDiagnosisSignal } from './engine/runner.js';

export function buildDiagnosisShadowReport(calculated, materialCatalog = []) {
  const countPolicy = new Map(materialCatalog.map((item) => [String(item.material_name || '').trim().toLowerCase(), item.count_policy || (item.daily_count_enabled === false ? 'optional' : 'daily')]));
  const signals = (calculated.materialAnomalies || []).filter((item) => RULE_REGISTRY[item.rule_code] && !['closed', 'auto_closed'].includes(item.status));
  const comparisons = signals.map((signal) => {
    const evaluation = evaluateDiagnosisSignal(signal, {
      ledgerSnapshots: calculated.ledgerSnapshots || [],
      materialEvents: calculated.materialEvents || [],
      purchaseOrders: calculated.purchaseOrders || [],
      receiptOrders: calculated.receiptOrders || [],
      storeTransferRequests: calculated.storeTransferRequests || [],
      countPolicy: countPolicy.get(String(signal.material_name || '').trim().toLowerCase()) || 'unknown',
      asOf: signal.updated_at || new Date().toISOString()
    });
    return {
      signal_id:signal.id,
      store_code:signal.store_code,
      business_date:signal.business_date,
      material_name:signal.material_name,
      unit:signal.unit,
      v1:{ rule_code:signal.rule_code, evidence:signal.evidence, strategy:signal.strategy, evidence_detail:signal.evidence_detail },
      fact_packet:evaluation.fact_packet,
      v2:evaluation.result
    };
  });
  return {
    mode:'shadow',
    writable:false,
    creates_work_orders:false,
    ruleset:{ ruleset_id:D2_RULESET.ruleset_id, rule_code:'D1_D2_S1_T2', rule_version:D2_RULESET.rule_version, status:'shadow' },
    generated_at:new Date().toISOString(),
    comparison_count:comparisons.length,
    counts_by_rule:Object.fromEntries(SUPPORTED_RULE_CODES.map((code) => [code, comparisons.filter((item) => item.v1.rule_code === code).length])),
    comparisons
  };
}

export const buildD2ShadowReport = buildDiagnosisShadowReport;
