import assert from 'node:assert/strict';
import { fact } from '../src/diagnosis/contracts.js';
import { evaluateD1 } from '../src/diagnosis/d1-engine.js';
import { evaluateS1 } from '../src/diagnosis/s1-engine.js';
import { evaluateT2 } from '../src/diagnosis/t2-engine.js';

const base = (overrides = {}) => ({
  schema_version:'1.0', fact_packet_id:'FACT-QA', store_code:'STORE001', business_date:'2026-09-15', material_name:'测试物料', unit:'L', as_of:'2026-09-15T23:59:59.000Z',
  quantities:{ opening:fact(120,'confirmed'), receipt:fact(10,'confirmed'), transfer_in:fact(0,'confirmed'), transfer_out:fact(0,'confirmed'), scrap:fact(0,'confirmed'), count_adjustment:fact(null,'not_integrated'), bom_consumption:fact(0,'confirmed'), theoretical_closing:fact(130,'confirmed') },
  physical_count:fact(155,'confirmed','盘点',['COUNT-1']),
  metrics:{ physical_delta:fact(25,'confirmed'), variance_threshold:fact(3.9,'confirmed'), safety_stock:fact(60,'confirmed'), sell_in_ratio:fact(0,'confirmed') },
  data_availability:{ purchase_orders:{status:'partial',note:'历史覆盖不完整'}, arrival_receipts:{status:'partial',note:'未关联正式收货单'}, destination_acceptance:{status:'not_applicable'} },
  windows:{ today:{status:'confirmed',totals:{}}, three_days:{status:'partial',totals:{}}, seven_days:{status:'partial',totals:{}} }, ...overrides
});

const d1 = evaluateD1(base());
assert.equal(d1.anomaly_status, 'triggered');
assert.equal(d1.primary_location, '收货记录与盘点口径');
assert.equal(d1.largest_contributor.qty, 25);
assert(d1.recommended_action_ids.includes('VIEW_RECEIPTS'));

const s1 = evaluateS1(base({ unit:'kg', quantities:{ ...base().quantities, theoretical_closing:fact(1.74,'confirmed') }, physical_count:fact(1.74,'confirmed','盘点',['COUNT-2']), metrics:{ ...base().metrics, physical_delta:fact(0,'confirmed'), variance_threshold:fact(0.1,'confirmed'), safety_stock:fact(2,'confirmed') } }));
assert.equal(s1.anomaly_status, 'triggered');
assert.equal(s1.primary_location, '补货与调拨安排');
assert.equal(s1.physical_status, 'confirmed');
assert(s1.primary_hypothesis.includes('0.26kg'));

const t2 = evaluateT2(base({ unit:'g', quantities:{ ...base().quantities, receipt:fact(10000,'confirmed'), bom_consumption:fact(390,'confirmed'), theoretical_closing:fact(27610,'confirmed') }, physical_count:fact(null,'unknown'), metrics:{ ...base().metrics, physical_delta:fact(null,'unknown'), sell_in_ratio:fact(0.039,'confirmed') } }));
assert.equal(t2.anomaly_status, 'triggered');
assert.equal(t2.primary_location, '收货批量与销售消耗衔接');
assert.equal(t2.physical_status, 'pending_count');
assert(t2.primary_hypothesis.includes('10000g'));

console.log(JSON.stringify({ suite:'diagnosis-v2-other-rules', passed:12, rules:['D1','S1','T2'] }, null, 2));
