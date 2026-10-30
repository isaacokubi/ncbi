import test from 'node:test';
import assert from 'node:assert/strict';
import { inventoryItemInputError, inventoryMovementInputError, inventoryMovementDelta } from './inventoryPolicy.js';

const validItem = { itemCode:'CHAIR-01', itemName:'Plastic chair', category:'Furniture', unit:'piece', location:'Main store', reorderLevel:5 };
const movement = (overrides={}) => ({ movementType:'received', quantity:4, idempotencyKey:'movement-12345', ...overrides });

test('inventory item requires identifying and storage fields',()=>{
  assert.equal(inventoryItemInputError(validItem),null);
  assert.match(inventoryItemInputError({...validItem,itemCode:' '}),/Item code is required/);
  assert.match(inventoryItemInputError({...validItem,reorderLevel:-1}),/non-negative/);
});

test('movement requests require a stable idempotency key and positive quantity',()=>{
  assert.equal(inventoryMovementInputError(movement()),null);
  assert.match(inventoryMovementInputError(movement({quantity:0})),/Quantity must/);
  assert.match(inventoryMovementInputError(movement({idempotencyKey:'x'})),/request key/);
});

test('stocktake accepts a zero count while ordinary movements do not',()=>{
  assert.equal(inventoryMovementInputError(movement({movementType:'stocktake',quantity:0})),null);
  assert.match(inventoryMovementInputError(movement({movementType:'received',quantity:0})),/Quantity must/);
});

test('stock movement deltas correctly update balances',()=>{
  assert.equal(inventoryMovementDelta(movement({movementType:'received',quantity:8}),10),8);
  assert.equal(inventoryMovementDelta(movement({movementType:'issued',quantity:3}),10),-3);
  assert.equal(inventoryMovementDelta(movement({movementType:'adjustment',quantity:2,adjustmentDirection:'decrease'}),10),-2);
  assert.equal(inventoryMovementDelta(movement({movementType:'stocktake',quantity:7}),10),-3);
  assert.equal(inventoryMovementDelta(movement({movementType:'stocktake',quantity:0}),10),-10);
});
