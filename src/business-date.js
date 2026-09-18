export const DEFAULT_BUSINESS_TIME_ZONE = 'Asia/Jakarta';
export const DEFAULT_BUSINESS_DAY_CUTOFF_HOUR = 4;

// 营业日按门店当地时间计算。凌晨截止点前发生的业务仍归属于上一营业日，
// 避免跨午夜营业时把同一个班次拆成两个自然日。
export function operationalBusinessDate({
  at = new Date(),
  timeZone = DEFAULT_BUSINESS_TIME_ZONE,
  cutoffHour = DEFAULT_BUSINESS_DAY_CUTOFF_HOUR
} = {}) {
  const instant = at instanceof Date ? at : new Date(at);
  if (Number.isNaN(instant.getTime())) throw new Error('Invalid business-date instant');
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit',
    hourCycle:'h23'
  }).formatToParts(instant).filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
  const localDay = new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)));
  if (Number(parts.hour) < Number(cutoffHour)) localDay.setUTCDate(localDay.getUTCDate() - 1);
  return localDay.toISOString().slice(0, 10);
}

