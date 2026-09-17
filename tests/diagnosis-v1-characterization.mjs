import assert from 'node:assert/strict';
import { r2DiagnosisWorkOrderCopy, r2ReconcileMaterialDiagnosis } from '../src/worker.js';

const baseRow = (overrides = {}) => ({
  material_name: '测试物料', unit: 'kg', opening_qty: 10,
  receipt_qty: 0, transfer_in_qty: 0, transfer_out_qty: 0,
  scrap_qty: 0, bom_consumption_qty: 1, theoretical_closing_qty: 9,
  actual_inventory_qty: null, actual_inventory_at: null,
  actual_inventory_document_id: null, safety_qty: null,
  baseline_source: 'V1 characterization fixture',
  receipt_evidence_status: 'no_record',
  receipt_evidence_note: '当前未找到收货流水，不能直接判定为未收货',
  industry_profile: { code: 'GEN', absolute_tolerance: { kg: 0.1 }, relative_tolerance: 0.03 },
  ...overrides
});

function diagnose(row) {
  const state = { materialAnomalies: [] };
  return r2ReconcileMaterialDiagnosis(state, [row], '2026-09-15', 'STORE001', 'QA-V1', '2026-09-17T00:00:00.000Z')[0];
}

const d2 = diagnose(baseRow({
  material_name: '黑糖珍珠', unit: 'g', opening_qty: 12000,
  transfer_out_qty: 13000, bom_consumption_qty: 90,
  theoretical_closing_qty: -1090,
  industry_profile: { code: 'WEIGHT', absolute_tolerance: { g: 50 }, relative_tolerance: 0.03 }
}));
assert.equal(d2.rule_code, 'NEGATIVE_THEORETICAL');
assert.equal(d2.evidence_detail.opening_qty, 12000);
assert.equal(d2.evidence_detail.transfer_out_qty, 13000);
assert.equal(d2.evidence_detail.bom_consumption_qty, 90);
assert.equal(d2.evidence_detail.theoretical_qty, -1090);

const d1 = diagnose(baseRow({ actual_inventory_qty: 5, theoretical_closing_qty: 9 }));
assert.equal(d1.rule_code, 'COUNT_VARIANCE');

const s1 = diagnose(baseRow({ safety_qty: 12, theoretical_closing_qty: 9 }));
assert.equal(s1.rule_code, 'BELOW_SAFETY_STOCK');

const t2 = diagnose(baseRow({ receipt_qty: 1, bom_consumption_qty: 3, theoretical_closing_qty: 12 }));
assert.equal(t2.rule_code, 'SELL_IN_IMBALANCE');

const priority = diagnose(baseRow({
  theoretical_closing_qty: -1, actual_inventory_qty: 8, safety_qty: 12,
  receipt_qty: 1, bom_consumption_qty: 3
}));
assert.equal(priority.rule_code, 'NEGATIVE_THEORETICAL');

const copy = r2DiagnosisWorkOrderCopy(d2);
assert.equal(copy.taskType, 'diagnosis_negative_inventory');
assert.match(copy.title, /黑糖珍珠/);
assert.match(copy.instruction, /调拨出库/);
assert.match(copy.instruction, /收货/);

console.log(JSON.stringify({
  suite: 'diagnosis-v1-characterization',
  passed: 6,
  locked: {
    priority: ['NEGATIVE_THEORETICAL', 'COUNT_VARIANCE', 'BELOW_SAFETY_STOCK', 'SELL_IN_IMBALANCE'],
    d2_fixture: {
      opening_qty: d2.evidence_detail.opening_qty,
      transfer_out_qty: d2.evidence_detail.transfer_out_qty,
      bom_consumption_qty: d2.evidence_detail.bom_consumption_qty,
      theoretical_qty: d2.evidence_detail.theoretical_qty
    },
    work_order_copy: copy
  }
}, null, 2));
