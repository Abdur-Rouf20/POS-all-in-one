import { useEffect, useState } from 'react';
import { api } from '../services/api.js';

const emptyForm = {
  name: '',
  code: '',
  address: '',
  phone: '',
  active: true
};

export default function Branches() {
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
        setMessage('Branch updated successfully.');
      } else {
        await api.createBranch(form);
        setMessage('Branch created successfully.');
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
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Branch Management</h1>
          <p>Create and manage your shop branches.</p>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}
      {message && <div className="success-banner">{message}</div>}

      <section className="panel">
        <h2>{editingId ? 'Edit Branch' : 'Add New Branch'}</h2>

        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <label>
              Branch Name *
              <input
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder="e.g. Dhanmondi Branch"
                required
              />
            </label>

            <label>
              Branch Code *
              <input
                name="code"
                value={form.code}
                onChange={handleChange}
                placeholder="e.g. DHA-01"
                required
              />
            </label>

            <label>
              Phone
              <input
                name="phone"
                value={form.phone}
                onChange={handleChange}
                placeholder="Branch phone number"
              />
            </label>

            <label>
              Address
              <input
                name="address"
                value={form.address}
                onChange={handleChange}
                placeholder="Branch address"
              />
            </label>
          </div>

          {editingId && (
            <label className="checkbox-label">
              <input
                type="checkbox"
                name="active"
                checked={form.active}
                onChange={handleChange}
              />
              Active branch
            </label>
          )}

          <div className="form-actions">
            <button type="submit" disabled={saving}>
              {saving
                ? 'Saving...'
                : editingId
                  ? 'Update Branch'
                  : 'Create Branch'}
            </button>

            {editingId && (
              <button type="button" className="secondary-button" onClick={resetForm}>
                Cancel
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="panel">
        <h2>All Branches ({branches.length})</h2>

        {loading ? (
          <p>Loading branches...</p>
        ) : branches.length === 0 ? (
          <p>No branches found.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Branch</th>
                  <th>Code</th>
                  <th>Phone</th>
                  <th>Address</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {branches.map(branch => (
                  <tr key={branch._id}>
                    <td>{branch.name}</td>
                    <td>{branch.code}</td>
                    <td>{branch.phone || '—'}</td>
                    <td>{branch.address || '—'}</td>
                    <td>{branch.active === false ? 'Inactive' : 'Active'}</td>
                    <td>
                      <button type="button" onClick={() => startEdit(branch)}>
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}