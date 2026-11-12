import { useEffect, useRef, useState } from 'react';
import { api } from './api.js';

const fmt = (s) => new Date(s.replace(' ', 'T') + 'Z').toLocaleString();

function Section({ title, docs, empty, shared }) {
  return (
    <section>
      <h2>{title} <span className="count">{docs.length}</span></h2>
      {docs.length === 0 ? (
        <p className="muted empty">{empty}</p>
      ) : (
        <ul className="doclist">
          {docs.map((d) => (
            <li key={d.id}>
              <a href={`#/doc/${d.id}`}>
                <span className="doc-icon">▤</span>
                <span className="doc-title">{d.title}</span>
                {shared ? (
                  <span className={`badge ${d.role}`}>{d.role} · from {d.owner_name}</span>
                ) : (
                  d.share_count > 0 && <span className="badge owner">shared with {d.share_count}</span>
                )}
                <span className="muted small">{fmt(d.updated_at)}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function DocList() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef();

  useEffect(() => {
    api('/documents').then(setData).catch((e) => setError(e.message));
  }, []);

  const create = async () => {
    setBusy(true);
    try {
      const { document } = await api('/documents', { method: 'POST', body: { title: 'Untitled document' } });
      location.hash = `#/doc/${document.id}`;
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    setError('');
    const form = new FormData();
    form.append('file', file);
    try {
      const { document } = await api('/import', { method: 'POST', form });
      location.hash = `#/doc/${document.id}`;
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <main className="container">
      <div className="list-actions">
        <button className="btn primary" onClick={create} disabled={busy}>+ New document</button>
        <button className="btn" onClick={() => fileRef.current.click()} disabled={busy}>⇪ Import file</button>
        <input ref={fileRef} type="file" accept=".txt,.md,.docx" hidden onChange={onFile} />
        <span className="muted small">Import supports .txt, .md and .docx (max 5 MB) and creates a new editable document.</span>
      </div>
      {error && <div className="error">{error}</div>}
      {!data ? (
        !error && <p className="muted">Loading documents…</p>
      ) : (
        <>
          <Section title="My documents" docs={data.owned} empty="You don't own any documents yet. Create one or import a file." />
          <Section title="Shared with me" docs={data.shared} empty="Nothing has been shared with you yet." shared />
        </>
      )}
    </main>
  );
}
