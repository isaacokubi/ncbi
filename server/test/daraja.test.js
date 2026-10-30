import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeKenyanPhone } from '../src/services/daraja.js';

test('Daraja phone normalisation accepts Kenyan mobile formats',()=>{
 assert.equal(normalizeKenyanPhone('0712345678'),'254712345678');
 assert.equal(normalizeKenyanPhone('712345678'),'254712345678');
 assert.equal(normalizeKenyanPhone('+254 712 345 678'),'254712345678');
 assert.equal(normalizeKenyanPhone('0112345678'),'254112345678');
});

test('Daraja phone normalisation rejects invalid or non-Kenyan numbers',()=>{
 assert.equal(normalizeKenyanPhone('23456789'),null);
 assert.equal(normalizeKenyanPhone('070012345'),null);
 assert.equal(normalizeKenyanPhone('+1 415 555 0100'),null);
 assert.equal(normalizeKenyanPhone(''),null);
});
