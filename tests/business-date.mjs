import assert from 'node:assert/strict';
import { operationalBusinessDate } from '../src/business-date.js';

assert.equal(
  operationalBusinessDate({ at:new Date('2026-09-17T20:59:59Z'), timeZone:'Asia/Jakarta', cutoffHour:4 }),
  '2026-09-17',
  'Jakarta 03:59 should still belong to the previous business day'
);
assert.equal(
  operationalBusinessDate({ at:new Date('2026-09-17T21:00:00Z'), timeZone:'Asia/Jakarta', cutoffHour:4 }),
  '2026-09-18',
  'Jakarta 04:00 should open the new business day'
);
assert.equal(
  operationalBusinessDate({ at:new Date('2026-09-18T16:30:00Z'), timeZone:'Asia/Jakarta', cutoffHour:4 }),
  '2026-09-18',
  'Jakarta late evening should remain on the local calendar day'
);
assert.throws(() => operationalBusinessDate({ at:'not-a-date' }), /Invalid business-date instant/);

console.log('Business-date boundary checks passed.');
