import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { api } from '../services/api.js';

const emptyForm = {
  name: '',
  email: '',
  password: '',
  branchId: ''
};

export default function Users({ t }) {
  const [users, setUsers] = useState([]);
  const [branches, setBranches] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function loadData() {
    try {
      setLoading(true);
      setError('');
      const [userData, branchData] = await Promise.all([
        api.users(),
        api.branches()
      ]);
      setUsers(userData);
      setBranches(branchData);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function handleChange(e) {
    setForm(current => ({
      ...current,
      [e.target.name]: e.target.value
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      setSaving(true);
      setError('');
      setMessage('');
      await api.createSalesman(form);
      setMessage(t.salesmanCreated);
      setForm(emptyForm);
      await loadData();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return <>
    <div className="page-heading">
      <div>
        <div className="eyebrow">{t.teamManagement}</div>
        <h1>{t.userManagement}</h1>
        <p className="muted">{t.userManagementHint}</p>
      </div>
    </div>

    {error && <div className="alert error" role="alert">{error}</div>}
    {message && <div className="alert success" role="status">{message}</div>}

    <section className="panel form-panel">
      <div className="panel-title">
        <div>
          <h2>{t.createSalesmanAccount}</h2>
          <p className="muted">{t.userManagementHint}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="salesman-name">{t.fullName} *</label>
            <input id="salesman-name" name="name" value={form.name} onChange={handleChange} placeholder={t.salesmanName} required />
          </div>
          <div className="field">
            <label htmlFor="salesman-email">{t.email} *</label>
            <input id="salesman-email" type="email" name="email" value={form.email} onChange={handleChange} placeholder={t.salesmanEmailPlaceholder} required />
          </div>
          <div className="field">
            <label htmlFor="salesman-password">{t.password} *</label>
            <input id="salesman-password" type="password" name="password" value={form.password} onChange={handleChange} placeholder={t.createPassword} minLength={8} required />
          </div>
          <div className="field">
            <label htmlFor="salesman-branch">{t.assignedBranch} *</label>
            <select id="salesman-branch" name="branchId" value={form.branchId} onChange={handleChange} required>
              <option value="">{t.selectBranch}</option>
              {branches.map(branch => (
                <option key={branch._id} value={branch._id}>
                  {branch.name} ({branch.code})
                </option>
              ))}
            </select>
          </div>
        </div>

        {branches.length === 0 && !loading && (
          <p className="field-help user-branch-hint">{t.createBranchFirst}</p>
        )}
        <div className="user-form-actions">
          <button type="submit" className="button primary" disabled={saving || branches.length === 0}>
            <Plus size={16}/>{saving ? t.creating : t.createSalesman}
          </button>
        </div>
      </form>
    </section>

    <section className="panel user-list-panel">
      <div className="panel-head">
        <div>
          <h2>{t.usersCount.replace('{count}', String(users.length))}</h2>
          <p className="muted">{t.userManagementHint}</p>
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>{t.nameLabel}</th>
              <th>{t.email}</th>
              <th>{t.roleOwner} / {t.roleSalesman}</th>
              <th>{t.branch}</th>
              <th>{t.categoryStatus}</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user._id}>
                <td><strong>{user.name}</strong></td>
                <td>{user.email}</td>
                <td>{user.role === 'owner' ? t.roleOwner : t.roleSalesman}</td>
                <td>{user.role === 'owner'
                  ? t.allBranchesValue
                  : branches.find(branch => branch._id === (user.branchId?._id || user.branchId))?.name || t.notAssigned}
                </td>
                <td>
                  <span className={user.active === false ? 'stock-low' : 'stock-good'}>
                    {user.active === false ? t.inactive : t.active}
                  </span>
                </td>
              </tr>
            ))}
            {!loading && users.length === 0 && (
              <tr><td colSpan="5" className="empty-cell">{t.noUsers}</td></tr>
            )}
            {loading && (
              <tr><td colSpan="5" className="empty-cell">{t.loadingUsers}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  </>;
}
