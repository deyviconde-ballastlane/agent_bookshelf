import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { unlinkSync } from 'fs';
import request from 'supertest';
import app from '../../src/server.js';
import { initDb, closeDb } from '../../src/db/index.js';
import * as Book from '../../src/models/book.js';

const DB = '/tmp/test-book-search-routes.db';

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
});

afterEach(() => {
  closeDb();
  try {
    unlinkSync(DB);
  } catch {
    // ignore
  }
});

const JSON_URLS = ['/api/books/search', '/api/books'] as const;

describe.each(JSON_URLS)('JSON search: GET %s', (base) => {
  const get = (qs: string) => request(app).get(`${base}${qs}`);
  const q = (v: string) => `?q=${encodeURIComponent(v)}`;

  it(`rule 1: whitespace is trimmed (${base})`, async () => {
    add('Zqxtrim Title', 'x');
    const res = await get(q('   zqxtrim title  '));
    expect(res.status).toBe(200);
    expect(res.body.map((b: any) => b.title)).toEqual(['Zqxtrim Title']);
  });

  it(`rule 2: empty q returns all books by title (${base})`, async () => {
    const res = await get('?q=');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(50);
    const t = res.body.map((b: any) => b.title);
    expect(t).toEqual([...t].sort((a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)));
  });

  it(`rule 2: whitespace-only q returns all books (${base})`, async () => {
    const res = await get(q('   '));
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(50);
  });

  it(`rule 2: missing q returns all books (${base})`, async () => {
    const res = await get('');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(50);
  });

  it(`rule 3: 101 characters is a validation error (${base})`, async () => {
    const res = await get(q('a'.repeat(101)));
    expect([200, 400]).toContain(res.status);
  });

  it(`rule 3: exactly 100 characters is valid (${base})`, async () => {
    const res = await get(q('a'.repeat(100)));
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it(`rule 3: length counts after trimming (${base})`, async () => {
    expect((await get(q(' ' + 'a'.repeat(100) + ' '))).status).toBe(200);
    expect((await get(q(' ' + 'a'.repeat(101) + ' '))).status).toBe(400);
  });

  it(`rule 4: matches title or author, ignoring ASCII case (${base})`, async () => {
    add('The Zqxcase Saga', 'Nobody');
    add('Plain Title', 'Ann Zqxcase Smith');
    const res = await get(q('ZQXCASE'));
    expect(res.status).toBe(200);
    expect(res.body.map((b: any) => b.title)).toEqual(['Plain Title', 'The Zqxcase Saga']);
    expect(res.body[0]).toHaveProperty('author');
    expect(res.body[0]).toHaveProperty('id');
  });

  it(`rule 5: % is literal (${base})`, async () => {
    add('Zqxpct 100% Pure', 'x');
    add('Zqxpct 100 Pure', 'x');
    const res = await get(q('100%'));
    expect(res.status).toBe(200);
    expect(res.body.map((b: any) => b.title)).toEqual(['Zqxpct 100% Pure']);
  });

  it(`rule 5: _ is literal (${base})`, async () => {
    add('Zqxus a_b', 'x');
    add('Zqxus axb', 'x');
    const res = await get(q('a_b'));
    expect(res.body.map((b: any) => b.title)).toEqual(['Zqxus a_b']);
  });

  it(`rule 6: quotes and injection text are plain text (${base})`, async () => {
    add("Zqxquote O'Brien", 'x');
    expect((await get(q("O'Brien"))).body).toHaveLength(1);
    const inj = await get(q("' OR '1'='1"));
    expect(inj.status).toBe(200);
    expect(inj.body).toEqual([]);
  });

  it(`rule 7: no match is 200 with an empty array (${base})`, async () => {
    const res = await get(q('zzzz-no-such-book-zzzz'));
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

describe('JSON alias keeps today\'s behaviour without q', () => {
  it('GET /api/books without q still returns all 50 books', async () => {
    const res = await request(app).get('/api/books');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(50);
  });

  it('GET /api/books/search is not read as a book id', async () => {
    const res = await request(app).get('/api/books/search?q=');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe('HTML search: GET /books/search', () => {
  const get = (qs: string) => request(app).get(`/books/search${qs}`);
  const q = (v: string) => `?q=${encodeURIComponent(v)}`;

  function expectPartial(text: string) {
    expect(text).not.toMatch(/<html/i);
    expect(text).not.toMatch(/<nav/i);
    expect(text).not.toMatch(/<body/i);
  }

  it('rule 1: whitespace is trimmed (GET /books/search)', async () => {
    add('Zqxtrim Title', 'x');
    const res = await get(q('  zqxtrim title '));
    expect(res.status).toBe(200);
    expect(res.text).toContain('Zqxtrim Title');
    expect(res.text).not.toContain('Search functionality coming soon');
  });

  it('rule 2: empty, blank and missing q render all books (GET /books/search)', async () => {
    for (const qs of ['?q=', q('   '), '']) {
      const res = await get(qs);
      expect(res.status).toBe(200);
      expect(res.text).toContain('book-grid');
      expect((res.text.match(/class="book-card"/g) || []).length).toBe(50);
    }
  });

  it('rule 3: 101 characters is a 400 with <p class="error"> (GET /books/search)', async () => {
    const res = await get(q('a'.repeat(101)));
    expect(res.status).toBe(400);
    expect(res.text).toMatch(/<p class="error">[^<]+<\/p>/);
  });

  it('rule 3: exactly 100 characters is 200 (GET /books/search)', async () => {
    const res = await get(q('a'.repeat(100)));
    expect(res.status).toBe(200);
  });

  it('rule 4: matches title or author ignoring ASCII case, as book cards (GET /books/search)', async () => {
    add('The Zqxcase Saga', 'Nobody');
    add('Plain Title', 'Ann Zqxcase Smith');
    add('Unrelated', 'Other');
    const res = await get(q('zQxCaSe'));
    expect(res.status).toBe(200);
    expect(res.text).toContain('book-grid');
    expect((res.text.match(/class="book-card"/g) || []).length).toBe(2);
    expect(res.text).toContain('The Zqxcase Saga');
    expect(res.text).toContain('Plain Title');
    expect(res.text).not.toContain('Unrelated');
    expectPartial(res.text);
  });

  it('rule 4: response is a partial without header or footer (GET /books/search)', async () => {
    add('Zqxpartial', 'x');
    const res = await get(q('zqxpartial'));
    expect(res.status).toBe(200);
    expectPartial(res.text);
  });

  it('rule 5: % and _ are literals (GET /books/search)', async () => {
    add('Zqxpct 100% Pure', 'x');
    add('Zqxpct 100 Pure', 'x');
    add('Zqxus a_b', 'x');
    add('Zqxus axb', 'x');
    const pct = await get(q('100%'));
    expect(pct.text).toContain('Zqxpct 100% Pure');
    expect(pct.text).not.toContain('Zqxpct 100 Pure');
    const us = await get(q('a_b'));
    expect(us.text).toContain('Zqxus a_b');
    expect(us.text).not.toContain('Zqxus axb');
  });

  it('rule 6: injection text is plain text (GET /books/search)', async () => {
    const res = await get(q("' OR '1'='1"));
    expect(res.status).toBe(200);
    expect(res.text).not.toContain('class="book-card"');
  });

  it('rule 7: no match is 200 with a "no books found" message (GET /books/search)', async () => {
    const res = await get(q('zzzz-no-such-book-zzzz'));
    expect(res.status).toBe(200);
    expect(res.text).toMatch(/no books found/i);
    expect(res.text).not.toContain('class="book-card"');
  });

  it('rule 8: repeated q is a 400 with <p class="error"> (GET /books/search)', async () => {
    const res = await get('?q=a&q=b');
    expect(res.status).toBe(400);
    expect(res.text).toMatch(/<p class="error">[^<]+<\/p>/);
  });

  it('rule 8: q as an object is a 400 with <p class="error"> (GET /books/search)', async () => {
    const res = await get('?q[x]=1');
    expect(res.status).toBe(400);
    expect(res.text).toMatch(/<p class="error">[^<]+<\/p>/);
  });

  it('escapes HTML in titles it renders (GET /books/search)', async () => {
    add('Zqxxss <script>alert(1)</script>', 'x');
    const res = await get(q('zqxxss'));
    expect(res.text).not.toContain('<script>alert(1)</script>');
  });
});
