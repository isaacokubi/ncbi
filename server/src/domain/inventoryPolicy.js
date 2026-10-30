const movementTypes = new Set(['opening_stock','received','issued','transfer','adjustment','stocktake']);
export function inventoryItemInputError(input = {}) {
  for (const [field,label,max] of [['itemCode','Item code',50],['itemName','Item name',160],['category','Category',80],['unit','Unit of measure',30],['location','Storage location',160]]) {
    const value=String(input[field]??'').trim();
    if(!value)return label+' is required';
    if(value.length>max)return label+' must be '+max+' characters or fewer';
  }
  const reorder=Number(input.reorderLevel??0);
  if(!Number.isFinite(reorder)||reorder<0||reorder>1000000000)return 'Reorder level must be a non-negative number';
  return null;
}
export function inventoryMovementInputError(input = {}) {
  if(!movementTypes.has(input.movementType))return 'Select a valid stock movement type';
  const quantity=Number(input.quantity);
  if(!Number.isFinite(quantity)||quantity<=0||quantity>1000000000)return 'Quantity must be greater than zero and no more than 1,000,000,000';
  const key=String(input.idempotencyKey??'').trim();
  if(key.length<8||key.length>120)return 'A valid movement request key is required';
  if(input.movementType==='adjustment'&&!['increase','decrease'].includes(input.adjustmentDirection||'increase'))return 'Select whether the adjustment increases or decreases stock';
  if(input.movementType==='stocktake'&&input.quantity<0)return 'Counted stock cannot be negative';
  if(String(input.notes||'').length>1000)return 'Movement notes must be 1,000 characters or fewer';
  return null;
}
export function inventoryMovementDelta({movementType,quantity,adjustmentDirection='increase'},balance) {
  const amount=Number(quantity);
  if(movementType==='stocktake')return amount-Number(balance);
  if(movementType==='issued'||movementType==='transfer')return -amount;
  if(movementType==='adjustment'&&adjustmentDirection==='decrease')return -amount;
  return amount;
}
