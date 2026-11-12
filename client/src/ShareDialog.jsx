import { useEffect, useState } from 'react';
import { api } from './api.js';

export default function ShareDialog({ doc, user, onClose }) {
  const isOwner = doc.role === 'owner';
  const [shares, setShares] = useState([]);
  const [users, setUsers] = useState([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('viewer');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api(`/documents/${doc.id}/shares`).then((d) => setShares(d.shares)).catch((e) => setError(e.message));
    api('/users').then((d) => setUsers(d.users)).catch(() => {});
  }, [doc.id]);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const run = async (fn) => {
    setBusy(true);
    setError('');
    try { setShares((await fn()).shares); } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  const add = (e) => {
    e.preventDefault();
    if (!email.trim()) return setError('Enter an email address');
    run(() => api(`/documents/${doc.id}/shares`, { method: 'POST', body: { email, role } })).then(() => setEmail(''));
  };

  const candidates = users.filter((u) => u.id !== user.id && !shares.some((s) => s.user_id === u.id));

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="card modal" role="dialog" aria-label="Share document">
        <h3>{isOwner ? `Share “${doc.title}”` : 'People with access'}</h3>
        {isOwner && (
          <form className="share-form" onSubmit={add}>
            <input list="user-emails" placeholder="Add people by email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <datalist id="user-emails">
              {candidates.map((u) => <option key={u.id} value={u.email}>{u.name}</option>)}
            </datalist>
            <select value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="viewer">Viewer</option>
              <option value="editor">Editor</option>
            </select>
            <button className="btn primary" disabled={busy}>Share</button>
          </form>
        )}
        {error && <div className="error">{error}</div>}
        <ul className="people">
          <li><span className="avatar">{(doc.owner_name || user.name)[0]}</span><span>{doc.owner_name || user.name}{isOwner && ' (you)'}</span><span className="muted">Owner</span></li>
          {shares.map((s) => (
            <li key={s.user_id}>
              <span className="avatar">{s.name[0]}</span>
              <span>{s.name}{s.user_id === user.id && ' (you)'}<br /><span className="muted small">{s.email}</span></span>
              {isOwner ? (
                <span className="row">
                  <select value={s.role} disabled={busy}
                    onChange={(e) => run(() => api(`/documents/${doc.id}/shares`, { method: 'POST', body: { email: s.email, role: e.target.value } }))}>
                    <option value="viewer">Viewer</option>
                    <option value="editor">Editor</option>
                  </select>
                  <button className="btn ghost small" disabled={busy} title="Remove access"
                    onClick={() => run(() => api(`/documents/${doc.id}/shares/${s.user_id}`, { method: 'DELETE' }))}>✕</button>
                </span>
              ) : <span className="muted">{s.role}</span>}
            </li>
          ))}
        </ul>
        {isOwner && <p className="muted small">Demo users: alice@ajaia.test, bob@ajaia.test, carol@ajaia.test</p>}
        <div className="right"><button className="btn" onClick={onClose}>Done</button></div>
      </div>
    </div>
  );
}
