import express from 'express';
import multer from 'multer';
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import bcrypt from 'bcryptjs';
import mammoth from 'mammoth';
import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';

const MAX_TITLE = 200;
const MAX_CONTENT = 2_000_000; // ~2MB of HTML
const MAX_UPLOAD = 5 * 1024 * 1024;
export const ALLOWED_EXT = ['.txt', '.md', '.docx'];

const SANITIZE = {
  allowedTags: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'h1', 'h2', 'h3', 'ul', 'ol', 'li', 'blockquote', 'code', 'pre', 'hr', 'a'],
  allowedAttributes: { a: ['href', 'target', 'rel'] },
  allowedSchemes: ['http', 'https', 'mailto'],
};
export const clean = (html) => sanitizeHtml(String(html ?? ''), SANITIZE);

const escapeHtml = (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export async function fileToHtml(originalName, buffer) {
  const ext = path.extname(originalName).toLowerCase();
  if (ext === '.txt') {
    const text = buffer.toString('utf8');
    return text.split(/\r?\n\r?\n/).map((p) => `<p>${escapeHtml(p).replace(/\r?\n/g, '<br>')}</p>`).join('');
  }
  if (ext === '.md') return clean(marked.parse(buffer.toString('utf8')));
  if (ext === '.docx') {
    const { value } = await mammoth.convertToHtml({ buffer });
    return clean(value);
  }
  throw httpError(400, `Unsupported file type "${ext || 'none'}". Supported: ${ALLOWED_EXT.join(', ')}`);
}

function httpError(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}

export function createApp(db) {
  const app = express();
  app.use(express.json({ limit: '3mb' }));

  const q = {
    userByEmail: db.prepare('SELECT * FROM users WHERE email = ?'),
    userById: db.prepare('SELECT id, email, name FROM users WHERE id = ?'),
    allUsers: db.prepare('SELECT id, email, name FROM users ORDER BY name'),
    session: db.prepare('SELECT u.id, u.email, u.name FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?'),
    newSession: db.prepare('INSERT INTO sessions (token, user_id) VALUES (?, ?)'),
    delSession: db.prepare('DELETE FROM sessions WHERE token = ?'),
    doc: db.prepare('SELECT * FROM documents WHERE id = ?'),
    share: db.prepare('SELECT role FROM document_shares WHERE document_id = ? AND user_id = ?'),
    owned: db.prepare(`SELECT d.id, d.title, d.updated_at, 'owner' AS role, u.name AS owner_name,
        (SELECT COUNT(*) FROM document_shares s WHERE s.document_id = d.id) AS share_count
      FROM documents d JOIN users u ON u.id = d.owner_id WHERE d.owner_id = ? ORDER BY d.updated_at DESC`),
    shared: db.prepare(`SELECT d.id, d.title, d.updated_at, s.role, u.name AS owner_name, 0 AS share_count
      FROM document_shares s JOIN documents d ON d.id = s.document_id JOIN users u ON u.id = d.owner_id
      WHERE s.user_id = ? ORDER BY d.updated_at DESC`),
    insertDoc: db.prepare('INSERT INTO documents (owner_id, title, content) VALUES (?, ?, ?)'),
    updateDoc: db.prepare("UPDATE documents SET title = ?, content = ?, updated_at = datetime('now') WHERE id = ?"),
    deleteDoc: db.prepare('DELETE FROM documents WHERE id = ?'),
    shares: db.prepare(`SELECT u.id AS user_id, u.name, u.email, s.role FROM document_shares s JOIN users u ON u.id = s.user_id
      WHERE s.document_id = ? ORDER BY u.name`),
    upsertShare: db.prepare(`INSERT INTO document_shares (document_id, user_id, role) VALUES (?, ?, ?)
      ON CONFLICT(document_id, user_id) DO UPDATE SET role = excluded.role`),
    delShare: db.prepare('DELETE FROM document_shares WHERE document_id = ? AND user_id = ?'),
  };

  // ---- auth ----
  const auth = (req, res, next) => {
    const token = (req.get('authorization') || '').replace(/^Bearer\s+/i, '');
    const user = token && q.session.get(token);
    if (!user) return res.status(401).json({ error: 'Not signed in' });
    req.user = user;
    req.token = token;
    next();
  };

  /** Resolve the caller's access to a document: 'owner' | 'editor' | 'viewer' | null */
  const accessFor = (doc, userId) => {
    if (!doc) return null;
    if (doc.owner_id === userId) return 'owner';
    return q.share.get(doc.id, userId)?.role ?? null;
  };

  const loadDoc = (minRole) => (req, res, next) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid document id' });
    const doc = q.doc.get(id);
    const role = accessFor(doc, req.user.id);
    // Return 404 (not 403) when the user has no access, so we don't leak existence.
    if (!role) return res.status(404).json({ error: 'Document not found' });
    const rank = { viewer: 1, editor: 2, owner: 3 };
    if (rank[role] < rank[minRole]) return res.status(403).json({ error: `Requires ${minRole} access` });
    req.doc = doc;
    req.role = role;
    next();
  };

  app.post('/api/login', (req, res) => {
    const { email, password } = req.body || {};
    const user = email && q.userByEmail.get(String(email).trim().toLowerCase());
    if (!user || !bcrypt.compareSync(String(password || ''), user.password_hash)) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    const token = crypto.randomBytes(24).toString('hex');
    q.newSession.run(token, user.id);
    res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
  });

  app.post('/api/logout', auth, (req, res) => {
    q.delSession.run(req.token);
    res.json({ ok: true });
  });

  app.get('/api/me', auth, (req, res) => res.json({ user: req.user }));
  app.get('/api/users', auth, (req, res) => res.json({ users: q.allUsers.all() }));

  // ---- documents ----
  app.get('/api/documents', auth, (req, res) => {
    res.json({ owned: q.owned.all(req.user.id), shared: q.shared.all(req.user.id) });
  });

  const validTitle = (t) => {
    const title = String(t ?? '').trim();
    if (!title) throw httpError(400, 'Title cannot be empty');
    if (title.length > MAX_TITLE) throw httpError(400, `Title must be at most ${MAX_TITLE} characters`);
    return title;
  };

  app.post('/api/documents', auth, (req, res) => {
    const title = req.body?.title === undefined ? 'Untitled document' : validTitle(req.body.title);
    const content = clean(req.body?.content ?? '');
    const { lastInsertRowid } = q.insertDoc.run(req.user.id, title, content);
    res.status(201).json({ document: { ...q.doc.get(lastInsertRowid), role: 'owner' } });
  });

  app.get('/api/documents/:id', auth, loadDoc('viewer'), (req, res) => {
    const owner = q.userById.get(req.doc.owner_id);
    res.json({ document: { ...req.doc, role: req.role, owner_name: owner?.name } });
  });

  app.patch('/api/documents/:id', auth, loadDoc('editor'), (req, res) => {
    const { title, content } = req.body || {};
    if (title === undefined && content === undefined) throw httpError(400, 'Nothing to update');
    const newTitle = title === undefined ? req.doc.title : validTitle(title);
    if (content !== undefined && String(content).length > MAX_CONTENT) throw httpError(413, 'Document is too large');
    const newContent = content === undefined ? req.doc.content : clean(content);
    q.updateDoc.run(newTitle, newContent, req.doc.id);
    res.json({ document: { ...q.doc.get(req.doc.id), role: req.role } });
  });

  app.delete('/api/documents/:id', auth, loadDoc('owner'), (req, res) => {
    q.deleteDoc.run(req.doc.id);
    res.json({ ok: true });
  });

  // ---- sharing (owner only) ----
  app.get('/api/documents/:id/shares', auth, loadDoc('viewer'), (req, res) => {
    res.json({ shares: q.shares.all(req.doc.id) });
  });

  app.post('/api/documents/:id/shares', auth, loadDoc('owner'), (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const role = req.body?.role || 'viewer';
    if (!['viewer', 'editor'].includes(role)) throw httpError(400, 'Role must be viewer or editor');
    const target = email && q.userByEmail.get(email);
    if (!target) throw httpError(404, `No user with email "${email}"`);
    if (target.id === req.user.id) throw httpError(400, 'You already own this document');
    q.upsertShare.run(req.doc.id, target.id, role);
    res.status(201).json({ shares: q.shares.all(req.doc.id) });
  });

  app.delete('/api/documents/:id/shares/:userId', auth, loadDoc('owner'), (req, res) => {
    q.delShare.run(req.doc.id, Number(req.params.userId));
    res.json({ shares: q.shares.all(req.doc.id) });
  });

  // ---- upload: import .txt / .md / .docx as a new document ----
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_UPLOAD } });
  app.post('/api/import', auth, upload.single('file'), async (req, res, next) => {
    try {
      if (!req.file) throw httpError(400, 'No file uploaded (field name "file")');
      const ext = path.extname(req.file.originalname).toLowerCase();
      if (!ALLOWED_EXT.includes(ext)) throw httpError(400, `Unsupported file type "${ext || 'none'}". Supported: ${ALLOWED_EXT.join(', ')}`);
      const html = await fileToHtml(req.file.originalname, req.file.buffer);
      const title = path.basename(req.file.originalname, ext).slice(0, MAX_TITLE) || 'Imported document';
      const { lastInsertRowid } = q.insertDoc.run(req.user.id, title, html);
      res.status(201).json({ document: { ...q.doc.get(lastInsertRowid), role: 'owner' } });
    } catch (e) {
      next(e);
    }
  });

  app.get('/api/health', (req, res) => res.json({ ok: true }));
  app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

  // ---- static frontend ----
  const dist = path.join(process.cwd(), 'dist');
  if (fs.existsSync(dist)) {
    app.use(express.static(dist));
    app.get(/^(?!\/api).*/, (req, res) => res.sendFile(path.join(dist, 'index.html')));
  }

  // ---- errors ----
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'File is larger than 5 MB' });
    if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Request is too large' });
    const status = err.status || 500;
    if (status >= 500) console.error(err);
    res.status(status).json({ error: status >= 500 ? 'Something went wrong' : err.message });
  });

  return app;
}
