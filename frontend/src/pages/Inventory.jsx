import { useEffect, useMemo, useState } from 'react';
import { api } from '../services/api.js';

export default function Inventory({ t, settings, lang }) {
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
  const locale = lang === 'bn' ? 'bn-BD' : 'en-US';
  const money = value => `${settings?.currency || '৳'} ${Number(value || 0).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

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
      setMessage(t.stockReceived
        .replace('{batch}', result.batch.batchNo)
        .replace('{review}', result.batch.costStatus === 'pending_owner' ? t.needsOwnerReview : ''));
      setQuantity('1'); setNote(''); setPurchasePrice('');
      await load();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  async function saveCost(batchId) {
    setError(''); setMessage('');
    try {
      await api.updateBatchCost(batchId, Number(costDrafts[batchId]));
      setMessage(t.batchCostUpdated);
      await load();
    } catch (e) { setError(e.message); }
  }

  const totalUnits = rows.reduce((sum, row) => sum + Number(row.quantity || 0), 0);

  return <>
    <div className="page-heading">
      <div><h1>{t.branchInventory}</h1><p className="muted">{t.inventoryHint}</p></div>
    </div>
    {error && <div className="alert error">{error}</div>}
    {message && <div className="alert success">{message}</div>}
    <div className="stats-grid">
      <div className="stat-card"><span className="muted">{t.productsInBranch}</span><strong>{rows.length}</strong></div>
      <div className="stat-card"><span className="muted">{t.totalAvailableUnits}</span><strong>{totalUnits.toLocaleString(locale)}</strong></div>
      <div className="stat-card"><span className="muted">{t.activeBatches}</span><strong>{batches.filter(batch => batch.quantity > 0).length}</strong></div>
    </div>
    <section className="panel form-panel">
      <div className="panel-title"><div><h2>{t.receiveStock}</h2><p className="muted">{t.receiveStockHint}</p></div></div>
      <form onSubmit={receive} className="form-grid three">
        <div className="field"><label>{t.existingProduct} *</label><select required value={productId} onChange={e => changeProduct(e.target.value)}><option value="">{t.chooseProduct}</option>{products.map(product => <option key={product._id} value={product._id}>{product.name}{product.sku ? ` · ${product.sku}` : ''}</option>)}</select></div>
        <div className="field"><label>{t.quantityReceived} *</label><input type="number" min="0.0001" step="0.0001" required value={quantity} onChange={e => setQuantity(e.target.value)}/></div>
        <div className="field"><label>{t.batchSellingPrice} *</label><input type="number" min="0" step="0.01" required value={sellingPrice} onChange={e => setSellingPrice(e.target.value)}/></div>
        {isOwner && <div className="field"><label>{t.buyingUnitPrice} *</label><input type="number" min="0" step="0.01" required value={purchasePrice} onChange={e => setPurchasePrice(e.target.value)} placeholder={t.ownerOnly}/></div>}
        <div className="field"><label>{t.receivedDate} *</label><input type="date" required value={receivedAt} onChange={e => setReceivedAt(e.target.value)}/></div>
        <div className="field"><label>{t.noteSupplier}</label><input value={note} onChange={e => setNote(e.target.value)} placeholder={t.optional}/></div>
        <div><button className="button primary" disabled={busy || !products.length}>{busy ? t.saving : t.recordStockReceipt}</button></div>
      </form>
      {!isOwner && <p className="field-help">{t.buyingCostHidden}</p>}
    </section>
    <section className="panel table-panel">
      <div className="panel-title"><div><h2>{t.currentBranchStock}</h2><p className="muted">{t.stockSummaryHint}</p></div></div>
      <div className="table-scroll"><table><thead><tr><th>{t.product}</th><th>{t.sku}</th><th>{t.category}</th><th className="right">{t.availableLabel}</th><th>{t.batchBreakdown}</th></tr></thead><tbody>
        {rows.map(row => <tr key={row._id}>
          <td>{row.productId?.name}</td><td>{row.productId?.sku || '—'}</td><td>{row.productId?.category || row.productId?.categoryId?.name || '—'}</td><td className="right">{row.quantity}</td>
          <td><div className="batch-list">{(row.batches || []).map(batch => <div className="batch-row" key={batch._id}>
            <div><strong>{batch.batchNo}</strong><small>{new Date(batch.receivedAt).toLocaleDateString(locale)} · {batch.quantity} {t.remaining} · {t.sellingPriceLabel} {money(batch.sellingPrice)}</small></div>
            {isOwner && <div className="batch-cost-editor">{batch.costStatus === 'confirmed' ? <span>{t.buy} {money(batch.purchasePrice)}</span> : <><input aria-label={t.buyingCostFor.replace('{batch}', batch.batchNo)} type="number" min="0" step="0.01" placeholder={t.setBuyingCost} value={costDrafts[batch._id] ?? ''} onChange={e => setCostDrafts(old => ({ ...old, [batch._id]: e.target.value }))}/><button type="button" className="button secondary compact" disabled={costDrafts[batch._id] === undefined || costDrafts[batch._id] === ''} onClick={() => saveCost(batch._id)}>{t.saveCost}</button></>}</div>}
            {!isOwner && batch.costStatus === 'pending_owner' && <span className="muted">{t.costPendingOwner}</span>}
          </div>)}{!row.batches?.length && <span className="muted">{t.noBatchRecords}</span>}</div></td>
        </tr>)}
        {!rows.length && <tr><td colSpan="5">{t.noStockRecorded}</td></tr>}
      </tbody></table></div>
    </section>
    <section className="panel table-panel">
      <div className="panel-title"><div><h2>{t.batchRegister}</h2><p className="muted">{t.batchRegisterHint}</p></div></div>
      <div className="table-scroll"><table><thead><tr><th>{t.batch}</th><th>{t.product}</th><th>{t.received}</th><th className="right">{t.remaining}</th><th className="right">{t.sellingPriceLabel}</th>{isOwner && <th className="right">{t.buyingPrice}</th>}<th>{t.costStatus}</th></tr></thead><tbody>
        {batches.map(batch => <tr key={batch._id}><td>{batch.batchNo}</td><td>{batch.productId?.name || '—'}</td><td>{new Date(batch.receivedAt).toLocaleDateString(locale)}</td><td className="right">{batch.quantity.toLocaleString(locale)}</td><td className="right">{money(batch.sellingPrice)}</td>{isOwner && <td className="right">{batch.purchasePrice == null ? t.notSet : money(batch.purchasePrice)}</td>}<td>{batch.costStatus === 'confirmed' ? t.confirmed : t.pendingOwner}</td></tr>)}
        {!batches.length && <tr><td colSpan={isOwner ? 7 : 6}>{t.noBatches}</td></tr>}
      </tbody></table></div>
    </section>
  </>;
}
