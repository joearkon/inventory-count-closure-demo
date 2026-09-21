export const INVENTORY_AI_PROMPT_VERSION = 'inventory-ai-analysis-v1.0';

export const INVENTORY_AI_RULES = Object.freeze([
  '事实、推断、未知必须分开书写，不得把缺失记录等同于业务没有发生。',
  '不得编造数量、单据、时间、人员或系统能力；缺失信息必须明确列为待核实。',
  '至少提出两个相互竞争的原因假设，并分别列出支持证据、反证和可证伪检查。',
  '先检查数据质量、单位和重复流水，再检查收货、调拨、盘点、报损、BOM 与真实损耗。',
  '同时评估库存准确性、缺货销售影响、资金占用和门店执行成本，不只解释公式。',
  '下一步按信息增益和业务影响排序，优先推荐能最快排除最多假设的动作。',
  '动作必须能落到现有系统能力或明确的人工核实对象，不给空泛建议。',
  '允许挑战规则引擎结论，但必须指出冲突事实以及需要补充的证据。',
  'AI 只提供建议，不自动写库存、不自动定责、不自动关闭工单。',
  '结论必须绑定规则版本、事实快照和模型版本；事实变化后原结论应视为过期。'
]);

const outputContract = {
  agreement: 'agree | partial | disagree | insufficient',
  summary: '不超过120字的管理结论',
  hypotheses: [{ title:'原因假设', confidence:'high | medium | low', supporting_evidence:['事实'], contradicting_evidence:['反证或空数组'], missing_evidence:['缺失项'], falsification_test:'怎样证伪' }],
  recommended_steps: [{ priority:1, action:'具体动作', owner:'责任角色', reason:'为什么先做', system_entry:'已有入口或人工核实' }],
  store_questions: ['向门店提出的精确问题'],
  risks: ['若不处理的经营或数据风险'],
  rule_challenge: '对规则结论的补充或质疑'
};

export function buildInventoryAiMessages({ inventoryCase, evaluation, related = {} }) {
  return [
    {
      role:'system',
      content:[
        '你是连锁餐饮库存闭环的高级诊断 Agent。你的价值不是复述规则，而是基于可追溯事实形成可证伪、可执行的调查方案。',
        `必须遵守以下规则（${INVENTORY_AI_PROMPT_VERSION}）：`,
        ...INVENTORY_AI_RULES.map((rule, index) => `${index + 1}. ${rule}`),
        '只输出合法 JSON，不要输出 Markdown。输出结构：',
        JSON.stringify(outputContract)
      ].join('\n')
    },
    {
      role:'user',
      content:JSON.stringify({
        task:'对该库存持续问题做一次深度研判，并给出最小验证路径。',
        inventory_case:inventoryCase,
        structured_rule:evaluation,
        related_records:related
      })
    }
  ];
}

export function normalizeInventoryAiResult(raw = {}) {
  const allowedAgreement = new Set(['agree', 'partial', 'disagree', 'insufficient']);
  const text = (value, max = 600) => String(value || '').trim().slice(0, max);
  const list = (value, maxItems = 8, maxText = 300) => (Array.isArray(value) ? value : []).slice(0, maxItems).map((item) => text(item, maxText)).filter(Boolean);
  return {
    agreement:allowedAgreement.has(raw.agreement) ? raw.agreement : 'insufficient',
    summary:text(raw.summary, 800) || 'AI 未形成足够可靠的结论。',
    hypotheses:(Array.isArray(raw.hypotheses) ? raw.hypotheses : []).slice(0, 6).map((item) => ({
      title:text(item?.title, 160), confidence:['high', 'medium', 'low'].includes(item?.confidence) ? item.confidence : 'low',
      supporting_evidence:list(item?.supporting_evidence), contradicting_evidence:list(item?.contradicting_evidence),
      missing_evidence:list(item?.missing_evidence), falsification_test:text(item?.falsification_test, 500)
    })).filter((item) => item.title),
    recommended_steps:(Array.isArray(raw.recommended_steps) ? raw.recommended_steps : []).slice(0, 8).map((item, index) => ({
      priority:Number.isFinite(Number(item?.priority)) ? Number(item.priority) : index + 1,
      action:text(item?.action, 300), owner:text(item?.owner, 100), reason:text(item?.reason, 400), system_entry:text(item?.system_entry, 200)
    })).filter((item) => item.action).sort((left, right) => left.priority - right.priority),
    store_questions:list(raw.store_questions, 8, 300), risks:list(raw.risks, 8, 300), rule_challenge:text(raw.rule_challenge, 800)
  };
}
