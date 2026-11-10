import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { unlinkSync } from 'fs';
import app from '../../src/server.js';
import { initDb, closeDb, get } from '../../src/db/index.js';

const DB = '/tmp/test-audit-api-error-codes.db';

beforeEach(async () => {
  await initDb(DB);
});

afterEach(() => {
  closeDb();
  try {
    unlinkSync(DB);
  } catch (e) {
    // ignore
  }
});

const isbnOf = (id: number) => get<{ isbn: string }>('SELECT isbn FROM books WHERE id = ?', [id])!.isbn;
const usernameOf = (id: number) => get<{ username: string }>('SELECT username FROM users WHERE id = ?', [id])!.username;

function expectError(res: request.Response, codes: number[]) {
  expect(codes).toContain(res.status);
  expect(typeof res.body.error).toBe('string');
}

describe('API error codes (never 500)', () => {
  it('#1 returns 409 on duplicate isbn when creating a book', async () => {
    const res = await request(app).post('/api/books').send({ title: 'X', author: 'Y', isbn: isbnOf(1) });
    expectError(res, [409]);
  });

  it('#2 minimal valid book body returns 201 or 400, never 500', async () => {
    const res = await request(app).post('/api/books').send({ title: 'X', author: 'Y' });
    expect([201, 400]).toContain(res.status);
  });

  it('#3 PATCH book returns 409 on duplicate isbn and 400 on object title', async () => {
    const dup = await request(app).patch('/api/books/1').send({ isbn: isbnOf(2) });
    expectError(dup, [409]);
    const bad = await request(app).patch('/api/books/1').send({ title: { a: 1 } });
    expectError(bad, [400]);
  });

  it('#4 returns 409 on duplicate username when creating a user', async () => {
    const res = await request(app).post('/api/users').send({ username: usernameOf(1), displayName: 'Z' });
    expectError(res, [409]);
  });

  it('#5 returns 409 when PATCHing a username to an existing one', async () => {
    const res = await request(app).patch('/api/users/1').send({ username: usernameOf(2) });
    expectError(res, [409]);
  });

  it('#6 returns 404 or 400 for nonexistent userId or bookId on review create', async () => {
    const a = await request(app).post('/api/reviews').send({ userId: 1, bookId: 9999, rating: 4 });
    expectError(a, [404, 400]);
    const b = await request(app).post('/api/reviews').send({ userId: 9999, bookId: 1, rating: 4 });
    expectError(b, [404, 400]);
  });

  it('#7 returns 400 on non-numeric rating', async () => {
    const free = get<{ id: number }>(
      'SELECT id FROM books WHERE id NOT IN (SELECT book_id FROM reviews WHERE user_id = 1) LIMIT 1'
    )!;
    const res = await request(app).post('/api/reviews').send({ userId: 1, bookId: free.id, rating: 'abc' });
    expectError(res, [400]);
  });

  it('#8 returns 400 on out-of-range rating in PATCH review', async () => {
    const res = await request(app).patch('/api/reviews/1').send({ rating: 9 });
    expectError(res, [400]);
  });

  it('#9 returns 404 or 400 for nonexistent userId on shelf create', async () => {
    const res = await request(app).post('/api/shelves').send({ userId: 9999, name: 'A' });
    expectError(res, [404, 400]);
  });

  it('#10 returns 409 on duplicate shelf name for same user', async () => {
    const shelf = get<{ name: string }>('SELECT name FROM shelves WHERE user_id = 1 LIMIT 1')!;
    const res = await request(app).post('/api/shelves').send({ userId: 1, name: shelf.name });
    expectError(res, [409]);
  });

  it('#11 returns 404 for nonexistent shelf or book when adding to shelf', async () => {
    const a = await request(app).post('/api/shelves/9999/books').send({ bookId: 1 });
    expectError(a, [404]);
    const b = await request(app).post('/api/shelves/1/books').send({ bookId: 9999 });
    expectError(b, [404]);
  });

  it('#12 returns 400 on malformed JSON body', async () => {
    const res = await request(app).post('/api/books').set('Content-Type', 'application/json').send('{bad');
    expectError(res, [400]);
  });
});
