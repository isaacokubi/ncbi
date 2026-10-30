import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFinancialStatements } from '../src/domain/financialStatements.js';

const orgA = { _id: 'branch-a', name: 'Branch A', code: 'A', currency: 'KES' };
const orgB = { _id: 'branch-b', name: 'Branch B', code: 'B', currency: 'USD' };
const accounts = [
  { _id: 'cash-a', organisation: 'branch-a', code: '1000', name: 'Cash', type: 'asset' },
  { _id: 'income-a', organisation: 'branch-a', code: '4000', name: 'Giving', type: 'income' },
  { _id: 'expense-a', organisation: 'branch-a', code: '5000', name: 'Ministry', type: 'expense' },
  { _id: 'cash-b', organisation: 'branch-b', code: '1000', name: 'Cash', type: 'asset' },
  { _id: 'income-b', organisation: 'branch-b', code: '4000', name: 'Giving', type: 'income' }
];

test('financial statements calculate posted trial balance and statements per organisation currency', () => {
  const statements = buildFinancialStatements({
    organisations: [orgA, orgB], accounts,
    ledgerTotals: [
      { organisation: 'branch-a', account: 'cash-a', debit: '60.00', credit: '0.00', periodDebit: '60.00', periodCredit: '0.00' },
      { organisation: 'branch-a', account: 'income-a', debit: '0.00', credit: '100.00', periodDebit: '0.00', periodCredit: '100.00' },
      { organisation: 'branch-a', account: 'expense-a', debit: '40.00', credit: '0.00', periodDebit: '40.00', periodCredit: '0.00' },
      { organisation: 'branch-b', account: 'cash-b', debit: '25.50', credit: '0.00', periodDebit: '25.50', periodCredit: '0.00' },
      { organisation: 'branch-b', account: 'income-b', debit: '0.00', credit: '25.50', periodDebit: '0.00', periodCredit: '25.50' }
    ], from: '2026-01-01', to: '2026-10-30'
  });

  assert.equal(statements.length, 2);
  assert.equal(statements[0].organisation.currency, 'KES');
  assert.equal(statements[0].trialBalanceTotals.debit, '100.00');
  assert.equal(statements[0].trialBalanceTotals.credit, '100.00');
  assert.equal(statements[0].incomeAndExpenditure.incomeTotal, '100.00');
  assert.equal(statements[0].incomeAndExpenditure.expenseTotal, '40.00');
  assert.equal(statements[0].incomeAndExpenditure.surplus, '60.00');
  assert.equal(statements[0].balanceSheet.assetsTotal, '60.00');
  assert.equal(statements[0].balanceSheet.liabilitiesAndEquityTotal, '60.00');
  assert.equal(statements[1].organisation.currency, 'USD');
  assert.equal(statements[1].balanceSheet.assetsTotal, '25.50');
  assert.equal(statements[1].incomeAndExpenditure.surplus, '25.50');
});

test('financial statement arithmetic remains exact to cents for credit balances and reversals', () => {
  const statements = buildFinancialStatements({
    organisations: [orgA], accounts: accounts.slice(0, 2),
    ledgerTotals: [
      { organisation: 'branch-a', account: 'cash-a', debit: '0.00', credit: '0.01', periodDebit: '0.00', periodCredit: '0.01' },
      { organisation: 'branch-a', account: 'income-a', debit: '0.01', credit: '0.00', periodDebit: '0.01', periodCredit: '0.00' }
    ], from: '2026-01-01', to: '2026-10-30'
  });
  assert.equal(statements[0].trialBalanceTotals.debit, '0.01');
  assert.equal(statements[0].trialBalanceTotals.credit, '0.01');
  assert.equal(statements[0].balanceSheet.assetsTotal, '-0.01');
  assert.equal(statements[0].balanceSheet.liabilitiesAndEquityTotal, '-0.01');
});
