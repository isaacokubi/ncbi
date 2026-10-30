import test from 'node:test';
import assert from 'node:assert/strict';
import { passwordChangeError, tokenVersionMatches } from '../src/domain/authPolicy.js';

test('existing tokens remain valid at the unchanged version, including legacy version-zero tokens', () => {
  assert.equal(tokenVersionMatches(undefined, 0), true);
  assert.equal(tokenVersionMatches(2, 2), true);
});

test('incrementing the stored token version revokes all previously issued tokens', () => {
  assert.equal(tokenVersionMatches(0, 1), false);
  assert.equal(tokenVersionMatches(3, 4), false);
});

test('password changes require the current password and a 14-character new password', () => {
  assert.match(passwordChangeError('', 'long-enough-password'), /current password/);
  assert.match(passwordChangeError('old-password', 'short'), /14 characters/);
  assert.match(passwordChangeError('same-password-123', 'same-password-123'), /different/);
  assert.equal(passwordChangeError('old-password', 'new-password-long-enough'), null);
});
