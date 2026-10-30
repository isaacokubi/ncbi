import { useCallback, useEffect, useState } from 'react';
import { Archive, ArrowDownLeft, ArrowUpRight, ClipboardList, PackagePlus, RefreshCw } from 'lucide-react';

const movementLabels = {
  opening_stock: 'Opening stock', received: 'Received', issued: 'Issued',
  transfer: 'Transferred out', adjustment: 'Adjustment', stocktake: 'Stocktake'
};
const emptyItem = { itemCode:'', itemName:'', category:'', unit:'piece', location:'', reorderLevel:'0' };
const emptyMovement = { movementType:'received', quantity:'', adjustmentDirection:'increase', reference:'', destination:'', notes:'' };
const dateLabel = value => value ? new Intl.DateTimeFormat('en-KE',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value)) : '—';
const numberLabel = value => Number(value||0).toLocaleString('en-KE',{maximumFractionDigits:3});

export default function InventoryStockWorkspace({token,api,canManage,onError,onSuccess}) {
  const [items,setItems] = useState([]);
  const [totals,setTotals] = useState({itemCount:0,lowStockCount:0,totalUnits:0});
  const [selectedId,setSelectedId] = useState('');
  const [selected,setSelected] = useState(null);
  const [movements,setMovements] = useState([]);
  const [itemForm,setItemForm] = useState(emptyItem);
  const [movementForm,setMovementForm] = useState(emptyMovement);
  const [showItemForm,setShowItemForm] = useState(false);
  const [showMovementForm,setShowMovementForm] = useState(false);
  const [loading,setLoading] = useState(true);
  const [saving,setSaving] = useState(false);
  const [search,setSearch] = useState('');
  const [filter,setFilter] = useState('all');

  const loadItems = useCallback(async (preferredId) => {
    setLoading(true);
    try {
      const result = await api('/operations/inventory/stock',token);
      const nextItems = result.items || [];
      setItems(nextItems);
      setTotals(result.totals || {itemCount:0,lowStockCount:0,totalUnits:0});
      const nextId = preferredId || selectedId;
      const active = nextItems.find(item => String(item._id)===String(nextId)) || nextItems[0] || null;
      setSelectedId(active?._id || '');
      setSelected(active);
      if (active) {
        const ledger = await api('/operations/inventory/stock/'+active._id+'/movements',token);
        setMovements(ledger.movements || []);
        setSelected(ledger.item || active);
      } else setMovements([]);
    } catch(error) { onError(error.message); }
    finally { setLoading(false); }
  },[api,token,selectedId,onError]);

  useEffect(()=>{loadItems();},[]);

  const selectItem = async id => {
    setSelectedId(id);
    const item = items.find(entry=>String(entry._id)===String(id));
    setSelected(item || null);
    if(!id){setMovements([]);return;}
    try {
      const ledger = await api('/operations/inventory/stock/'+id+'/movements',token);
      setSelected(ledger.item || item);
      setMovements(ledger.movements || []);
    } catch(error) { onError(error.message); }
  };

  const createItem = async event => {
    event.preventDefault(); setSaving(true);
    try {
      const result = await api('/operations/inventory/stock',token,{method:'POST',body:JSON.stringify({...itemForm,reorderLevel:Number(itemForm.reorderLevel||0)})});
      setItemForm(emptyItem); setShowItemForm(false);
      await loadItems(result.item?._id);
      onSuccess('Inventory item created. Record its opening stock to establish the available balance.');
    } catch(error) { onError(error.message); }
    finally { setSaving(false); }
  };

  const recordMovement = async event => {
    event.preventDefault();
    if(!selected) return onError('Select an inventory item first.');
    setSaving(true);
    try {
      const idempotencyKey = globalThis.crypto?.randomUUID?.() || ('ncbi-'+Date.now()+'-'+Math.random().toString(36).slice(2));
      const result = await api('/operations/inventory/stock/'+selected._id+'/movements',token,{
        method:'POST',body:JSON.stringify({...movementForm,quantity:Number(movementForm.quantity),idempotencyKey})
      });
      setMovementForm(emptyMovement); setShowMovementForm(false);
      await loadItems(selected._id);
      onSuccess(result.duplicate?'This stock movement was already recorded; no duplicate was added.':'Stock movement recorded and balance updated.');
    } catch(error) { onError(error.message); }
    finally { setSaving(false); }
  };

  const filtered = items.filter(item => {
    const term=search.trim().toLowerCase();
    const matches=!term||[item.itemCode,item.itemName,item.category,item.location].some(value=>String(value||'').toLowerCase().includes(term));
    const low=Number(item.balance||0)<=Number(item.reorderLevel||0);
    return matches&&(filter==='all'||(filter==='low'&&low)||(filter==='available'&&Number(item.balance)>0));
  });

  return <section className="inventory-stock-workspace panel">
    <div className="inventory-stock-head"><div><span className="eyebrow">LIVE STOCK REGISTER</span><h3>Inventory and stock ledger</h3><p>Track every receipt, issue, transfer and adjustment with a running balance and an auditable movement history.</p></div>
      <div className="toolbar-right"><button className="refresh-button" onClick={()=>loadItems(selectedId)} disabled={loading}><RefreshCw size={14}/> Refresh stock</button>{canManage&&<button className="gold-button" onClick={()=>setShowItemForm(v=>!v)}><PackagePlus size={15}/> Register item</button>}</div>
    </div>
    <div className="inventory-stock-stats">
      <article><span>Registered items</span><strong>{numberLabel(totals.itemCount)}</strong></article>
      <article><span>Units in stock</span><strong>{numberLabel(totals.totalUnits)}</strong></article>
      <article><span>At / below reorder level</span><strong>{numberLabel(totals.lowStockCount)}</strong></article>
    </div>
    {showItemForm&&canManage&&<form className="inventory-item-form" onSubmit={createItem}>
      <h4><PackagePlus size={17}/> Register inventory item</h4>
      <div className="form-grid">
        <label className="field"><span>Item code *</span><input required maxLength="50" value={itemForm.itemCode} onChange={e=>setItemForm({...itemForm,itemCode:e.target.value})}/></label>
        <label className="field"><span>Item name *</span><input required maxLength="160" value={itemForm.itemName} onChange={e=>setItemForm({...itemForm,itemName:e.target.value})}/></label>
        <label className="field"><span>Category *</span><input required maxLength="80" value={itemForm.category} onChange={e=>setItemForm({...itemForm,category:e.target.value})}/></label>
        <label className="field"><span>Unit *</span><select value={itemForm.unit} onChange={e=>setItemForm({...itemForm,unit:e.target.value})}>{['piece','box','pack','litre','kilogram','metre','set','other'].map(x=><option key={x}>{x}</option>)}</select></label>
        <label className="field"><span>Storage location *</span><input required maxLength="160" value={itemForm.location} onChange={e=>setItemForm({...itemForm,location:e.target.value})}/></label>
        <label className="field"><span>Reorder alert level</span><input type="number" min="0" step="any" value={itemForm.reorderLevel} onChange={e=>setItemForm({...itemForm,reorderLevel:e.target.value})}/></label>
      </div>
      <div className="editor-actions"><button type="button" className="secondary-button" onClick={()=>setShowItemForm(false)}>Cancel</button><button className="gold-button" disabled={saving}>{saving?'Saving…':'Save item'}</button></div>
    </form>}
    <div className="toolbar"><div className="table-search"><input aria-label="Search inventory" placeholder="Search item code, name, category or location…" value={search} onChange={e=>setSearch(e.target.value)}/></div><div className="toolbar-right"><select value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">All stock</option><option value="low">Low stock</option><option value="available">Available stock</option></select></div></div>
    <div className="inventory-stock-table-wrap"><table><thead><tr><th>Item</th><th>Code</th><th>Category</th><th>Location</th><th>Balance</th><th>Reorder level</th><th>Stock status</th><th>Ledger</th></tr></thead><tbody>
      {filtered.map(item=><tr key={item._id}><td><strong>{item.itemName}</strong><small className="cell-sub">{item.unit}</small></td><td>{item.itemCode}</td><td>{item.category}</td><td>{item.location}</td><td><strong>{numberLabel(item.balance)} {item.unit}</strong></td><td>{numberLabel(item.reorderLevel)}</td><td><span className={'status-pill '+(Number(item.balance)<=Number(item.reorderLevel)?'pending':'active')}>{Number(item.balance)<=Number(item.reorderLevel)?'Reorder required':'In stock'}</span></td><td><button className="row-action" onClick={()=>selectItem(item._id)}><ClipboardList size={14}/> View ledger</button></td></tr>)}
      {!loading&&!filtered.length&&<tr><td colSpan="8" className="empty-cell">No stock items match this view. Register the first item to start your inventory ledger.</td></tr>}
      {loading&&<tr><td colSpan="8" className="empty-cell">Loading stock register…</td></tr>}
    </tbody></table></div>
    {selected&&<section className="inventory-ledger-panel">
      <div className="inventory-stock-head"><div><h3>{selected.itemName} · Stock ledger</h3><p>{selected.itemCode} · {selected.location} · Current balance: <strong>{numberLabel(selected.balance)} {selected.unit}</strong></p></div>{canManage&&<button className="gold-button" onClick={()=>setShowMovementForm(v=>!v)}><ArrowDownLeft size={15}/> Record movement</button>}</div>
      {showMovementForm&&canManage&&<form className="inventory-movement-form" onSubmit={recordMovement}>
        <h4>Record stock movement</h4><div className="form-grid">
          <label className="field"><span>Movement type *</span><select value={movementForm.movementType} onChange={e=>setMovementForm({...movementForm,movementType:e.target.value})}>{Object.entries(movementLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
          <label className="field"><span>{movementForm.movementType==='stocktake'?'Counted quantity *':'Quantity *'}</span><input required type="number" min="0.000001" step="any" value={movementForm.quantity} onChange={e=>setMovementForm({...movementForm,quantity:e.target.value})}/></label>
          {movementForm.movementType==='adjustment'&&<label className="field"><span>Adjustment direction</span><select value={movementForm.adjustmentDirection} onChange={e=>setMovementForm({...movementForm,adjustmentDirection:e.target.value})}><option value="increase">Increase</option><option value="decrease">Decrease</option></select></label>}
          <label className="field"><span>Reference</span><input maxLength="100" value={movementForm.reference} onChange={e=>setMovementForm({...movementForm,reference:e.target.value})} placeholder="Invoice, issue voucher or approval"/></label>
          <label className="field"><span>Destination / recipient</span><input maxLength="160" value={movementForm.destination} onChange={e=>setMovementForm({...movementForm,destination:e.target.value})}/></label>
          <label className="field"><span>Notes</span><input maxLength="1000" value={movementForm.notes} onChange={e=>setMovementForm({...movementForm,notes:e.target.value})}/></label>
        </div><p className="field-help">Issues and transfers reduce stock. The server rejects movements that would create a negative balance. Opening stock can only be entered once.</p>
        <div className="editor-actions"><button type="button" className="secondary-button" onClick={()=>setShowMovementForm(false)}>Cancel</button><button className="gold-button" disabled={saving}>{saving?'Recording…':'Save movement'}</button></div>
      </form>}
      <div className="inventory-movement-history"><h4><ClipboardList size={17}/> Recent movements</h4>
        {!movements.length&&<p className="field-help">No stock movements have been recorded for this item.</p>}
        {movements.map(movement=><article key={movement._id}><div><b>{movementLabels[movement.movementType]||movement.movementType}</b><small>{dateLabel(movement.createdAt)} · {movement.performedBy?.fullName||'Authorised user'}{movement.reference?' · '+movement.reference:''}</small><small>{movement.notes||movement.destination||'No additional notes'}</small></div><strong>{movement.delta>0?'+':''}{numberLabel(movement.delta)} {selected.unit}<small>Balance: {numberLabel(movement.balanceAfter)}</small></strong></article>)}
      </div>
    </section>}
  </section>;
}
