import test from 'node:test';
import assert from 'node:assert/strict';
import { canReadOperationsEntity, canWriteOperationsEntity } from '../src/domain/workspaceEntityPolicy.js';

test('member accounts use the member portal, not generic operations registers',()=>{
  const member={role:'member'};
  assert.equal(canReadOperationsEntity(member,'event'),false);
  assert.equal(canReadOperationsEntity(member,'announcement'),false);
  assert.equal(canWriteOperationsEntity(member),false);
});

test('treasurers use finance workspaces, not generic operations registers',()=>{
  const treasurer={role:'treasurer'};
  assert.equal(canReadOperationsEntity(treasurer,'event'),false);
  assert.equal(canReadOperationsEntity(treasurer,'finance'),false);
  assert.equal(canWriteOperationsEntity(treasurer),false);
});

test('department leaders can read only ministry workspace records',()=>{
  const leader={role:'department_leader'};
  for(const entity of ['department','event','discipleship_course','service_plan']) assert.equal(canReadOperationsEntity(leader,entity),true);
  for(const entity of ['member','finance','pastoral_case','benevolence','announcement']) assert.equal(canReadOperationsEntity(leader,entity),false);
  assert.equal(canWriteOperationsEntity(leader),false);
});

test('branch and senior leadership retain scoped operations access',()=>{
  for(const role of ['super_admin','international_executive','national_admin','regional_overseer','district_pastor','branch_pastor','branch_admin']){
    const user={role};
    assert.equal(canReadOperationsEntity(user,'event'),true);
    assert.equal(canWriteOperationsEntity(user),true);
  }
});

test('unknown and unauthenticated roles are denied',()=>{
  assert.equal(canReadOperationsEntity(null,'event'),false);
  assert.equal(canReadOperationsEntity({role:'unknown'},'event'),false);
  assert.equal(canWriteOperationsEntity({role:'unknown'}),false);
});
