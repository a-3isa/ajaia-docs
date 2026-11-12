import { useEffect, useState, useCallback } from 'react';
import { api, getToken, setToken, beforeLogout } from './api.js';
import Login from './Login.jsx';
import DocList from './DocList.jsx';
import Editor from './Editor.jsx';

// Minimal hash router: #/ (list) and #/doc/:id
const parseRoute = () => {
  const m = location.hash.match(/^#\/doc\/(\d+)/);
  return m ? { name: 'doc', id: Number(m[1]) } : { name: 'list' };
};

export default function App() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(!!getToken());
  const [route, setRoute] = useState(parseRoute());

  useEffect(() => {
    const onHash = () => setRoute(parseRoute());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    if (!getToken()) return;
    api('/me')
      .then((d) => setUser(d.user))
      .catch(() => setToken(null))
      .finally(() => setChecking(false));
  }, []);

  const logout = useCallback(async () => {
    await Promise.all([...beforeLogout].map((fn) => fn())); // save pending edits first
    await api('/logout', { method: 'POST' }).catch(() => {});
    setToken(null);
    setUser(null);
    location.hash = '#/';
  }, []);

  if (checking) return <div className="center muted">Loading…</div>;
  if (!user) return <Login onLogin={(u) => setUser(u)} />;

  return (
    <div className="app">
      <header className="topbar">
        <a href="#/" className="brand">
          <span className="logo">▤</span> Ajaia Docs
        </a>
        <div className="topbar-right">
          <span className="avatar" title={user.email}>{user.name[0]}</span>
          <span className="muted small">{user.name}</span>
          <button className="btn ghost" onClick={logout}>Sign out</button>
        </div>
      </header>
      {route.name === 'doc' ? <Editor key={route.id} id={route.id} user={user} /> : <DocList user={user} />}
    </div>
  );
}
