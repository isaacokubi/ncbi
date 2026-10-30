import test from 'node:test';
import assert from 'node:assert/strict';
import { MIN_PASSWORD_LENGTH, passwordChangeError, passwordLengthError, tokenVersionMatches } from '../src/domain/authPolicy.js';
test('legacy and current token versions match correctly',()=>{assert.equal(tokenVersionMatches(undefined,0),true);assert.equal(tokenVersionMatches(2,2),true);});
test('incrementing the stored token version revokes previously issued tokens',()=>{assert.equal(tokenVersionMatches(0,1),false);assert.equal(tokenVersionMatches(3,4),false);});
test('password policy accepts six or more characters and rejects fewer than six',()=>{assert.equal(MIN_PASSWORD_LENGTH,6);assert.match(passwordLengthError('12345'),/at least 6 characters/);assert.equal(passwordLengthError('123456'),null);assert.equal(passwordLengthError('longer-password'),null);});
test('password changes require the current password, six characters and a different password',()=>{assert.match(passwordChangeError('','123456'),/current password/);assert.match(passwordChangeError('old-password','12345'),/at least 6 characters/);assert.match(passwordChangeError('same123','same123'),/different/);assert.equal(passwordChangeError('old-password','new123'),null);});
