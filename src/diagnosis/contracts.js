export const DIAGNOSIS_SCHEMA_VERSION = '1.0';
export const FACT_STATUSES = Object.freeze(['confirmed', 'not_integrated', 'unknown', 'not_applicable']);
export const EVIDENCE_STATUSES = Object.freeze(['confirmed', 'excluded', 'suspect', 'insufficient', 'pending_count']);

export function fact(value, status = value == null ? 'unknown' : 'confirmed', source = '', evidenceRefs = []) {
  return { value: value == null ? null : Number(value), status, source: String(source || ''), evidence_refs: [...new Set(evidenceRefs.filter(Boolean).map(String))] };
}

export function validateFactPacket(packet) {
  const errors = [];
  if (!packet || typeof packet !== 'object') return { valid: false, errors: ['fact packet must be an object'] };
  for (const key of ['schema_version', 'fact_packet_id', 'store_code', 'business_date', 'material_name', 'unit', 'as_of']) if (!String(packet[key] || '').trim()) errors.push(`${key} is required`);
  const requiredQuantities = ['opening', 'receipt', 'transfer_in', 'transfer_out', 'scrap', 'count_adjustment', 'bom_consumption', 'theoretical_closing'];
  for (const key of requiredQuantities) {
    const item = packet.quantities?.[key];
    if (!item || typeof item !== 'object') { errors.push(`quantities.${key} is required`); continue; }
    if (!FACT_STATUSES.includes(item.status)) errors.push(`quantities.${key}.status is invalid`);
    if (item.status === 'confirmed' && !Number.isFinite(item.value)) errors.push(`quantities.${key}.value must be numeric when confirmed`);
    if (item.status !== 'confirmed' && item.value != null) errors.push(`quantities.${key}.value must be null unless confirmed`);
    if (!Array.isArray(item.evidence_refs)) errors.push(`quantities.${key}.evidence_refs must be an array`);
  }
  if (!packet.physical_count || !FACT_STATUSES.includes(packet.physical_count.status)) errors.push('physical_count.status is invalid');
  if (packet.physical_count?.status === 'confirmed' && !Number.isFinite(packet.physical_count.value)) errors.push('physical_count.value must be numeric when confirmed');
  if (!packet.windows || !['today', 'three_days', 'seven_days'].every((key) => packet.windows[key])) errors.push('today, three_days and seven_days windows are required');
  return { valid: errors.length === 0, errors };
}

export function validateDiagnosisCase(caseItem) {
  const errors = [];
  if (!caseItem || typeof caseItem !== 'object') return { valid: false, errors: ['diagnosis case must be an object'] };
  for (const key of ['case_id', 'ruleset_id', 'rule_code', 'rule_version', 'fact_packet_id']) if (!String(caseItem[key] || '').trim()) errors.push(`${key} is required`);
  if (!EVIDENCE_STATUSES.includes(caseItem.cause_evidence_status)) errors.push('cause_evidence_status is invalid');
  if (!EVIDENCE_STATUSES.includes(caseItem.physical_status)) errors.push('physical_status is invalid');
  if (!Array.isArray(caseItem.decision_trace)) errors.push('decision_trace must be an array');
  if (!Array.isArray(caseItem.recommended_action_ids)) errors.push('recommended_action_ids must be an array');
  return { valid: errors.length === 0, errors };
}
