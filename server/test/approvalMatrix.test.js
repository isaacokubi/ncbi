import test from 'node:test';
import assert from 'node:assert/strict';
import { approvalPolicyOverlaps, approvalPolicyRangeError, approvalProgress } from '../src/domain/approvalMatrix.js';

test('approval policy ranges reject malformed and inverted limits',()=>{
 assert.match(approvalPolicyRangeError('-1.00',null),/Minimum amount/);
 assert.match(approvalPolicyRangeError('100.00','99.99'),/Maximum amount/);
 assert.equal(approvalPolicyRangeError('0.00','1000.00'),null);
 assert.equal(approvalPolicyRangeError('250.50',null),null);
});

test('approval policy ranges detect overlaps but allow adjacent non-overlapping limits',()=>{
 assert.equal(approvalPolicyOverlaps({minimumAmount:'0.00',maximumAmount:'999.99'},{minimumAmount:'500.00',maximumAmount:'1500.00'}),true);
 assert.equal(approvalPolicyOverlaps({minimumAmount:'0.00',maximumAmount:'999.99'},{minimumAmount:'1000.00',maximumAmount:null}),false);
 assert.equal(approvalPolicyOverlaps({minimumAmount:'1000.00',maximumAmount:null},{minimumAmount:'1000.00',maximumAmount:null}),true);
});

test('multi-person approval requires distinct approvers and counts approvals',()=>{
 const first=approvalProgress({approvals:[],actorId:'user-a',decision:'approve',requiredApprovals:2});
 assert.deepEqual(first,{allowed:true,complete:false,status:'submitted',remaining:1});
 assert.equal(approvalProgress({approvals:[{actor:'user-a',decision:'approve'}],actorId:'user-a',decision:'approve',requiredApprovals:2}).allowed,false);
 const second=approvalProgress({approvals:[{actor:'user-a',decision:'approve'}],actorId:'user-b',decision:'approve',requiredApprovals:2});
 assert.deepEqual(second,{allowed:true,complete:true,status:'approved',remaining:0});
 assert.equal(approvalProgress({approvals:[],actorId:'user-c',decision:'reject',requiredApprovals:3}).status,'rejected');
});
