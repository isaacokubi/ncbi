import test from 'node:test';
import assert from 'node:assert/strict';
import { validateVisitorFollowUp } from '../src/domain/visitorFollowUpPolicy.js';
const now=new Date('2026-10-30T09:00:00Z');
const valid={contactMethod:'phone',outcome:'connected',status:'in_progress',nextFollowUpAt:'2026-10-31T09:00:00Z',note:'Invited to Sunday service'};
test('accepts a scheduled visitor follow-up',()=>{const r=validateVisitorFollowUp(valid,now);assert.equal(r.valid,true);assert.ok(r.value.nextFollowUpAt instanceof Date);});
test('requires a future next action for open follow-ups',()=>{for(const date of ['', '2026-10-29T09:00:00Z','invalid'])assert.equal(validateVisitorFollowUp({...valid,nextFollowUpAt:date},now).valid,false);});
test('allows completed follow-ups without another appointment',()=>{const r=validateVisitorFollowUp({...valid,status:'completed',nextFollowUpAt:''},now);assert.equal(r.valid,true);assert.equal(r.value.nextFollowUpAt,null);});
test('rejects unsupported values and oversized notes',()=>{for(const input of [{...valid,contactMethod:'telegram'},{...valid,outcome:'unknown'},{...valid,status:'deleted'},{...valid,note:'x'.repeat(1001)}])assert.equal(validateVisitorFollowUp(input,now).valid,false);});
