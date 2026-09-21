import { D1_RULESET, evaluateD1 } from '../d1-engine.js';
import { D2_RULESET, evaluateD2 } from '../d2-engine.js';
import { S1_RULESET, evaluateS1 } from '../s1-engine.js';
import { T2_RULESET, evaluateT2 } from '../t2-engine.js';

export const RULE_REGISTRY = Object.freeze({
  NEGATIVE_THEORETICAL: Object.freeze({ family:'inventory_accuracy', ruleset:D2_RULESET, evaluate:evaluateD2 }),
  COUNT_VARIANCE: Object.freeze({ family:'inventory_accuracy', ruleset:D1_RULESET, evaluate:evaluateD1 }),
  BELOW_SAFETY_STOCK: Object.freeze({ family:'supply_risk', ruleset:S1_RULESET, evaluate:evaluateS1 }),
  SELL_IN_IMBALANCE: Object.freeze({ family:'replenishment_balance', ruleset:T2_RULESET, evaluate:evaluateT2 })
});

export const SUPPORTED_RULE_CODES = Object.freeze(Object.keys(RULE_REGISTRY));

export function getRuleEngine(ruleCode) {
  return RULE_REGISTRY[ruleCode] || null;
}
