const transitions = Object.freeze({
  approve: { from: 'submitted', to: 'approved' },
  reject: { from: 'submitted', to: 'rejected' },
  confirm: { from: 'approved', to: 'confirmed' },
  void: { from: ['submitted','approved','confirmed'], to: 'voided' }
});
export function financeTransition(currentStatus, decision) {
  const rule = transitions[decision];
  if (!rule) return { allowed: false, status: currentStatus };
  const allowedFrom = Array.isArray(rule.from) ? rule.from : [rule.from];
  return allowedFrom.includes(currentStatus) ? { allowed: true, status: rule.to } : { allowed: false, status: currentStatus };
}

export function financeDecisionError(transaction, decision, actorId) {
  const actor = String(actorId);
  if (['approve', 'reject'].includes(decision) && String(transaction.createdBy) === actor) {
    return 'The creator cannot approve or reject their own transaction';
  }
  if (decision === 'confirm' && (String(transaction.createdBy) === actor || String(transaction.approvedBy) === actor)) {
    return 'Confirmation must be performed by someone other than the requester and approver';
  }
  if (decision === 'void' && transaction.status === 'confirmed' && String(transaction.createdBy) === actor) {
    return 'The requester cannot void a confirmed transaction';
  }
  return null;
}

export function financeDecisionNoteError(decision, note) {
  return decision === 'reject' && !String(note || '').trim()
    ? 'Provide an explanation when declining a financial request'
    : null;
}

export function budgetTransition(currentStatus, decision) {
  if (currentStatus !== 'submitted' || !['approve', 'reject'].includes(decision)) {
    return { allowed: false, status: currentStatus };
  }
  return { allowed: true, status: decision === 'approve' ? 'approved' : 'rejected' };
}

export function budgetDecisionError(budget, actorId) {
  return String(budget.createdBy) === String(actorId)
    ? 'The budget requester cannot approve or reject their own budget'
    : null;
}
export function isValidPositiveAmount(value) {
  const text = String(value ?? '').trim();
  if (!/^\\d+(?:\\.\\d{1,2})?$/.test(text)) return false;
  const [whole, fraction = ''] = text.split('.');
  const cents = BigInt(whole) * 100n + BigInt((fraction + '00').slice(0, 2));
  return cents > 0n && cents <= 10000000000000n;
}
