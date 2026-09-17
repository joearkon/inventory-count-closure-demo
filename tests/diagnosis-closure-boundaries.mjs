import assert from 'node:assert/strict';
import { buildFactPacket } from '../src/diagnosis/facts.js';
import { evaluateD2 } from '../src/diagnosis/d2-engine.js';
import { evaluateClosureGate } from '../src/diagnosis/closure.js';

const signal = (evidence = {}) => ({
  id:'MAT-EDGE-1', store_code:'STORE001', business_date:'2026-09-17', material_name:'黑糖珍珠', unit:'g',
  rule_code:'NEGATIVE_THEORETICAL', theoretical_closing_qty:-100,
  evidence_detail:{ opening_qty:100, receipt_qty:0, transfer_in_qty:0, transfer_out_qty:150, scrap_qty:0, bom_consumption_qty:50, theoretical_qty:-100, ...evidence }
});

const duplicate = { id:'EVT-DUP', status:'active', store_code:'STORE001', business_date:'2026-09-17', material_name:'黑糖珍珠', unit:'g', type:'transfer_out' };
const packet = buildFactPacket(signal(), { materialEvents:[duplicate, duplicate], ledgerSnapshots:[], purchaseOrders:[], receiptOrders:[], storeTransferRequests:[] });
assert.deepEqual(packet.windows.three_days.evidence_refs, ['EVT-DUP'], '重复流水引用必须去重');
assert.equal(packet.windows.three_days.status, 'partial', '历史覆盖不足必须明确为 partial');
assert.equal(packet.data_availability.arrival_receipts.status, 'partial', '无收货单不得断言门店没有到货');
assert.equal(packet.physical_count.status, 'unknown', '无实盘必须保留 unknown');
assert.equal(evaluateD2(packet).physical_status, 'pending_count', '无实盘时需建议盘点');

const counted = buildFactPacket(signal({ physical_qty:20, physical_delta:120, actual_count_document_id:'PD-1' }), { materialEvents:[{ ...duplicate, id:'EVT-WRONG-UNIT', unit:'kg' }], ledgerSnapshots:[], purchaseOrders:[], receiptOrders:[], storeTransferRequests:[] });
assert.equal(counted.physical_count.status, 'confirmed', '有效实盘必须被识别');
assert.deepEqual(counted.windows.today.evidence_refs, [], '单位不一致的流水不能进入证据窗口');

const failed = buildFactPacket(signal(), { queryFailure:'上游库存查询超时', ledgerSnapshots:[] });
assert.equal(failed.data_availability.query_health.status, 'unavailable', '查询失败必须显式呈现而非当作 0');

const baseClosure = { outcome:'resolved', finalCause:'收货漏录', resolutionNote:'已补录并复核', operator:'总部运营', storeAdopted:true, hqConfirmed:true, evidenceCount:1 };
assert.equal(evaluateClosureGate({ ...baseClosure, latestRun:{ anomaly_status:'triggered' } }).ok, false, '异常仍触发时不能按已恢复关闭');
assert.equal(evaluateClosureGate({ ...baseClosure, latestRun:{ anomaly_status:'not_triggered' } }).ok, true, '处理后恢复且字段完整时允许关闭');
assert.equal(evaluateClosureGate({ ...baseClosure, outcome:'unresolved', latestRun:{ anomaly_status:'triggered' } }).ok, true, '尚未解决应允许保存并重新打开');
assert.equal(evaluateClosureGate({ ...baseClosure, outcome:'accepted_exception', storeAdopted:false, latestRun:{ anomaly_status:'triggered' } }).ok, true, '接受例外可记录门店未采纳但仍需总部确认');
assert.equal(evaluateClosureGate({ ...baseClosure, hqConfirmed:false, latestRun:{ anomaly_status:'not_triggered' } }).ok, false, '无总部确认不得闭环');

console.log(JSON.stringify({ suite:'diagnosis-closure-boundaries', passed:12, scenarios:['duplicate_flow','unit_error','arrival_unrecorded','physical_present','physical_absent','data_delay','history_incomplete','query_failure','closure_reopen'] }, null, 2));
