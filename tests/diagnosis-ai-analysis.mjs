import assert from 'node:assert/strict';
import { INVENTORY_AI_PROMPT_VERSION, INVENTORY_AI_RULES, buildInventoryAiMessages, normalizeInventoryAiResult } from '../src/diagnosis/ai/prompt.js';

assert.equal(INVENTORY_AI_PROMPT_VERSION, 'inventory-ai-analysis-v1.0');
assert.ok(INVENTORY_AI_RULES.length >= 10);
const messages = buildInventoryAiMessages({ inventoryCase:{ id:'ICS-1' }, evaluation:{ result:{ anomaly_status:'triggered' } }, related:{} });
assert.equal(messages.length, 2);
assert.match(messages[0].content, /竞争/);
assert.match(messages[0].content, /不得编造/);
const normalized = normalizeInventoryAiResult({
  agreement:'partial', summary:'存在两种可能。',
  hypotheses:[{ title:'漏记收货', confidence:'high', supporting_evidence:['无入库流水'], contradicting_evidence:['缺少原始收货单'], missing_evidence:['签收凭证'], falsification_test:'核对签收单' }],
  recommended_steps:[{ priority:1, action:'核对签收单', owner:'门店', reason:'信息增益最高', system_entry:'收货管理' }]
});
assert.equal(normalized.agreement, 'partial');
assert.equal(normalized.hypotheses[0].title, '漏记收货');
assert.equal(normalized.recommended_steps[0].priority, 1);
console.log(JSON.stringify({ suite:'diagnosis-ai-analysis', passed:8, prompt_version:INVENTORY_AI_PROMPT_VERSION, rules:INVENTORY_AI_RULES.length }, null, 2));
