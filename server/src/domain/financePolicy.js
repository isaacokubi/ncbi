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
export function isValidPositiveAmount(value) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 && amount <= 100000000000;
}
