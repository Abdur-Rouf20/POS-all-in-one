import { useEffect, useState } from 'react';
import { Plus, Pencil, Tags, Power } from 'lucide-react';
import { api } from '../services/api.js';
import Modal from '../components/Modal.jsx';

const emptyForm = { name: '', description: '' };

export default function Categories({ t }) {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    try { setRows(await api.categories(true)); setError(''); }
    catch (e) { setError(e.message); }
  }
  useEffect(() => { load(); }, []);

  function open(category = null) {
    setEditing(category || 'new');
    setForm(category ? { name: category.name, description: category.description || '' } : emptyForm);
    setError('');
  }

  async function save(event) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      if (editing === 'new') await api.createCategory(form);
      else await api.updateCategory(editing._id, form);
      setEditing(null); await load();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  async function toggle(category) {
    try { await api.updateCategory(category._id, { active: !category.active }); await load(); }
    catch (e) { setError(e.message); }
  }

  return <>
    <div className="page-heading">
      <div><div className="eyebrow">{t.productCatalog}</div><h1>{t.navCategories}</h1><p className="muted">{t.manageCategories}</p></div>
      <button className="button primary" onClick={() => open()}><Plus size={17}/> {t.addCategory}</button>
    </div>
    {error && <div className="alert error">{error}</div>}
    <section className="panel">
      <div className="panel-title"><h2>{t.categoriesCount.replace('{count}', String(rows.length))}</h2></div>
      <div className="table-wrap"><table><thead><tr><th>{t.category}</th><th>{t.description}</th><th>{t.categoryStatus}</th><th className="right">{t.actions}</th></tr></thead>
        <tbody>{rows.map(row => <tr key={row._id}>
          <td><div className="product-cell"><span className="product-thumb"><Tags size={17}/></span><strong>{row.name}</strong></div></td>
          <td className="muted">{row.description || '—'}</td>
          <td><span className={row.active ? 'stock-good' : 'stock-low'}>{row.active ? t.active : t.inactive}</span></td>
          <td><div className="row-actions"><button className="icon-button" title={t.edit} aria-label={t.edit} onClick={() => open(row)}><Pencil size={16}/></button><button className="icon-button" title={row.active ? t.deactivate : t.activate} aria-label={row.active ? t.deactivate : t.activate} onClick={() => toggle(row)}><Power size={16}/></button></div></td>
        </tr>)}{!rows.length && <tr><td colSpan="4" className="empty-cell">{t.noCategories}</td></tr>}</tbody>
      </table></div>
    </section>
    {editing && <Modal title={editing === 'new' ? t.createCategory : t.editCategory} closeLabel={t.close} onClose={() => setEditing(null)}>
      <form className="form-stack" onSubmit={save}>
        <div className="field"><label>{t.categoryName} *</label><input autoFocus required maxLength={80} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder={t.categoryExample}/></div>
        <div className="field"><label>{t.description}</label><textarea rows="3" maxLength={300} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder={t.optionalDescription}/></div>
        {error && <div className="alert error">{error}</div>}
        <div className="modal-actions"><button type="button" className="button secondary" onClick={() => setEditing(null)}>{t.cancel}</button><button className="button primary" disabled={busy}>{busy ? t.saving : t.saveCategory}</button></div>
      </form>
    </Modal>}
  </>;
}
