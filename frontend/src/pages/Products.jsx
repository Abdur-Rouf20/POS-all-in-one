import { useEffect, useState } from 'react';
import { Search, Plus, Pencil, Power, Package } from 'lucide-react';
import { api } from '../services/api.js';
import Modal from '../components/Modal.jsx';

const emptyForm = { name: '', sku: '', barcode: '', categoryId: '', description: '', price: '', unit: 'pcs' };

export default function Products({ t, settings, user }) {
  const [rows, setRows] = useState([]);
  const [categories, setCategories] = useState([]);
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const isOwner = user?.role === 'owner';

  async function load() {
    try {
      const [products, categoryRows] = await Promise.all([api.products(q, isOwner), api.categories()]);
      setRows(products); setCategories(categoryRows); setError('');
    } catch (e) { setError(e.message); }
  }
  useEffect(() => { load(); }, [q]);

  function open(product = null) {
    setEditing(product || 'new');
    setForm(product ? {
      name: product.name || '', sku: product.sku || '', barcode: product.barcode || '',
      categoryId: product.categoryId?._id || product.categoryId || '',
      description: product.description || '', price: String(product.price ?? ''), unit: product.unit || 'pcs'
    } : { ...emptyForm, categoryId: categories[0]?._id || '' });
    setError('');
  }

  async function save(event) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const body = { ...form, price: Number(form.price) };
      if (editing === 'new') await api.createProduct(body);
      else await api.updateProduct(editing._id, body);
      setEditing(null); await load();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  async function toggleActive(product) {
    const action = product.active === false ? 'reactivate' : 'deactivate';
    if (!confirm(`Are you sure you want to ${action} ${product.name}?`)) return;
    try { await api.updateProduct(product._id, { active: product.active === false }); await load(); }
    catch (e) { setError(e.message); }
  }

  const money = amount => `${settings?.currency || '৳'} ${Number(amount || 0).toFixed(2)}`;

  return <>
    <div className="page-heading">
      <div><div className="eyebrow">CATALOG</div><h1>{t.productSetup}</h1><p className="muted">Browse products. The Owner manages product definitions and selling prices.</p></div>
      {isOwner && <button className="button primary" onClick={() => open()}><Plus size={17}/>{t.addProduct}</button>}
    </div>
    {error && <div className="alert error">{error}</div>}
    <section className="panel">
      <div className="toolbar"><div className="searchbox"><Search size={17}/><input value={q} onChange={e => setQ(e.target.value)} placeholder={t.searchProducts}/></div><span className="count-pill">{rows.length} items</span></div>
      <div className="table-wrap"><table><thead><tr><th>{t.name}</th><th>{t.sku}</th><th>Category</th><th>Unit</th><th className="right">Default selling price</th>{isOwner && <th className="right">Actions</th>}</tr></thead>
        <tbody>{rows.map(product => <tr key={product._id}>
          <td><div className="product-cell"><span className="product-thumb"><Package size={18}/></span><strong>{product.name}</strong></div></td>
          <td className="muted">{product.sku || '—'}</td>
          <td><span className="category-pill">{product.categoryId?.name || product.category || 'General'}</span></td>
          <td>{product.unit || 'pcs'}</td>
          <td className="right amount">{money(product.price)}</td>
          {isOwner && <td><div className="row-actions"><button className="icon-button" title="Edit product" onClick={() => open(product)}><Pencil size={16}/></button><button className="icon-button" title={product.active === false ? 'Reactivate' : 'Deactivate'} onClick={() => toggleActive(product)}><Power size={16}/></button></div></td>}
        </tr>)}{!rows.length && <tr><td colSpan={isOwner ? 6 : 5} className="empty-cell">{t.noProducts}</td></tr>}</tbody>
      </table></div>
    </section>
    {editing && <Modal title={editing === 'new' ? t.addProduct : t.editProduct} onClose={() => setEditing(null)}>
      <form onSubmit={save} className="form-stack">
        <div className="field"><label>Product name *</label><input required maxLength={150} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}/></div>
        <div className="form-grid">
          <div className="field"><label>SKU</label><input value={form.sku} onChange={e => setForm({ ...form, sku: e.target.value })} placeholder="Unique product code"/></div>
          <div className="field"><label>Barcode</label><input value={form.barcode} onChange={e => setForm({ ...form, barcode: e.target.value })}/></div>
          <div className="field"><label>Category *</label><select required value={form.categoryId} onChange={e => setForm({ ...form, categoryId: e.target.value })}><option value="">Select category</option>{categories.map(category => <option key={category._id} value={category._id}>{category.name}</option>)}</select></div>
          <div className="field"><label>Default selling price *</label><input type="number" min="0" step="0.01" required value={form.price} onChange={e => setForm({ ...form, price: e.target.value })}/></div>
          <div className="field"><label>Unit</label><input value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} placeholder="pcs, box, kg"/></div>
        </div>
        <div className="field"><label>Description</label><textarea rows="3" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}/></div>
        <p className="muted small">Stock quantities and buying prices are managed through stock receiving and batch records, not in product setup.</p>
        {error && <div className="alert error">{error}</div>}
        <div className="modal-actions"><button type="button" className="button secondary" onClick={() => setEditing(null)}>{t.cancel}</button><button className="button primary" disabled={busy || !categories.length}>{busy ? 'Saving…' : t.save}</button></div>
      </form>
    </Modal>}
  </>;
}
