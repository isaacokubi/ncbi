import test from 'node:test';
import assert from 'node:assert/strict';
import { supplierQuoteError } from './supplierWorkflow.js';
const valid={quoteNumber:'Q-100',amount:'12500.00',currency:'KES',requestCurrency:'KES',deliveryDays:14,validUntil:'2026-12-01',now:new Date('2026-10-30T10:00:00Z')};
test('supplier quotation accepts a valid comparable offer',()=>assert.equal(supplierQuoteError(valid),null));
test('supplier quotation rejects invalid price and mismatched currency',()=>{
 assert.match(supplierQuoteError({...valid,amount:'0'}),/positive/);
 assert.match(supplierQuoteError({...valid,currency:'USD'}),/currency/);
});
test('supplier quotation validates delivery and validity dates',()=>{
 assert.match(supplierQuoteError({...valid,deliveryDays:1.5}),/whole number/);
 assert.match(supplierQuoteError({...valid,validUntil:'2026-10-01'}),/future/);
});
