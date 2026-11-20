import { useState } from 'react';
import { Store, LogIn } from 'lucide-react';
import { api } from '../services/api.js';

export default function Login({ onLogin, t }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const data = await api.login({ email, password });
      localStorage.setItem('pos-token', data.token);
      localStorage.setItem('pos-user', JSON.stringify(data.user));
      const branches = await api.branches();
      if (branches.length && !localStorage.getItem('pos-branch')) {
        localStorage.setItem('pos-branch', branches[0]._id);
      }
      onLogin(data.user);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-screen">
      <form className="login-card" onSubmit={submit}>
        <div className="login-brand"><Store size={28}/><h1>Simple POS</h1></div>
        <p>{t.loginSubtitle}</p>
        <label>{t.email}<input type="email" value={email} onChange={event => setEmail(event.target.value)} required autoComplete="username"/></label>
        <label>{t.password}<input type="password" value={password} onChange={event => setPassword(event.target.value)} required autoComplete="current-password"/></label>
        {error && <div className="error-text" role="alert">{error}</div>}
        <button className="primary-button" disabled={busy}><LogIn size={16}/>{busy ? t.signingIn : t.signIn}</button>
        <small>{t.firstRunHint}</small>
      </form>
    </div>
  );
}
