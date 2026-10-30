import { useEffect, useMemo, useState } from 'react';
import { api } from '../services/api.js';

const money = value => `৳${Number(value || 0).toFixed(2)}`;

export default function Inventory() {
  const user = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('pos-user') || 'null'); }
    catch { return null; }
  }, []);
  const isOwner = user?.role === 'owner';
  const [rows, setRows] = useState([]);
  const [products, setProducts] = useState([]);
  const [batches, setBatches] = useState([]);
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [sellingPrice, setSellingPrice] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [receivedAt, setReceivedAt] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState('');
  const [costDrafts, setCostDrafts] = useState({});
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    const [inventory, productList, batchList] = await Promise.all([api.inventory(), api.products(), api.batches()]);
    setRows(inventory);
    setProducts(productList);
    setBatches(batchList);
    if (!productId && productList.length) {
      setProductId(productList[0]._id);
      setSellingPrice(String(productList[0].price ?? ''));
    }
  }

  useEffect(() => { load().catch(e => setError(e.message)); }, []);

  function changeProduct(id) {
    setProductId(id);
    const product = products.find(item => item._id === id);
    setSellingPrice(String(product?.price ?? ''));
  }

  async function receive(event) {
    event.preventDefault(); setError(''); setMessage(''); setBusy(true);
    try {
      const body = { productId, quantity: Number(quantity), sellingPrice: Number(sellingPrice), receivedAt, note };
      if (isOwner) body.purchasePrice = Number(purchasePrice);
      const result = await api.receiveStock(body);
      setMessage(`Stock received successfully. Batch: ${result.batch.batchNo}${result.batch.costStatus === 'pending_owner' ? ' — buying cost needs Owner review.' : ''}`);
      setQuantity('1'); setNote(''); setPurchasePrice('');
      await load();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  async function saveCost(batchId) {
    setError(''); setMessage('');
    try {
      await api.updateBatchCost(batchId, Number(costDrafts[batchId]));
      setMessage('Batch buying cost updated.');
      await load();
    } catch (e) { setError(e.message); }
  }

  const totalUnits = rows.reduce((sum, row) => sum + Number(row.quantity || 0), 0);

  return <>
    <div className="page-heading">
      <div><h1>Branch inventory</h1><p className="muted">Receive stock into product batches and review batch-level availability.</p></div>
    </div>
    {error && <div className="alert error">{error}</div>}
    {message && <div className="alert success">{message}</div>}
    <div className="stats-grid">
      <div className="stat-card"><span className="muted">Products in this branch</span><strong>{rows.length}</strong></div>
      <div className="stat-card"><span className="muted">Total available units</span><strong>{totalUnits.toLocaleString()}</strong></div>
      <div className="stat-card"><span className="muted">Active batches</span><strong>{batches.filter(batch => batch.quantity > 0).length}</strong></div>
    </div>
    <section className="panel form-panel">
      <div className="panel-title"><div><h2>Receive stock</h2><p className="muted">Every receipt creates a new branch-specific batch with an automatic batch number.</p></div></div>
      <form onSubmit={receive} className="form-grid three">
        <div className="field"><label>Existing product *</label><select required value={productId} onChange={e => changeProduct(e.target.value)}><option value="">Select product</option>{products.map(product => <option key={product._id} value={product._id}>{product.name}{product.sku ? ` · ${product.sku}` : ''}</option>)}</select></div>
        <div className="field"><label>Quantity received *</label><input type="number" min="0.0001" step="0.0001" required value={quantity} onChange={e => setQuantity(e.target.value)}/></div>
        <div className="field"><label>Batch selling price *</label><input type="number" min="0" step="0.01" required value={sellingPrice} onChange={e => setSellingPrice(e.target.value)}/></div>
        {isOwner && <div className="field"><label>Buying unit price *</label><input type="number" min="0" step="0.01" required value={purchasePrice} onChange={e => setPurchasePrice(e.target.value)} placeholder="Owner only"/></div>}
        <div className="field"><label>Received date *</label><input type="date" required value={receivedAt} onChange={e => setReceivedAt(e.target.value)}/></div>
        <div className="field"><label>Note / supplier reference</label><input value={note} onChange={e => setNote(e.target.value)} placeholder="Optional"/></div>
        <div><button className="button primary" disabled={busy || !products.length}>{busy ? 'Saving…' : 'Record stock receipt'}</button></div>
      </form>
      {!isOwner && <p className="field-help">Buying cost is hidden. This batch will be marked for Owner cost review before profit reporting.</p>}
    </section>
    <section className="panel table-panel">
      <div className="panel-title"><div><h2>Current branch stock</h2><p className="muted">Stock totals are summarized by product and expanded by batch.</p></div></div>
      <div className="table-scroll"><table><thead><tr><th>Product</th><th>SKU</th><th>Category</th><th className="right">Available</th><th>Batch breakdown</th></tr></thead><tbody>
        {rows.map(row => <tr key={row._id}>
          <td>{row.productId?.name}</td><td>{row.productId?.sku || '—'}</td><td>{row.productId?.category || row.productId?.categoryId?.name || '—'}</td><td className="right">{row.quantity}</td>
          <td><div className="batch-list">{(row.batches || []).map(batch => <div className="batch-row" key={batch._id}>
            <div><strong>{batch.batchNo}</strong><small>{new Date(batch.receivedAt).toLocaleDateString()} · {batch.quantity} remaining · Sell {money(batch.sellingPrice)}</small></div>
            {isOwner && <div className="batch-cost-editor">{batch.costStatus === 'confirmed' ? <span>Buy {money(batch.purchasePrice)}</span> : <><input aria-label={`Buying cost for ${batch.batchNo}`} type="number" min="0" step="0.01" placeholder="Set buying cost" value={costDrafts[batch._id] ?? ''} onChange={e => setCostDrafts(old => ({ ...old, [batch._id]: e.target.value }))}/><button type="button" className="button secondary compact" disabled={costDrafts[batch._id] === undefined || costDrafts[batch._id] === ''} onClick={() => saveCost(batch._id)}>Save cost</button></>}</div>}
            {!isOwner && batch.costStatus === 'pending_owner' && <span className="muted">Cost pending Owner review</span>}
          </div>)}{!row.batches?.length && <span className="muted">No batch records</span>}</div></td>
        </tr>)}
        {!rows.length && <tr><td colSpan="5">No stock recorded for this branch yet.</td></tr>}
      </tbody></table></div>
    </section>
    <section className="panel table-panel">
      <div className="panel-title"><div><h2>Batch register</h2><p className="muted">Chronological receipt records for the selected branch.</p></div></div>
      <div className="table-scroll"><table><thead><tr><th>Batch</th><th>Product</th><th>Received</th><th className="right">Remaining</th><th className="right">Selling price</th>{isOwner && <th className="right">Buying price</th>}<th>Cost status</th></tr></thead><tbody>
        {batches.map(batch => <tr key={batch._id}><td>{batch.batchNo}</td><td>{batch.productId?.name || '—'}</td><td>{new Date(batch.receivedAt).toLocaleDateString()}</td><td className="right">{batch.quantity}</td><td className="right">{money(batch.sellingPrice)}</td>{isOwner && <td className="right">{batch.purchasePrice == null ? 'Not set' : money(batch.purchasePrice)}</td>}<td>{batch.costStatus === 'confirmed' ? 'Confirmed' : 'Pending Owner'}</td></tr>)}
        {!batches.length && <tr><td colSpan={isOwner ? 7 : 6}>No batches found.</td></tr>}
      </tbody></table></div>
    </section>
  </>;
}
