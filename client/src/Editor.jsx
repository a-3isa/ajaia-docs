import { useCallback, useEffect, useRef, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TurndownService from 'turndown';
import { api, beforeLogout } from './api.js';
import ShareDialog from './ShareDialog.jsx';

const SAVE_DELAY = 800;

function Toolbar({ editor, disabled }) {
  if (!editor) return null;
  const B = ({ label, title, active, onClick }) => (
    <button type="button" title={title} className={`tb ${active ? 'on' : ''}`} disabled={disabled}
      onMouseDown={(e) => e.preventDefault()} onClick={onClick}>{label}</button>
  );
  const c = () => editor.chain().focus();
  const headingValue = [1, 2, 3].find((l) => editor.isActive('heading', { level: l })) || 0;
  return (
    <div className="toolbar">
      <select value={headingValue} disabled={disabled} title="Text style"
        onChange={(e) => {
          const l = Number(e.target.value);
          l ? c().setHeading({ level: l }).run() : c().setParagraph().run();
        }}>
        <option value={0}>Normal text</option>
        <option value={1}>Heading 1</option>
        <option value={2}>Heading 2</option>
        <option value={3}>Heading 3</option>
      </select>
      <span className="sep" />
      <B label={<b>B</b>} title="Bold (Ctrl+B)" active={editor.isActive('bold')} onClick={() => c().toggleBold().run()} />
      <B label={<i>I</i>} title="Italic (Ctrl+I)" active={editor.isActive('italic')} onClick={() => c().toggleItalic().run()} />
      <B label={<u>U</u>} title="Underline (Ctrl+U)" active={editor.isActive('underline')} onClick={() => c().toggleUnderline().run()} />
      <B label={<s>S</s>} title="Strikethrough" active={editor.isActive('strike')} onClick={() => c().toggleStrike().run()} />
      <span className="sep" />
      <B label="• List" title="Bulleted list" active={editor.isActive('bulletList')} onClick={() => c().toggleBulletList().run()} />
      <B label="1. List" title="Numbered list" active={editor.isActive('orderedList')} onClick={() => c().toggleOrderedList().run()} />
      <B label="❝" title="Quote" active={editor.isActive('blockquote')} onClick={() => c().toggleBlockquote().run()} />
      <span className="sep" />
      <B label="↶" title="Undo (Ctrl+Z)" onClick={() => c().undo().run()} />
      <B label="↷" title="Redo (Ctrl+Shift+Z)" onClick={() => c().redo().run()} />
    </div>
  );
}

function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  a.click();
  URL.revokeObjectURL(url);
}

export default function Editor({ id, user }) {
  const [doc, setDoc] = useState(null);
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState('saved'); // saved | dirty | saving | error
  const [error, setError] = useState('');
  const [showShare, setShowShare] = useState(false);
  const pending = useRef({});
  const timer = useRef();

  const canEdit = doc && doc.role !== 'viewer';

  const flush = useCallback(async () => {
    clearTimeout(timer.current);
    const body = pending.current;
    if (!Object.keys(body).length) return;
    pending.current = {};
    setStatus('saving');
    try {
      await api(`/documents/${id}`, { method: 'PATCH', body });
      setStatus(Object.keys(pending.current).length ? 'dirty' : 'saved');
      setError('');
    } catch (e) {
      pending.current = { ...body, ...pending.current }; // keep unsaved changes for retry
      setStatus('error');
      setError(e.message);
    }
  }, [id]);

  const queue = useCallback((patch) => {
    pending.current = { ...pending.current, ...patch };
    setStatus('dirty');
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, SAVE_DELAY);
  }, [flush]);

  const editor = useEditor({
    extensions: [StarterKit.configure({ link: false })],
    content: '',
    editable: false,
    shouldRerenderOnTransaction: true,
    onUpdate: ({ editor }) => editor.isEditable && queue({ content: editor.getHTML() }),
  });

  useEffect(() => {
    let alive = true;
    api(`/documents/${id}`)
      .then(({ document }) => {
        if (!alive) return;
        setDoc(document);
        setTitle(document.title);
        editor?.commands.setContent(document.content || '', { emitUpdate: false });
        // TipTap v3 emits an update on setEditable by default; suppress it so loading
        // a document never triggers a save (that caused 403s for viewers).
        editor?.setEditable(document.role !== 'viewer', false);
      })
      .catch((e) => alive && setError(e.status === 404 ? 'This document does not exist or you do not have access to it.' : e.message));
    return () => { alive = false; };
  }, [id, editor]);

  // Save on leave / tab close
  useEffect(() => {
    const warn = (e) => {
      if (Object.keys(pending.current).length) { flush(); e.preventDefault(); e.returnValue = ''; }
    };
    window.addEventListener('beforeunload', warn);
    beforeLogout.add(flush);
    return () => { window.removeEventListener('beforeunload', warn); beforeLogout.delete(flush); flush(); };
  }, [flush]);

  const onTitle = (v) => {
    setTitle(v);
    if (v.trim()) queue({ title: v.trim() });
  };

  const exportMd = () => {
    const md = new TurndownService({ headingStyle: 'atx', bulletListMarker: '-' }).turndown(editor.getHTML());
    download(`${title || 'document'}.md`, md, 'text/markdown');
  };

  if (error && !doc) {
    return <main className="container"><div className="error">{error}</div><a href="#/">← Back to documents</a></main>;
  }

  const statusText = { saved: 'All changes saved', dirty: 'Unsaved changes…', saving: 'Saving…', error: 'Save failed' }[status];

  return (
    <main className="editor-page">
      <div className="doc-header">
        <a href="#/" className="btn ghost" title="Back to documents">←</a>
        <div className="title-block">
          <input className="title-input" value={title} disabled={!canEdit} maxLength={200}
            placeholder="Untitled document" aria-label="Document title"
            onChange={(e) => onTitle(e.target.value)} onBlur={() => !title.trim() && doc && setTitle(doc.title)} />
          <div className="small muted">
            {doc && (doc.role === 'owner' ? 'Owned by you' : `Owned by ${doc.owner_name} · you can ${doc.role === 'editor' ? 'edit' : 'view'}`)}
            {canEdit && <> · <span className={`status ${status}`}>{statusText}</span></>}
            {status === 'error' && <button className="link" onClick={flush}>Retry</button>}
          </div>
        </div>
        <div className="doc-actions">
          <button className="btn" onClick={exportMd} disabled={!doc}>Export .md</button>
          {doc && <button className="btn primary" onClick={() => setShowShare(true)}>{doc.role === 'owner' ? 'Share' : 'People'}</button>}
        </div>
      </div>
      {error && doc && <div className="error">{error}</div>}
      {doc?.role === 'viewer' && <div className="notice">You have view-only access to this document.</div>}
      <Toolbar editor={editor} disabled={!canEdit} />
      <div className="page">
        {!doc ? <p className="muted">Loading…</p> : <EditorContent editor={editor} />}
      </div>
      {showShare && <ShareDialog doc={doc} user={user} onClose={() => setShowShare(false)} />}
    </main>
  );
}
