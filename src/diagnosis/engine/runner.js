import { resolveDiagnosisActions } from '../actions.js';
import { buildFactPacket } from '../facts.js';
import { getRuleEngine } from './registry.js';

export function evaluateRulePacket(ruleCode, factPacket) {
  const engine = getRuleEngine(ruleCode);
  if (!engine) throw new Error(`Unsupported diagnosis rule: ${ruleCode}`);
  const evaluated = engine.evaluate(factPacket);
  return {
    ...evaluated,
    ruleset_id:evaluated.ruleset_id || engine.ruleset.ruleset_id,
    rule_code:evaluated.rule_code || engine.ruleset.rule_code,
    rule_version:evaluated.rule_version || engine.ruleset.rule_version,
    fact_packet_id:evaluated.fact_packet_id || factPacket.fact_packet_id,
    actions:resolveDiagnosisActions(evaluated.recommended_action_ids || [])
  };
}

export function evaluateDiagnosisSignal(signal, context = {}) {
  const engine = getRuleEngine(signal?.rule_code);
  if (!engine) return null;
  const factPacket = buildFactPacket(signal, context);
  return {
    signal_id:signal.id,
    store_code:signal.store_code,
    business_date:signal.business_date,
    material_name:signal.material_name,
    unit:signal.unit,
    rule_family:engine.family,
    ruleset:engine.ruleset,
    fact_packet:factPacket,
    result:evaluateRulePacket(signal.rule_code, factPacket)
  };
}
