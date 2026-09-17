import { DIAGNOSIS_SCHEMA_VERSION, fact, validateFactPacket } from './contracts.js';

const number = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
const day = (date, offset) => {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + offset);
  return value.toISOString().slice(0, 10);
};
const sameMaterial = (left, right) => String(left || '').trim().toLowerCase() === String(right || '').trim().toLowerCase();

function procurementAvailability(signal, context) {
  const matchLine = (line) => sameMaterial(line.material_name, signal.material_name) && line.unit === signal.unit;
  const purchases = (context.purchaseOrders || []).filter((order) => order.store_code === signal.store_code && order.business_date <= signal.business_date && order.status !== 'cancelled' && (order.lines || []).some(matchLine));
  const receipts = (context.receiptOrders || []).filter((receipt) => receipt.store_code === signal.store_code && receipt.business_date <= signal.business_date && receipt.status === 'received' && (receipt.lines || []).some(matchLine));
  return {
    purchase_orders: purchases.length
      ? { status:'confirmed', record_count:purchases.length, note:`已找到 ${purchases.length} 张相关订货/在途单据` }
      : { status:'partial', record_count:0, note:'订货功能已接入，但该历史营业日未找到相关单据；上线前存量数据未完整迁移' },
    arrival_receipts: receipts.length
      ? { status:'confirmed', record_count:receipts.length, note:`已找到 ${receipts.length} 张已确认收货单` }
      : { status:'partial', record_count:0, note:'收货功能已接入，当日库存流水为 0；历史到货凭证覆盖仍不完整' }
  };
}

function destinationAcceptanceAvailability(signal, context) {
  const outbound = (context.materialEvents || []).filter((event) => event.status === 'active' && event.type === 'transfer_out' && event.store_code === signal.store_code && event.business_date === signal.business_date && sameMaterial(event.material_name, signal.material_name) && event.unit === signal.unit);
  if (!outbound.length) return { status:'not_applicable', record_count:0, note:'当前异常没有对应调拨出库流水' };
  const linkedOrderIds = new Set(outbound.map((event) => event.transfer_order_id).filter(Boolean));
  const requests = (context.storeTransferRequests || []).filter((request) => linkedOrderIds.has(request.parent_order_id) && sameMaterial(request.material_name, signal.material_name) && request.unit === signal.unit);
  if (!linkedOrderIds.size || !requests.length) return { status:'unlinked', record_count:0, note:'已找到调拨出库流水，但未关联可核对的调拨单与目标门店签收记录' };
  const received = requests.filter((request) => request.status === 'received');
  if (received.length === requests.length) return { status:'confirmed', record_count:received.length, note:`${received.length} 笔目标门店签收均已确认` };
  return { status:'pending', record_count:received.length, total_count:requests.length, note:`${requests.length} 笔目标门店签收中，${received.length} 笔已确认、${requests.length - received.length} 笔待确认` };
}

function windowSummary(signal, context, days) {
  const to = signal.business_date;
  const from = day(to, -(days - 1));
  const unit = signal.unit;
  const totals = { receipt: 0, transfer_in: 0, transfer_out: 0, scrap: 0, bom_consumption: 0 };
  let historicalDays = 0;
  for (const snapshot of context.ledgerSnapshots || []) {
    if (snapshot.store_code !== signal.store_code || snapshot.business_date < from || snapshot.business_date >= to) continue;
    const row = (snapshot.lines || []).find((item) => sameMaterial(item.material_name, signal.material_name) && item.unit === unit);
    if (!row) continue;
    historicalDays += 1;
    totals.receipt += number(row.receipt_qty); totals.transfer_in += number(row.transfer_in_qty);
    totals.transfer_out += number(row.transfer_out_qty); totals.scrap += number(row.scrap_qty);
    totals.bom_consumption += number(row.bom_consumption_qty);
  }
  const current = signal.evidence_detail || {};
  totals.receipt += number(current.receipt_qty); totals.transfer_in += number(current.transfer_in_qty);
  totals.transfer_out += number(current.transfer_out_qty); totals.scrap += number(current.scrap_qty);
  totals.bom_consumption += number(current.bom_consumption_qty);
  const eventIds = (context.materialEvents || []).filter((event) => event.status === 'active' && event.store_code === signal.store_code && event.business_date >= from && event.business_date <= to && sameMaterial(event.material_name, signal.material_name) && event.unit === unit).map((event) => event.id);
  return { from, to, status: historicalDays >= days - 1 ? 'confirmed' : days === 1 ? 'confirmed' : 'partial', historical_days: historicalDays, totals, evidence_refs: eventIds };
}

export function buildFactPacket(signal, context = {}) {
  const info = signal.evidence_detail || {};
  const source = `V1 signal ${signal.id}`;
  const physicalKnown = info.physical_qty != null;
  const procurement = procurementAvailability(signal, context);
  const packet = {
    schema_version: DIAGNOSIS_SCHEMA_VERSION,
    fact_packet_id: `FACT-${signal.id}`,
    store_code: signal.store_code,
    business_date: signal.business_date,
    material_name: signal.material_name,
    unit: signal.unit,
    as_of: context.asOf || signal.updated_at || signal.created_at || new Date().toISOString(),
    quantities: {
      opening: fact(number(info.opening_qty), 'confirmed', info.opening_source || source, [`${signal.id}:opening`]),
      receipt: fact(number(info.receipt_qty), 'confirmed', info.receipt_note || '系统库存事件', [`${signal.id}:receipt`]),
      transfer_in: fact(number(info.transfer_in_qty), 'confirmed', '系统调拨流水', [`${signal.id}:transfer_in`]),
      transfer_out: fact(number(info.transfer_out_qty), 'confirmed', '系统调拨流水', [`${signal.id}:transfer_out`]),
      scrap: fact(number(info.scrap_qty), 'confirmed', '系统报损流水', [`${signal.id}:scrap`]),
      count_adjustment: fact(null, 'not_integrated', '当前理论公式未单列盘点调整', []),
      bom_consumption: fact(number(info.bom_consumption_qty), 'confirmed', '销售 SKU × BOM 用量', [`${signal.id}:bom_consumption`]),
      theoretical_closing: fact(number(info.theoretical_qty ?? signal.theoretical_closing_qty), 'confirmed', '库存理论公式', [`${signal.id}:balance`])
    },
    physical_count: physicalKnown
      ? { ...fact(number(info.physical_qty), 'confirmed', '最近有效盘点', [info.actual_count_document_id || `${signal.id}:physical_count`]), counted_at: info.actual_counted_at || null }
      : { ...fact(null, 'unknown', '尚未取得有效实盘', []), counted_at: null },
    data_availability: {
      ...procurement,
      destination_acceptance: destinationAcceptanceAvailability(signal, context)
    },
    count_policy: context.countPolicy || 'unknown',
    windows: {
      today: windowSummary(signal, context, 1),
      three_days: windowSummary(signal, context, 3),
      seven_days: windowSummary(signal, context, 7)
    }
  };
  const validation = validateFactPacket(packet);
  if (!validation.valid) throw new Error(`Invalid fact packet: ${validation.errors.join('; ')}`);
  return packet;
}
