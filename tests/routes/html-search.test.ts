import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import request from 'supertest';
import app from '../../src/server.js';
import { initDb, closeDb } from '../../src/db/index.js';
import * as Book from '../../src/models/book.js';

const DB = '/tmp/test-html-search.db';

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

const get = (qs: string) => request(app).get(`/books/search${qs}`);
const q = (text: string) => get(`?q=${encodeURIComponent(text)}`);
const cards = (html: string) => (html.match(/class="book-card"/g) ?? []).length;

describe('GET /books/search (HTML partial)', () => {
  it('rule 1: leading and trailing spaces are trimmed', async () => {
    const res = await q('   Zqx Alpha   ');
    expect(res.status).toBe(200);
    expect(cards(res.text)).toBe(1);
    expect(res.text).toContain('Zqx Alpha');
  });

  it('rule 2: empty q returns every book card', async () => {
    const res = await get('?q=');
    expect(res.status).toBe(200);
    expect(res.text).toContain('book-grid');
    expect(cards(res.text)).toBe(58);
  });

  it('rule 2: whitespace-only q returns every book card', async () => {
    const res = await q('   ');
    expect(res.status).toBe(200);
    expect(cards(res.text)).toBe(58);
  });

  it('rule 2: missing q returns every book card', async () => {
    const res = await get('');
    expect(res.status).toBe(200);
    expect(cards(res.text)).toBe(58);
  });

  it('rule 3: 100 characters is valid', async () => {
    const long = 'k'.repeat(100);
    add(long + 'tail', 'Long Author');
    const res = await q(long);
    expect(res.status).toBe(200);
    expect(cards(res.text)).toBe(1);
  });

  it('rule 3: 101 characters is a validation error', async () => {
    const res = await q('k'.repeat(101));
    expect(res.status).toBe(400);
    expect(res.text).toMatch(/<p class="error">[^<]+<\/p>/);
  });

  it('rule 4: matches title or author, ignoring case, ordered by title', async () => {
    const res = await q('zqx');
    expect(res.status).toBe(200);
    expect(cards(res.text)).toBe(3);
    const a = res.text.indexOf('LOUD ZQX Gamma');
    const b = res.text.indexOf('Plain Title');
    const c = res.text.indexOf('Zqx Alpha');
    expect(a).toBeGreaterThan(-1);
    expect(b).toBeGreaterThan(a);
    expect(c).toBeGreaterThan(b);
  });

  it('rule 4: cards use the same markup as the books page', async () => {
    const res = await q('Alpha');
    expect(res.text).toContain('class="book-grid"');
    expect(res.text).toContain('class="author"');
    expect(res.text).toMatch(/href="\/books\/\d+"/);
  });

  it('rule 4: response is a partial, with no header or footer', async () => {
    const res = await q('Alpha');
    expect(res.status).toBe(200);
    expect(res.text).not.toMatch(/<html/i);
    expect(res.text).not.toMatch(/<!DOCTYPE/i);
    expect(res.text).not.toMatch(/<nav/i);
    expect(res.text).not.toMatch(/<\/body>/i);
  });

  it('rule 4: apostrophe is matched literally', async () => {
    const res = await q("O'Brien");
    expect(res.status).toBe(200);
    expect(cards(res.text)).toBe(1);
  });

  it('rule 5: % is literal', async () => {
    const res = await q('100%');
    expect(res.status).toBe(200);
    expect(cards(res.text)).toBe(1);
    expect(res.text).toContain('100% Pure');
  });

  it('rule 5: _ is literal', async () => {
    const res = await q('Snake_case');
    expect(res.status).toBe(200);
    expect(cards(res.text)).toBe(1);
    expect(res.text).toContain('Snake_case Guide');
    expect(res.text).not.toContain('SnakeXcase');
  });

  it('rule 6: SQL injection text matches nothing and breaks nothing', async () => {
    const res = await q("' OR '1'='1");
    expect(res.status).toBe(200);
    expect(cards(res.text)).toBe(0);
    await q("'; DROP TABLE books; --");
    expect(Book.getAllBooks()).toHaveLength(58);
  });

  it('rule 6: markup in the query is not echoed unescaped', async () => {
    const res = await q('<script>alert(1)</script>');
    expect(res.text).not.toContain('<script>alert(1)</script>');
  });

  it('rule 7: no match is 200 with a "no books found" message', async () => {
    const res = await q('nothing-matches-this-xyz');
    expect(res.status).toBe(200);
    expect(cards(res.text)).toBe(0);
    expect(res.text).toMatch(/no books found/i);
  });

  it('rule 8: repeated q is a validation error', async () => {
    const res = await get('?q=a&q=b');
    expect(res.status).toBe(400);
    expect(res.text).toMatch(/<p class="error">[^<]+<\/p>/);
  });

  it('rule 8: q as an object is a validation error', async () => {
    const res = await get('?q[x]=1');
    expect(res.status).toBe(400);
    expect(res.text).toMatch(/<p class="error">[^<]+<\/p>/);
  });
});
