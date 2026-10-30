import test from 'node:test';
import assert from 'node:assert/strict';
import { validateEventRegistrationInput, validateEventRegistrationStatus } from '../src/domain/eventRegistrationPolicy.js';

test('event registration uses the authenticated profile and normalises notes', () => {
  const result = validateEventRegistrationInput({ notes: '  wheelchair access  ' }, { fullName: ' Grace Njeri ', email: 'GRACE@example.org ' });
  assert.deepEqual(result, { valid: true, value: { attendeeName: 'Grace Njeri', email: 'grace@example.org', notes: 'wheelchair access' } });
});

test('event registration rejects missing identity and invalid email', () => {
  assert.equal(validateEventRegistrationInput({}, {}).valid, false);
  assert.equal(validateEventRegistrationInput({}, { fullName: 'Grace', email: 'not-an-email' }).valid, false);
});

test('event registration limits notes and accepts only known workflow states', () => {
  assert.equal(validateEventRegistrationInput({ notes: 'x'.repeat(501) }, { fullName: 'Grace', email: 'grace@example.org' }).valid, false);
  for (const status of ['pending', 'confirmed', 'waitlisted', 'cancelled']) assert.equal(validateEventRegistrationStatus(status), true);
  assert.equal(validateEventRegistrationStatus('paid'), false);
});
