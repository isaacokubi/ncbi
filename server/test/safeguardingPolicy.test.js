import test from 'node:test';
import assert from 'node:assert/strict';
import { validateSafeguardingConsentInput, validateSafeguardingRevocation } from '../src/domain/safeguardingPolicy.js';
const now = new Date('2026-10-30T09:00:00Z');
const minor = { dateOfBirth: new Date('2012-04-10T00:00:00Z') };
const valid = { guardianName:'Jane Guardian', guardianRelationship:'Mother', guardianPhone:'+254700123456', guardianConfirmedAuthority:true, consentTypes:['participation','photography'], validFrom:'2026-10-30T00:00:00Z', validUntil:'2027-10-29T00:00:00Z' };
test('captures explicit, time-bounded consent from a verified minor guardian', () => {
 const result=validateSafeguardingConsentInput(valid,minor,now); assert.equal(result.valid,true); assert.deepEqual(result.value.consentTypes,['participation','photography']); assert.equal(result.value.guardianConfirmedAuthority,true);
});
test('requires a verified minor, guardian authority and valid purposes', () => {
 assert.equal(validateSafeguardingConsentInput(valid,{dateOfBirth:'1990-01-01'},now).valid,false);
 assert.equal(validateSafeguardingConsentInput(valid,{},now).valid,false);
 assert.equal(validateSafeguardingConsentInput({...valid,guardianConfirmedAuthority:false},minor,now).valid,false);
 assert.equal(validateSafeguardingConsentInput({...valid,consentTypes:[]},minor,now).valid,false);
 assert.equal(validateSafeguardingConsentInput({...valid,consentTypes:['unknown']},minor,now).valid,false);
});
test('requires separate collection contacts and validates phone details', () => {
 assert.equal(validateSafeguardingConsentInput({...valid,consentTypes:['authorised_collection']},minor,now).valid,false);
 assert.equal(validateSafeguardingConsentInput({...valid,consentTypes:['authorised_collection'],authorisedPickupPersons:[{name:'John Doe',phone:'+254711222333'}]},minor,now).valid,true);
 assert.equal(validateSafeguardingConsentInput({...valid,guardianPhone:'bad'},minor,now).valid,false);
});
test('rejects duplicate purposes and invalid expiry dates', () => {
 assert.equal(validateSafeguardingConsentInput({...valid,consentTypes:['photography','photography']},minor,now).valid,false);
 assert.equal(validateSafeguardingConsentInput({...valid,validUntil:'2026-10-01'},minor,now).valid,false);
 assert.equal(validateSafeguardingConsentInput({...valid,validUntil:'2028-01-01'},minor,now).valid,false);
});
test('requires a reason to revoke consent', () => {
 assert.equal(validateSafeguardingRevocation({}).valid,false);
 assert.equal(validateSafeguardingRevocation({reason:'Parent requested withdrawal'}).valid,true);
});
