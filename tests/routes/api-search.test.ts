import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import request from 'supertest';
import app from '../../src/server.js';
import { initDb, closeDb } from '../../src/db/index.js';
import * as Book from '../../src/models/book.js';

const DB = '/tmp/test-api-search.db';

function add(title: string, author: string) {
  Book.createBook({
    title,
    author,
    isbn: null,
    cover_url: null,
    description: null,
    published_year: null,
  });
}

beforeEach(async () => {
  await initDb(DB);
  add('Zqx Alpha', 'Ann Writer');
  add('Plain Title', 'Bob Zqx Beta');
  add('LOUD ZQX Gamma', 'Cy Writer');
  add('100% Pure', 'Percy');
  add('1000 Things', 'Percy');
  add('Snake_case Guide', 'Sam');
  add('SnakeXcase Guide', 'Sam');
  add("O'Brien Tales", 'Pat');
});

afterEach(() => {
  closeDb();
  try {
    fs.unlinkSync(DB);
  } catch {
    // ignore
  }
});

const titles = (body: Array<{ title: string }>) => body.map((b) => b.title);

describe.each(['/api/books/search', '/api/books'])('JSON search: GET %s?q=', (base) => {
  const get = (qs: string) => request(app).get(`${base}${qs}`);
  const q = (text: string) => get(`?q=${encodeURIComponent(text)}`);

  it(`rule 1: leading and trailing spaces are trimmed (${base})`, async () => {
    const res = await q('   Zqx Alpha   ');
    expect(res.status).toBe(200);
    expect(titles(res.body)).toEqual(['Zqx Alpha']);
  });

  it(`rule 2: empty q returns all books ordered by title (${base})`, async () => {
    const res = await get('?q=');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(58);
    expect(titles(res.body)).toEqual(titles(Book.getAllBooks()));
  });

  it(`rule 2: whitespace-only q returns all books (${base})`, async () => {
    const res = await q('   ');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(58);
  });

  it(`rule 2: missing q returns all books (${base})`, async () => {
    const res = await get('');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(58);
    expect(titles(res.body)).toEqual(titles(Book.getAllBooks()));
  });

  it(`rule 3: 100 characters is valid (${base})`, async () => {
    const long = 'k'.repeat(100);
    add(long + 'tail', 'Long Author');
    const res = await q(long);
    expect(res.status).toBe(200);
    expect(titles(res.body)).toEqual([long + 'tail']);
  });

  it(`rule 3: 101 characters is a validation error (${base})`, async () => {
    const res = await q('k'.repeat(101));
    expect(res.status).toBe(400);
    expect(typeof res.body.error).toBe('string');
    expect(res.body.error.length).toBeGreaterThan(0);
  });

  it(`rule 3: 100 characters plus spaces is valid (${base})`, async () => {
    const res = await q(' ' + 'k'.repeat(100) + ' ');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it(`rule 4: matches title or author, ignoring case, ordered by title (${base})`, async () => {
    const res = await q('zqx');
    expect(res.status).toBe(200);
    expect(titles(res.body)).toEqual(['LOUD ZQX Gamma', 'Plain Title', 'Zqx Alpha']);
  });

  it(`rule 4: results have the same shape as GET /api/books (${base})`, async () => {
    const res = await q('Alpha');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(Object.keys(res.body[0]).sort()).toEqual(
      Object.keys(Book.getAllBooks()[0]).sort()
    );
  });

  it(`rule 4: apostrophe matches literally (${base})`, async () => {
    const res = await q("O'Brien");
    expect(res.status).toBe(200);
    expect(titles(res.body)).toEqual(["O'Brien Tales"]);
  });

  it(`rule 5: % is literal (${base})`, async () => {
    const res = await q('100%');
    expect(res.status).toBe(200);
    expect(titles(res.body)).toEqual(['100% Pure']);
  });

  it(`rule 5: _ is literal (${base})`, async () => {
    const res = await q('Snake_case');
    expect(res.status).toBe(200);
    expect(titles(res.body)).toEqual(['Snake_case Guide']);
  });

  it(`rule 6: SQL injection text matches nothing and breaks nothing (${base})`, async () => {
    const res = await q("' OR '1'='1");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
    const drop = await q("'; DROP TABLE books; --");
    expect(drop.status).toBe(200);
    expect(drop.body).toEqual([]);
    expect(Book.getAllBooks()).toHaveLength(58);
  });

  it(`rule 7: no match is 200 with an empty array (${base})`, async () => {
    const res = await q('nothing-matches-this-xyz');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it(`rule 8: repeated q is a validation error (${base})`, async () => {
    const res = await get('?q=a&q=b');
    expect(res.status).toBe(400);
    expect(typeof res.body.error).toBe('string');
  });

  it(`rule 8: q as an object is a validation error (${base})`, async () => {
    const res = await get('?q[x]=1');
    expect(res.status).toBe(400);
    expect(typeof res.body.error).toBe('string');
  });
});

describe('JSON route ordering', () => {
  it('GET /api/books/search is not read as an id (no 404 "Book not found")', async () => {
    const res = await request(app).get('/api/books/search?q=Alpha');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('GET /api/books/:id still works', async () => {
    const res = await request(app).get('/api/books/1');
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(1);
  });
});
