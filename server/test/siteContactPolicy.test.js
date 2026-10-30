import test from 'node:test';
import assert from 'node:assert/strict';
import { publicContactError } from '../src/domain/siteContactPolicy.js';

test('public contact fields accept standard contact details',()=>{
 assert.equal(publicContactError({contactEmail:'office@ncbi.org',phone:'+254 700 000 000',whatsapp:'+254 711 111 111',physicalAddress:'Headquarters, Kenya',postalAddress:'P.O. Box 123',officeHours:'Monday-Friday, 8am-5pm'}),null);
});
test('public contact fields reject unsafe or malformed email and phone input',()=>{
 assert.match(publicContactError({contactEmail:'javascript:alert(1)'}),/valid public contact email/);
 assert.match(publicContactError({phone:'Call me at <script>'}),/standard phone formatting/);
});
test('public contact fields enforce address and office-hours limits',()=>{
 assert.match(publicContactError({physicalAddress:'x'.repeat(501)}),/500 characters/);
 assert.match(publicContactError({officeHours:'x'.repeat(161)}),/160 characters/);
});
