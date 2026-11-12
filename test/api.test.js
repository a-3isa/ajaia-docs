import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { openDb, SEED_PASSWORD } from '../server/db.js';
import { createApp } from '../server/app.js';

let app;
const login = async (email) => {
  const res = await request(app).post('/api/login').send({ email, password: SEED_PASSWORD });
  expect(res.status).toBe(200);
  return { Authorization: `Bearer ${res.body.token}` };
};

beforeEach(() => {
  app = createApp(openDb(':memory:'));
});

describe('auth', () => {
  it('rejects bad credentials and unauthenticated requests', async () => {
    expect((await request(app).post('/api/login').send({ email: 'alice@ajaia.test', password: 'nope' })).status).toBe(401);
    expect((await request(app).get('/api/documents')).status).toBe(401);
  });
});

describe('documents', () => {
  it('creates, renames, edits and reopens a document with formatting preserved', async () => {
    const alice = await login('alice@ajaia.test');
    const created = await request(app).post('/api/documents').set(alice).send({ title: 'Plan' });
    expect(created.status).toBe(201);
    const id = created.body.document.id;

    const html = '<h2>Goals</h2><p><strong>bold</strong> <em>it</em> <u>u</u></p><ol><li>one</li></ol>';
    const patched = await request(app).patch(`/api/documents/${id}`).set(alice).send({ title: 'Q1 Plan', content: html });
    expect(patched.status).toBe(200);

    const reopened = await request(app).get(`/api/documents/${id}`).set(alice);
    expect(reopened.body.document.title).toBe('Q1 Plan');
    expect(reopened.body.document.content).toBe(html);
  });

  it('validates titles and strips unsafe HTML', async () => {
    const alice = await login('alice@ajaia.test');
    const { body } = await request(app).post('/api/documents').set(alice).send({});
    const id = body.document.id;
    expect((await request(app).patch(`/api/documents/${id}`).set(alice).send({ title: '   ' })).status).toBe(400);
    const res = await request(app).patch(`/api/documents/${id}`).set(alice)
      .send({ content: '<p onclick="x()">hi<script>alert(1)</script><img src=x onerror=alert(1)></p>' });
    expect(res.body.document.content).toBe('<p>hi</p>');
  });
});

describe('sharing / access control', () => {
  it('enforces owner, editor, viewer and no-access rules', async () => {
    const alice = await login('alice@ajaia.test');
    const bob = await login('bob@ajaia.test');
    const carol = await login('carol@ajaia.test');
    const id = (await request(app).post('/api/documents').set(alice).send({ title: 'Secret' })).body.document.id;

    // Before sharing: Bob can't see it (404, not 403, to avoid leaking existence)
    expect((await request(app).get(`/api/documents/${id}`).set(bob)).status).toBe(404);

    // Alice shares as viewer with Bob, editor with Carol
    expect((await request(app).post(`/api/documents/${id}/shares`).set(alice).send({ email: 'bob@ajaia.test', role: 'viewer' })).status).toBe(201);
    await request(app).post(`/api/documents/${id}/shares`).set(alice).send({ email: 'carol@ajaia.test', role: 'editor' });

    // Bob sees it under "shared", can read, cannot edit or reshare
    const bobList = await request(app).get('/api/documents').set(bob);
    expect(bobList.body.shared.map((d) => d.id)).toContain(id);
    expect(bobList.body.owned.map((d) => d.id)).not.toContain(id);
    expect((await request(app).get(`/api/documents/${id}`).set(bob)).body.document.role).toBe('viewer');
    expect((await request(app).patch(`/api/documents/${id}`).set(bob).send({ content: '<p>hack</p>' })).status).toBe(403);
    expect((await request(app).post(`/api/documents/${id}/shares`).set(bob).send({ email: 'carol@ajaia.test' })).status).toBe(403);

    // Carol (editor) can edit but not delete
    expect((await request(app).patch(`/api/documents/${id}`).set(carol).send({ content: '<p>edit</p>' })).status).toBe(200);
    expect((await request(app).delete(`/api/documents/${id}`).set(carol)).status).toBe(403);

    // Revoking access removes it
    const bobId = bobList.body.shared.length && (await request(app).get(`/api/documents/${id}/shares`).set(alice)).body.shares.find((s) => s.email === 'bob@ajaia.test').user_id;
    await request(app).delete(`/api/documents/${id}/shares/${bobId}`).set(alice);
    expect((await request(app).get(`/api/documents/${id}`).set(bob)).status).toBe(404);
  });

  it('rejects sharing with unknown users or yourself', async () => {
    const alice = await login('alice@ajaia.test');
    const id = (await request(app).post('/api/documents').set(alice).send({ title: 'X' })).body.document.id;
    expect((await request(app).post(`/api/documents/${id}/shares`).set(alice).send({ email: 'ghost@x.com' })).status).toBe(404);
    expect((await request(app).post(`/api/documents/${id}/shares`).set(alice).send({ email: 'alice@ajaia.test' })).status).toBe(400);
  });
});

describe('file import', () => {
  it('turns a markdown file into an editable document', async () => {
    const alice = await login('alice@ajaia.test');
    const res = await request(app).post('/api/import').set(alice)
      .attach('file', Buffer.from('# Notes\n\n- **one**\n- two'), 'meeting-notes.md');
    expect(res.status).toBe(201);
    expect(res.body.document.title).toBe('meeting-notes');
    expect(res.body.document.content).toContain('<h1>Notes</h1>');
    expect(res.body.document.content).toContain('<strong>one</strong>');
  });

  it('rejects unsupported file types', async () => {
    const alice = await login('alice@ajaia.test');
    const res = await request(app).post('/api/import').set(alice).attach('file', Buffer.from('x'), 'image.png');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Unsupported/);
  });
});
