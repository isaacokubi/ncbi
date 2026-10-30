import test from 'node:test';
import assert from 'node:assert/strict';
import { inventoryItemInputError, inventoryMovementInputError, inventoryMovementDelta } from '../src/domain/inventoryPolicy.js';

test('inventory item validation requires a bounded code, name, category, unit and location',()=>{
 const item={itemCode:'CHAIR-01',itemName:'Plastic chair',category:'Furniture',unit:'piece',location:'Main store',reorderLevel:5};
 assert.equal(inventoryItemInputError(item),null);
 assert.match(inventoryItemInputError({...item,itemCode:' '}),/code is required/i);
 assert.match(inventoryItemInputError({...item,reorderLevel:-1}),/non-negative/);
});
test('movement validation requires positive quantity and idempotency key',()=>{
 const movement={movementType:'received',quantity:12,idempotencyKey:'request-123'};
 assert.equal(inventoryMovementInputError(movement),null);
 assert.match(inventoryMovementInputError({...movement,quantity:0}),/greater than zero/);
 assert.match(inventoryMovementInputError({...movement,idempotencyKey:'x'}),/request key/);
});
test('stock movement math handles receipts, issues, adjustments and physical stocktakes',()=>{
 assert.equal(inventoryMovementDelta({movementType:'received',quantity:5},10),5);
 assert.equal(inventoryMovementDelta({movementType:'issued',quantity:3},10),-3);
 assert.equal(inventoryMovementDelta({movementType:'transfer',quantity:2},10),-2);
 assert.equal(inventoryMovementDelta({movementType:'adjustment',quantity:4,adjustmentDirection:'decrease'},10),-4);
 assert.equal(inventoryMovementDelta({movementType:'stocktake',quantity:8},10),-2);
});
