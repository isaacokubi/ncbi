const asCents = value => {
  const text = String(value ?? '0');
  if (!/^-?\d+(?:\.\d{1,2})?$/.test(text)) throw new TypeError('Ledger amount must have at most two decimal places');
  const negative = text.startsWith('-');
  const [whole, decimals = ''] = (negative ? text.slice(1) : text).split('.');
  const cents = BigInt(whole) * 100n + BigInt((decimals + '00').slice(0, 2));
  return negative ? -cents : cents;
};

const money = value => {
  const negative = value < 0n;
  const magnitude = negative ? -value : value;
  return `${negative ? '-' : ''}${magnitude / 100n}.${(magnitude % 100n).toString().padStart(2, '0')}`;
};

const accountSummary = (account, debit, credit, balance) => ({
  accountId: String(account._id),
  code: account.code,
  name: account.name,
  type: account.type,
  debit: money(debit),
  credit: money(credit),
  balance: money(balance)
});

/** Build currency-separated statements from posted journal totals only. */
export function buildFinancialStatements({ organisations, accounts, ledgerTotals, from, to }) {
  const totalsByKey = new Map(ledgerTotals.map(row => [`${row.organisation}:${row.account}`, row]));
  return organisations.map(organisation => {
    const orgAccounts = accounts.filter(account => String(account.organisation) === String(organisation._id));
    const values = orgAccounts.map(account => {
      const row = totalsByKey.get(`${organisation._id}:${account._id}`) || {};
      const debit = asCents(row.debit);
      const credit = asCents(row.credit);
      const periodDebit = asCents(row.periodDebit);
      const periodCredit = asCents(row.periodCredit);
      return { account, debit, credit, periodDebit, periodCredit };
    });

    const trialBalance = values.map(({ account, debit, credit }) => {
      const net = debit - credit;
      return accountSummary(account, net > 0n ? net : 0n, net < 0n ? -net : 0n, net);
    }).filter(row => row.debit !== '0.00' || row.credit !== '0.00');
    const income = values.filter(row => row.account.type === 'income').map(({ account, periodDebit, periodCredit }) => accountSummary(account, periodDebit, periodCredit, periodCredit - periodDebit)).filter(row => row.balance !== '0.00');
    const expenses = values.filter(row => row.account.type === 'expense').map(({ account, periodDebit, periodCredit }) => accountSummary(account, periodDebit, periodCredit, periodDebit - periodCredit)).filter(row => row.balance !== '0.00');
    const incomeTotal = income.reduce((sum, row) => sum + asCents(row.balance), 0n);
    const expenseTotal = expenses.reduce((sum, row) => sum + asCents(row.balance), 0n);
    const surplus = incomeTotal - expenseTotal;
    const accumulatedIncome = values.filter(row => row.account.type === 'income').reduce((sum, row) => sum + row.credit - row.debit, 0n);
    const accumulatedExpenses = values.filter(row => row.account.type === 'expense').reduce((sum, row) => sum + row.debit - row.credit, 0n);
    const accumulatedSurplus = accumulatedIncome - accumulatedExpenses;
    const assets = values.filter(row => row.account.type === 'asset').map(({ account, debit, credit }) => accountSummary(account, debit, credit, debit - credit));
    const liabilities = values.filter(row => row.account.type === 'liability').map(({ account, debit, credit }) => accountSummary(account, debit, credit, credit - debit));
    const equity = values.filter(row => row.account.type === 'equity').map(({ account, debit, credit }) => accountSummary(account, debit, credit, credit - debit));
    const assetsTotal = assets.reduce((sum, row) => sum + asCents(row.balance), 0n);
    const liabilitiesTotal = liabilities.reduce((sum, row) => sum + asCents(row.balance), 0n);
    const equityTotal = equity.reduce((sum, row) => sum + asCents(row.balance), 0n);

    return {
      organisation: { id: String(organisation._id), name: organisation.name, code: organisation.code, currency: organisation.currency || 'KES' },
      period: { from, to },
      trialBalance,
      trialBalanceTotals: {
        debit: money(trialBalance.reduce((sum, row) => sum + asCents(row.debit), 0n)),
        credit: money(trialBalance.reduce((sum, row) => sum + asCents(row.credit), 0n))
      },
      incomeAndExpenditure: { income, expenses, incomeTotal: money(incomeTotal), expenseTotal: money(expenseTotal), surplus: money(surplus) },
      balanceSheet: {
        assets, liabilities, equity,
        accumulatedSurplus: money(accumulatedSurplus),
        assetsTotal: money(assetsTotal),
        liabilitiesTotal: money(liabilitiesTotal),
        equityTotal: money(equityTotal),
        liabilitiesAndEquityTotal: money(liabilitiesTotal + equityTotal + accumulatedSurplus),
        asOf: to
      }
    };
  });
}
