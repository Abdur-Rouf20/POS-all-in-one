import { useEffect, useState } from 'react';
import { api } from '../services/api.js';

const emptyForm = {
  name: '',
  email: '',
  password: '',
  branchId: ''
};

export default function Users() {
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

      setMessage('Salesman account created successfully.');
      setForm(emptyForm);
      await loadData();
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
          <h1>User Management</h1>
          <p>Create salesman accounts and assign them to branches.</p>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}
      {message && <div className="success-banner">{message}</div>}

      <section className="panel">
        <h2>Create Salesman Account</h2>

        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <label>
              Full Name *
              <input
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder="Salesman name"
                required
              />
            </label>

            <label>
              Email *
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                placeholder="salesman@example.com"
                required
              />
            </label>

            <label>
              Password *
              <input
                type="password"
                name="password"
                value={form.password}
                onChange={handleChange}
                placeholder="Create a password"
                minLength={8}
                required
              />
            </label>

            <label>
              Assigned Branch *
              <select
                name="branchId"
                value={form.branchId}
                onChange={handleChange}
                required
              >
                <option value="">Select a branch</option>
                {branches.map(branch => (
                  <option key={branch._id} value={branch._id}>
                    {branch.name} ({branch.code})
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="form-actions">
            <button type="submit" disabled={saving || branches.length === 0}>
              {saving ? 'Creating...' : 'Create Salesman'}
            </button>
          </div>

          {branches.length === 0 && !loading && (
            <p>Create a branch before creating a salesman account.</p>
          )}
        </form>
      </section>

      <section className="panel">
        <h2>Users ({users.length})</h2>

        {loading ? (
          <p>Loading users...</p>
        ) : users.length === 0 ? (
          <p>No users found.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Branch</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {users.map(user => (
                  <tr key={user._id}>
                    <td>{user.name}</td>
                    <td>{user.email}</td>
                    <td>{user.role}</td>
                    <td>
  {user.role === 'owner'
    ? 'All branches'
    : (
        branches.find(
          b => b._id === (user.branchId?._id || user.branchId)
        )?.name || 'Not assigned'
      )}
</td>
                    <td>{user.active === false ? 'Inactive' : 'Active'}</td>
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