import { useState } from 'react';
import { api, setToken } from './api.js';

const DEMO = [
  { email: 'alice@ajaia.test', name: 'Alice Owner' },
  { email: 'bob@ajaia.test', name: 'Bob Reviewer' },
  { email: 'carol@ajaia.test', name: 'Carol Editor' },
];

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('alice@ajaia.test');
  const [password, setPassword] = useState('demo1234');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e, override) => {
    e?.preventDefault();
    setBusy(true);
    setError('');
    try {
      const d = await api('/login', { method: 'POST', body: override || { email, password } });
      setToken(d.token);
      onLogin(d.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-wrap">
      <form className="card login" onSubmit={submit}>
        <h1><span className="logo">▤</span> Ajaia Docs</h1>
        <p className="muted">Sign in with a demo account to try editing and sharing.</p>
        <label>Email<input value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" /></label>
        <label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" /></label>
        {error && <div className="error">{error}</div>}
        <button className="btn primary" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        <div className="demo">
          <div className="muted small">Quick sign-in (password <code>demo1234</code>):</div>
          {DEMO.map((u) => (
            <button type="button" key={u.email} className="btn ghost small" disabled={busy}
              onClick={() => submit(null, { email: u.email, password: 'demo1234' })}>
              {u.name}
            </button>
          ))}
        </div>
      </form>
    </div>
  );
}
