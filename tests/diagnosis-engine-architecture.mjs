import assert from 'node:assert/strict';
import { evaluateDiagnosisSignal, getRuleEngine, SUPPORTED_RULE_CODES } from '../src/diagnosis/index.js';
import { inventoryCasesView, refreshInventoryCases } from '../src/diagnosis/lifecycle/inventory-cases.js';

assert.deepEqual(SUPPORTED_RULE_CODES, ['NEGATIVE_THEORETICAL', 'COUNT_VARIANCE', 'BELOW_SAFETY_STOCK', 'SELL_IN_IMBALANCE']);
for (const code of SUPPORTED_RULE_CODES) assert.equal(typeof getRuleEngine(code)?.evaluate, 'function', `${code} is not registered`);

const signal = (overrides = {}) => ({
  id:'MAT-TEST-1', store_code:'STORE001', business_date:'2026-09-20', material_name:'黑糖珍珠', unit:'g',
  rule_code:'NEGATIVE_THEORETICAL', status:'open', severity:'high', created_at:'2026-09-20T01:00:00.000Z', updated_at:'2026-09-20T01:00:00.000Z',
  evidence:'理论库存为负', evidence_detail:{ opening_qty:12000, receipt_qty:0, transfer_in_qty:0, transfer_out_qty:13000, scrap_qty:0, bom_consumption_qty:90, theoretical_qty:-1090 },
  ...overrides
});

const evaluation = evaluateDiagnosisSignal(signal(), { ledgerSnapshots:[], materialEvents:[], purchaseOrders:[], receiptOrders:[], storeTransferRequests:[], countPolicy:'daily' });
assert.equal(evaluation.rule_family, 'inventory_accuracy');
assert.equal(evaluation.result.anomaly_status, 'triggered');
assert.equal(evaluation.result.fact_packet_id, evaluation.fact_packet.fact_packet_id);
assert.ok(evaluation.result.actions.length > 0, 'runner did not resolve action catalog');

const value = {
  feishuImport:{ latest_business_date:'2026-09-20' }, inventoryCases:[], operationTasks:[],
  materialAnomalies:[
    signal({ id:'MAT-TEA-15', business_date:'2026-09-15', material_name:'茶叶', unit:'kg', rule_code:'BELOW_SAFETY_STOCK', evidence:'低于安全库存' }),
    signal({ id:'MAT-TEA-20', material_name:'茶叶', unit:'kg', rule_code:'BELOW_SAFETY_STOCK', evidence:'仍低于安全库存' })
  ]
};
let view = inventoryCasesView(value, '2026-09-20T02:00:00.000Z');
assert.equal(view.cases.length, 1, 'cross-day observations must merge into one case');
assert.equal(view.cases[0].observation_count, 2);
assert.equal(view.cases[0].opened_business_date, '2026-09-15');
assert.equal(view.cases[0].latest_business_date, '2026-09-20');
assert.equal(view.cases[0].duration_business_days, 6, 'duration must include first and latest business date');
assert.equal(view.cases[0].is_cross_business_day, true);

const base = signal({ id:'MAT-BOBA-20' });
value.materialAnomalies = [base];
value.operationTasks = [{
  id:'OPT-CLOSED', source_anomaly_id:base.id, business_date:'2026-09-20', status:'closed', closed_at:'2026-09-20T08:00:00.000Z',
  latest_diagnosis_run_id:'RUN-RECOVERED', diagnosis_runs:[{ id:'RUN-RECOVERED', anomaly_status:'not_triggered' }]
}];
refreshInventoryCases(value, '2026-09-20T08:00:00.000Z');
assert.equal(value.inventoryCases[0].status, 'closed');

value.feishuImport.latest_business_date = '2026-09-21';
value.materialAnomalies.push(signal({ id:'MAT-BOBA-21', business_date:'2026-09-21', created_at:'2026-09-21T01:00:00.000Z', updated_at:'2026-09-21T01:00:00.000Z' }));
view = inventoryCasesView(value, '2026-09-21T02:00:00.000Z');
assert.equal(view.cases.length, 2, 'post-closure trigger must create a recurrence case');
const recurrence = view.cases.find((item) => item.recurrence_of_case_id);
assert.ok(recurrence, 'recurrence link is missing');
assert.equal(recurrence.opened_business_date, '2026-09-21');
assert.equal(recurrence.status, 'open');

console.log(JSON.stringify({ suite:'diagnosis-engine-architecture', passed:14, registered_rules:SUPPORTED_RULE_CODES, persistent_case:true, recurrence:true, duration_business_days:true }, null, 2));
