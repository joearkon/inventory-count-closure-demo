import assert from 'node:assert/strict';
import { DIAGNOSIS_SCHEMA_VERSION, fact, validateFactPacket } from '../src/diagnosis/contracts.js';

const packet = {
  schema_version: DIAGNOSIS_SCHEMA_VERSION,
  fact_packet_id: 'FACT-QA-D2', store_code: 'STORE001', business_date: '2026-09-15',
  material_name: '黑糖珍珠', unit: 'g', as_of: '2026-09-15T23:59:59.000Z',
  quantities: {
    opening: fact(12000, 'confirmed', '系统有效期初', ['OPENING-001']),
    receipt: fact(0, 'confirmed', '系统收货事件', ['FLOW-RECEIPT-0']),
    transfer_in: fact(0, 'confirmed', '系统调拨事件', ['FLOW-TRANSFER-IN-0']),
    transfer_out: fact(13000, 'confirmed', '系统调拨事件', ['FLOW-TRANSFER-001']),
    scrap: fact(0, 'confirmed', '系统报损事件', ['FLOW-SCRAP-0']),
    count_adjustment: fact(null, 'not_integrated', '盘点调整尚未接入该事实包', []),
    bom_consumption: fact(90, 'confirmed', '销售 BOM', ['BOM-001']),
    theoretical_closing: fact(-1090, 'confirmed', '库存公式', ['BALANCE-001'])
  },
  physical_count: fact(null, 'unknown', '尚无有效实盘', []),
  windows: {
    today: { from: '2026-09-15', to: '2026-09-15', status: 'confirmed' },
    three_days: { from: '2026-09-13', to: '2026-09-15', status: 'partial' },
    seven_days: { from: '2026-09-09', to: '2026-09-15', status: 'partial' }
  }
};

assert.deepEqual(validateFactPacket(packet), { valid: true, errors: [] });
assert.equal(packet.quantities.receipt.value, 0, 'confirmed zero must remain different from missing data');
assert.equal(packet.quantities.count_adjustment.value, null);
assert.equal(packet.quantities.count_adjustment.status, 'not_integrated');

const invalid = structuredClone(packet);
invalid.quantities.receipt = fact(null, 'confirmed', 'invalid fixture', []);
const result = validateFactPacket(invalid);
assert.equal(result.valid, false);
assert(result.errors.some((item) => item.includes('quantities.receipt.value')));

console.log(JSON.stringify({ suite:'diagnosis-contracts', passed:4, schema_version:DIAGNOSIS_SCHEMA_VERSION }, null, 2));
