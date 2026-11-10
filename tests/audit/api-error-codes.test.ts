import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { unlinkSync } from 'fs';
import app from '../../src/server.js';
import { initDb, closeDb } from '../../src/db/index.js';

const TEST_DB_PATH = '/tmp/test-audit-api-error-codes.db';

beforeEach(async () => {
  try {
    unlinkSync(TEST_DB_PATH);
  } catch (e) {
    // ignore
  }
  await initDb(TEST_DB_PATH);
});

afterEach(() => {
  closeDb();
  try {
    unlinkSync(TEST_DB_PATH);
  } catch (e) {
    // ignore
  }
});

function expectError(res: request.Response, status: number) {
  expect(res.status).toBe(status);
  expect(typeof res.body.error).toBe('string');
}

describe('Audit: JSON API error codes (CLAUDE.md rule 5)', () => {
  it('#1 POST /api/books minimal body (title, author only) -> 201 + book', async () => {
    const res = await request(app).post('/api/books').send({ title: 'T', author: 'A' });
    expect(res.status).toBe(201);
    expect(typeof res.body.id).toBe('number');
    expect(res.body.title).toBe('T');
    expect(res.body.author).toBe('A');
  });

  it('#2 POST /api/books duplicate isbn -> 409', async () => {
    // Seed: 978-0201616224 belongs to book 1 (The Pragmatic Programmer)
    const res = await request(app).post('/api/books').send({
      title: 'T',
      author: 'A',
      isbn: '978-0201616224',
      cover_url: null,
      description: null,
      published_year: null,
    });
    expectError(res, 409);
  });

  it('#3 PATCH /api/books/1 isbn taken by another book -> 409', async () => {
    // Seed: 978-0132350884 belongs to book 2 (Clean Code)
    const res = await request(app).patch('/api/books/1').send({ isbn: '978-0132350884' });
    expectError(res, 409);
  });

  it('#4 PATCH /api/books/1 title null -> 400', async () => {
    const res = await request(app).patch('/api/books/1').send({ title: null });
    expectError(res, 400);
  });

  it('#5 POST /api/users duplicate username -> 409', async () => {
    // Seed: user 'alice' exists (id 1)
    const res = await request(app)
      .post('/api/users')
      .send({ username: 'alice', displayName: 'Dup' });
    expectError(res, 409);
  });

  it('#6 PATCH /api/users/1 username taken by another user -> 409', async () => {
    // Seed: user 'bob' exists (id 2)
    const res = await request(app).patch('/api/users/1').send({ username: 'bob' });
    expectError(res, 409);
  });

  it('#7 POST /api/users username is an object -> 400', async () => {
    const res = await request(app)
      .post('/api/users')
      .send({ username: { a: 1 }, displayName: 'X' });
    expectError(res, 400);
  });

  it('#8 POST /api/reviews non-numeric rating -> 400', async () => {
    // Seed: user 1 has not reviewed book 5
    const res = await request(app)
      .post('/api/reviews')
      .send({ userId: 1, bookId: 5, rating: 'abc' });
    expectError(res, 400);
  });

  it('#9 POST /api/reviews nonexistent user -> 404', async () => {
    const res = await request(app)
      .post('/api/reviews')
      .send({ userId: 999, bookId: 5, rating: 5 });
    expectError(res, 404);
  });

  it('#10 PATCH /api/reviews/1 rating out of range -> 400', async () => {
    // Seed: review 1 exists (alice, book 1)
    const res = await request(app).patch('/api/reviews/1').send({ rating: 10 });
    expectError(res, 400);
  });

  it('#11 POST /api/shelves duplicate name for same user -> 409', async () => {
    // Seed: user 1 has a shelf named 'read'
    const res = await request(app).post('/api/shelves').send({ userId: 1, name: 'read' });
    expectError(res, 409);
  });

  it('#12 POST /api/shelves nonexistent user -> 404', async () => {
    const res = await request(app).post('/api/shelves').send({ userId: 999, name: 'x' });
    expectError(res, 404);
  });

  it('#13 POST /api/shelves/1/books nonexistent book -> 404', async () => {
    const res = await request(app).post('/api/shelves/1/books').send({ bookId: 999 });
    expectError(res, 404);
  });

  it('#14 POST /api/shelves/abc/books non-numeric shelf id -> 400', async () => {
    const res = await request(app).post('/api/shelves/abc/books').send({ bookId: 1 });
    expectError(res, 400);
  });

  it('#15 POST /api/users malformed JSON body -> 400', async () => {
    const res = await request(app)
      .post('/api/users')
      .set('Content-Type', 'application/json')
      .send('{"username":');
    expectError(res, 400);
  });
});
