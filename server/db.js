import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import fs from 'node:fs';
import path from 'node:path';

export const SEED_USERS = [
  { name: 'Alice Owner', email: 'alice@ajaia.test' },
  { name: 'Bob Reviewer', email: 'bob@ajaia.test' },
  { name: 'Carol Editor', email: 'carol@ajaia.test' },
];
export const SEED_PASSWORD = 'demo1234';

export function openDb(file = process.env.DB_FILE || path.join(process.cwd(), 'data', 'app.db')) {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS document_shares (
      document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK (role IN ('viewer','editor')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (document_id, user_id)
    );
  `);

  const insert = db.prepare('INSERT OR IGNORE INTO users (email, name, password_hash) VALUES (?, ?, ?)');
  const hash = bcrypt.hashSync(SEED_PASSWORD, 8);
  for (const u of SEED_USERS) insert.run(u.email, u.name, hash);

  // Seed one welcome doc for Alice, shared with Bob, so the sharing flow is visible immediately.
  const alice = db.prepare('SELECT id FROM users WHERE email = ?').get('alice@ajaia.test');
  const bob = db.prepare('SELECT id FROM users WHERE email = ?').get('bob@ajaia.test');
  const hasDocs = db.prepare('SELECT COUNT(*) AS n FROM documents').get().n > 0;
  if (!hasDocs) {
    const info = db.prepare('INSERT INTO documents (owner_id, title, content) VALUES (?, ?, ?)').run(
      alice.id,
      'Welcome to Ajaia Docs',
      '<h1>Welcome 👋</h1><p>This document is owned by <strong>Alice</strong> and shared with <em>Bob</em> as a <u>viewer</u>.</p><ul><li>Try bold, italic, underline</li><li>Headings and lists</li></ul><p>Edits autosave.</p>'
    );
    db.prepare("INSERT INTO document_shares (document_id, user_id, role) VALUES (?, ?, 'viewer')").run(info.lastInsertRowid, bob.id);
  }
  return db;
}
