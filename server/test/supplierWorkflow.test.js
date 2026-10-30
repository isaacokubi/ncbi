import test from 'node:test';
import assert from 'node:assert/strict';
import { supplierNameError, supplierInvoiceError, supplierPaymentError, supplierDecisionError, invoicePaymentStatus, moneyToMinor } from '../src/domain/supplierWorkflow.js';

test('supplier names are required and bounded',()=>{
 assert.equal(supplierNameError('  '),'Supplier name is required');
 assert.equal(supplierNameError('Grace Supplies'),null);
 assert.match(supplierNameError('x'.repeat(161)),/160/);
});
test('invoice validation requires unique-ready reference, positive exact decimal and valid dates',()=>{
 assert.equal(supplierInvoiceError({invoiceNumber:'INV-1',amount:'120.50',invoiceDate:'2026-10-01',dueDate:'2026-10-31'}),null);
 assert.match(supplierInvoiceError({invoiceNumber:'INV-1',amount:'0',invoiceDate:'2026-10-01'}),/positive/);
 assert.match(supplierInvoiceError({invoiceNumber:'INV-1',amount:'1.999',invoiceDate:'2026-10-01'}),/positive/);
 assert.match(supplierInvoiceError({invoiceNumber:'INV-1',amount:'10',invoiceDate:'2026-10-20',dueDate:'2026-10-01'}),/earlier/);
});
test('payment validation prevents overpayment and enforces separation of duties',()=>{
 assert.equal(supplierPaymentError({amount:'50.00',outstanding:'100.00'}),null);
 assert.match(supplierPaymentError({amount:'100.01',outstanding:'100.00'}),/exceeds/);
 assert.match(supplierPaymentError({amount:'10',outstanding:'100',requesterId:'a',approverId:'a'}),/requester/);
 assert.match(supplierPaymentError({amount:'10',outstanding:'100',requesterId:'a',approverId:'b',confirmerId:'b'}),/different user/);
});
test('supplier decisions are single actor and only submitted records transition',()=>{
 assert.match(supplierDecisionError({status:'submitted',decision:'approve',actorId:'a',createdBy:'a'}),/requester/);
 assert.match(supplierDecisionError({status:'approved',decision:'approve',actorId:'b',createdBy:'a'}),/submitted/);
 assert.match(supplierDecisionError({status:'submitted',decision:'approve',actorId:'b',createdBy:'a',approvals:[{actor:'b'}]}),/already participated/);
 assert.equal(supplierDecisionError({status:'submitted',decision:'approve',actorId:'b',createdBy:'a'}),null);
});
test('invoice balances use exact cents and distinguish partial settlement',()=>{
 assert.equal(moneyToMinor('10.25'),1025n);
 assert.equal(invoicePaymentStatus({amount:'100.00',paid:'0.00'}),'approved');
 assert.equal(invoicePaymentStatus({amount:'100.00',paid:'40.25'}),'partially_paid');
 assert.equal(invoicePaymentStatus({amount:'100.00',paid:'100.00'}),'paid');
 assert.equal(invoicePaymentStatus({amount:'100.00',paid:'101.00'}),'invalid');
});
