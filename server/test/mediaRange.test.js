import test from 'node:test';
import assert from 'node:assert/strict';
import { parseByteRange } from '../src/routes/media.js';

test('media byte ranges support bounded, open-ended and suffix requests', () => {
  assert.deepEqual(parseByteRange('bytes=0-99', 500), { start: 0, end: 99 });
  assert.deepEqual(parseByteRange('bytes=100-', 500), { start: 100, end: 499 });
  assert.deepEqual(parseByteRange('bytes=-50', 500), { start: 450, end: 499 });
  assert.deepEqual(parseByteRange('bytes=450-900', 500), { start: 450, end: 499 });
});

test('media byte ranges reject malformed, multiple and unsatisfiable requests', () => {
  assert.deepEqual(parseByteRange('bytes=500-', 500), { invalid: true });
  assert.deepEqual(parseByteRange('bytes=20-10', 500), { invalid: true });
  assert.deepEqual(parseByteRange('bytes=-0', 500), { invalid: true });
  assert.deepEqual(parseByteRange('bytes=1-2,4-5', 500), { invalid: true });
  assert.deepEqual(parseByteRange('items=1-2', 500), { invalid: true });
  assert.equal(parseByteRange(null, 500), null);
});
