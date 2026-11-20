import { useEffect, useState } from 'react';
import { Pencil } from 'lucide-react';
import { api } from '../services/api.js';

const emptyForm = {
  name: '',
  code: '',
  address: '',
  phone: '',
  active: true
};

export default function Branches({ t }) {
  const [branches, setBranches] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function loadBranches() {
    try {
      setLoading(true);
      setError('');
      const data = await api.branches();
      setBranches(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBranches();
  }, []);

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    setForm(current => ({
      ...current,
      [name]: type === 'checkbox' ? checked : value
    }));
  }

  function startEdit(branch) {
    setEditingId(branch._id);
    setForm({
      name: branch.name || '',
      code: branch.code || '',
      address: branch.address || '',
      phone: branch.phone || '',
      active: branch.active !== false
    });
    setMessage('');
    setError('');
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
  }

  async function handleSubmit(e) {
    e.preventDefault();

    try {
      setSaving(true);
      setError('');
      setMessage('');

      if (editingId) {
        await api.updateBranch(editingId, form);
        setMessage(t.branchUpdated);
      } else {
        await api.createBranch(form);
        setMessage(t.branchCreated);
      }

      resetForm();
      await loadBranches();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">{t.branch}</div>
          <h1>{t.branchManagement}</h1>
          <p className="muted">{t.manageBranches}</p>
        </div>
      </div>

      {error && <div className="alert error" role="alert">{error}</div>}
      {message && <div className="alert success" role="status">{message}</div>}

      <section className="panel form-panel">
        <div className="panel-title">
          <div>
            <h2>{editingId ? t.editBranch : t.addBranch}</h2>
            <p className="muted">{t.manageBranches}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="branch-name">{t.branchName} *</label>
              <input
                id="branch-name"
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder="যেমন: ধানমন্ডি শাখা"
                required
              />
            </div>

            <div className="field">
              <label htmlFor="branch-code">{t.branchCode} *</label>
              <input
                id="branch-code"
                name="code"
                value={form.code}
                onChange={handleChange}
                placeholder="যেমন: DHA-01"
                required
              />
            </div>

            <div className="field">
              <label htmlFor="branch-phone">{t.phone}</label>
              <input
                id="branch-phone"
                name="phone"
                value={form.phone}
                onChange={handleChange}
                placeholder={t.branchPhone}
              />
            </div>

            <div className="field">
              <label htmlFor="branch-address">{t.address}</label>
              <input
                id="branch-address"
                name="address"
                value={form.address}
                onChange={handleChange}
                placeholder={t.branchAddress}
              />
            </div>
          </div>

          {editingId && (
            <label className="branch-active-toggle">
              <input
                type="checkbox"
                name="active"
                checked={form.active}
                onChange={handleChange}
              />
              {t.activeBranch}
            </label>
          )}

          <div className="branch-form-actions">
            <button type="submit" className="button primary" disabled={saving}>
              {saving
                ? t.savingDots
                : editingId
                  ? t.updateBranch
                  : t.createBranch}
            </button>

            {editingId && (
              <button type="button" className="button secondary" onClick={resetForm}>
                {t.cancel}
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="panel">
        <div className="branch-list-heading">
          <h2>{t.allBranches.replace('{count}', String(branches.length))}</h2>
        </div>

        {loading ? (
          <p>{t.loadingBranches}</p>
        ) : branches.length === 0 ? (
          <p>{t.noBranches}</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t.branch}</th>
                  <th>{t.branchCode}</th>
                  <th>{t.phone}</th>
                  <th>{t.address}</th>
                  <th>{t.categoryStatus}</th>
                  <th className="right">{t.action}</th>
                </tr>
              </thead>
              <tbody>
                {branches.map(branch => (
                  <tr key={branch._id}>
                    <td>{branch.name}</td>
                    <td>{branch.code}</td>
                    <td>{branch.phone || '—'}</td>
                    <td>{branch.address || '—'}</td>
                    <td>{branch.active === false ? t.inactive : t.active}</td>
                    <td className="right">
                      <button
                        type="button"
                        className="icon-button"
                        title={t.edit}
                        aria-label={`${t.edit}: ${branch.name}`}
                        onClick={() => startEdit(branch)}
                      >
                        <Pencil size={16}/>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}