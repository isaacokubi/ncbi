import test from 'node:test';
import assert from 'node:assert/strict';
import { accountActionUrl } from '../src/services/email.js';

test('account action links use the configured HTTPS application origin and encode the token', () => {
  const previous = process.env.APP_BASE_URL;
  process.env.APP_BASE_URL = 'https://ncbi-church-system.vercel.app/';
  try {
    assert.equal(accountActionUrl('resetPassword', 'abc+123'), 'https://ncbi-church-system.vercel.app/?resetPassword=abc%2B123');
  } finally {
    if (previous === undefined) delete process.env.APP_BASE_URL;
    else process.env.APP_BASE_URL = previous;
  }
});

test('account action links refuse an unset or insecure application origin', () => {
  const previous = process.env.APP_BASE_URL;
  try {
    process.env.APP_BASE_URL = '';
    assert.throws(() => accountActionUrl('resetPassword', 'token'), error => error.status === 503);
    process.env.APP_BASE_URL = 'http://example.com';
    assert.throws(() => accountActionUrl('resetPassword', 'token'), error => error.status === 503);
  } finally {
    if (previous === undefined) delete process.env.APP_BASE_URL;
    else process.env.APP_BASE_URL = previous;
  }
});
