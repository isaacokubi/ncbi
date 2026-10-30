import test from 'node:test';
import assert from 'node:assert/strict';
import { isValidPositiveAmount } from './financePolicy.js';

test('accepts positive amounts with zero, one or two decimal places', () => {
  for (const amount of ['1', '1.0', '1.00', '2500.75', 25, 25.5, '100000000000.00']) {
    assert.equal(isValidPositiveAmount(amount), true, String(amount));
  }
});

test('rejects zero, negative, malformed and over-precision amounts', () => {
  for (const amount of ['0', '0.00', '-1', '-0.01', '1.001', '1.0000', '1e3', 'KES 100', '', null, undefined, '100000000000.01']) {
    assert.equal(isValidPositiveAmount(amount), false, String(amount));
  }
});
