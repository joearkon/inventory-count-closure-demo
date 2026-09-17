import assert from 'node:assert/strict';
import { fact } from '../src/diagnosis/contracts.js';
import { evaluateD2 } from '../src/diagnosis/d2-engine.js';

const packet = (overrides = {}) => ({
  schema_version:'1.0', fact_packet_id:'FACT-QA-D2', store_code:'STORE001', business_date:'2026-09-15', material_name:'黑糖珍珠', unit:'g', as_of:'2026-09-15T23:59:59.000Z',
  quantities:{
    opening:fact(12000, 'confirmed', 'fixture', ['OPENING-001']), receipt:fact(0, 'confirmed', 'fixture', ['RECEIPT-0']),
    transfer_in:fact(0, 'confirmed', 'fixture', ['TRANSFER-IN-0']), transfer_out:fact(13000, 'confirmed', 'fixture', ['TRANSFER-001']),
    scrap:fact(0, 'confirmed', 'fixture', ['SCRAP-0']), count_adjustment:fact(null, 'not_integrated', 'fixture', []),
    bom_consumption:fact(90, 'confirmed', 'fixture', ['BOM-001']), theoretical_closing:fact(-1090, 'confirmed', 'fixture', ['BALANCE-001']),
    ...(overrides.quantities || {})
  },
  physical_count:overrides.physical_count || fact(null, 'unknown', 'fixture', []),
  data_availability:{ purchase_orders:{status:'not_integrated'}, arrival_receipts:{status:'not_integrated'}, destination_acceptance:{status:'unknown'} },
  count_policy:'daily',
  windows:{ today:{from:'2026-09-15',to:'2026-09-15',status:'confirmed',totals:{}}, three_days:{from:'2026-09-13',to:'2026-09-15',status:'partial',totals:{receipt:0,transfer_in:0},evidence_refs:[]}, seven_days:{from:'2026-09-09',to:'2026-09-15',status:'partial',totals:{},evidence_refs:[]} },
  ...overrides
});

const transferCase = evaluateD2(packet());
assert.equal(transferCase.anomaly_status, 'triggered');
assert.equal(transferCase.largest_contributor.code, 'transfer_out');
assert.equal(transferCase.primary_location, '调拨出库与目标门店签收');
assert.equal(transferCase.physical_status, 'pending_count');
assert.deepEqual(transferCase.recommended_action_ids.slice(0, 3), ['VIEW_TRANSFER', 'VERIFY_DESTINATION_ACCEPTANCE', 'CREATE_SPOT_COUNT']);
assert(transferCase.decision_trace.some((item) => item.node_id === 'D2-BALANCE-001' && item.result === 'matched'));

const counted = evaluateD2(packet({ physical_count:fact(2800, 'confirmed', '盘点', ['COUNT-001']) }));
assert.equal(counted.physical_status, 'confirmed');
assert(!counted.missing_evidence.includes('当前有效实盘'));

const normal = evaluateD2(packet({ quantities:{ transfer_out:fact(1000, 'confirmed', 'fixture', ['TRANSFER-002']), theoretical_closing:fact(10910, 'confirmed', 'fixture', ['BALANCE-002']) } }));
assert.equal(normal.anomaly_status, 'not_triggered');
assert.deepEqual(normal.recommended_action_ids, []);

console.log(JSON.stringify({ suite:'diagnosis-v2-d2', passed:9, primary_location:transferCase.primary_location, trace_nodes:transferCase.decision_trace.length }, null, 2));
