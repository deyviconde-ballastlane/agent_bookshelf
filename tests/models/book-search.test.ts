import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { unlinkSync } from 'fs';
import { initDb, closeDb } from '../../src/db/index.js';
import * as Book from '../../src/models/book.js';

const DB = '/tmp/test-book-search-model.db';

function add(title: string, author: string) {
  return Book.createBook({
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

describe('searchBooks (BOOK-101)', () => {
  it('exports MAX_SEARCH_LENGTH = 100', () => {
    expect((Book as any).MAX_SEARCH_LENGTH).toBe(100);
  });

  it('exports SearchValidationError with name SearchValidationError', () => {
    const Cls = (Book as any).SearchValidationError;
    expect(typeof Cls).toBe('function');
    const e = new Cls('x');
    expect(e).toBeInstanceOf(Error);
    expect(e.name).toBe('SearchValidationError');
  });

  it('rule 1: leading and trailing whitespace is trimmed (model)', () => {
    add('Zqxtrim Title', 'Someone');
    const r = Book.searchBooks('   zqxtrim title \t\n');
    expect(r.map((b) => b.title)).toEqual(['Zqxtrim Title']);
  });

  it('rule 1: inner whitespace is kept (model)', () => {
    add('Zqxinner A B', 'Someone');
    add('Zqxinner AB', 'Someone');
    expect(Book.searchBooks(' zqxinner a b ').map((b) => b.title)).toEqual(['Zqxinner A B']);
  });

  it('rule 2: empty query returns all books ordered by title (model)', () => {
    const r = Book.searchBooks('');
    expect(r).toHaveLength(50);
    const titles = r.map((b) => b.title);
    expect(titles).toEqual([...titles].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)));
  });

  it('rule 2: whitespace-only query returns all books (model)', () => {
    expect(Book.searchBooks('   \t ')).toHaveLength(50);
  });

  it('rule 3: 101 characters is a validation error (model)', () => {
    const Cls = (Book as any).SearchValidationError;
    expect(Cls).toBeDefined();
    expect(() => Book.searchBooks('a'.repeat(101))).toThrow(Cls);
  });

  it('rule 3: exactly 100 characters is valid (model)', () => {
    expect(Book.searchBooks('a'.repeat(100))).toEqual([]);
  });

  it('rule 3: length is measured after trimming (model)', () => {
    const Cls = (Book as any).SearchValidationError;
    expect(Book.searchBooks('  ' + 'a'.repeat(100) + '  ')).toEqual([]);
    expect(() => Book.searchBooks('  ' + 'a'.repeat(101) + '  ')).toThrow(Cls);
  });

  it('rule 3: a 100-character title is found by its full text (model)', () => {
    const t = 'Zqxlong' + 'b'.repeat(93);
    expect(t).toHaveLength(100);
    add(t, 'Someone');
    expect(Book.searchBooks(t).map((b) => b.title)).toEqual([t]);
  });

  it('rule 4: matches inside the title, ignoring ASCII case (model)', () => {
    add('The Zqxcase Saga', 'Nobody');
    expect(Book.searchBooks('ZQXCASE').map((b) => b.title)).toEqual(['The Zqxcase Saga']);
    expect(Book.searchBooks('zqxCase sa')).toHaveLength(1);
  });

  it('rule 4: matches inside the author, ignoring ASCII case (model)', () => {
    add('Plain Title', 'Ann Zqxauthor Smith');
    expect(Book.searchBooks('ZQXAUTHOR').map((b) => b.title)).toEqual(['Plain Title']);
  });

  it('rule 4: results are ordered by title (model)', () => {
    add('Zqxord C', 'x');
    add('Zqxord A', 'x');
    add('Zqxord B', 'x');
    expect(Book.searchBooks('zqxord').map((b) => b.title)).toEqual(['Zqxord A', 'Zqxord B', 'Zqxord C']);
  });

  it('rule 5: % is a literal, not a wildcard (model)', () => {
    add('Zqxpct 100% Pure', 'x');
    add('Zqxpct 100 Pure', 'x');
    expect(Book.searchBooks('100%').map((b) => b.title)).toEqual(['Zqxpct 100% Pure']);
    expect(Book.searchBooks('%')).not.toHaveLength(50);
  });

  it('rule 5: % alone matches only titles or authors containing a percent sign (model)', () => {
    add('Zqxonly 5% off', 'x');
    expect(Book.searchBooks('%').map((b) => b.title)).toEqual(['Zqxonly 5% off']);
  });

  it('rule 5: _ is a literal, not a single-character wildcard (model)', () => {
    add('Zqxus a_b', 'x');
    add('Zqxus axb', 'x');
    expect(Book.searchBooks('a_b').map((b) => b.title)).toEqual(['Zqxus a_b']);
  });

  it('rule 5: _ alone matches only text containing an underscore (model)', () => {
    add('Zqxunder snake_case', 'x');
    expect(Book.searchBooks('_').map((b) => b.title)).toEqual(['Zqxunder snake_case']);
  });

  it('rule 5: an author containing % or _ is matched literally (model)', () => {
    add('Plain One', 'Zq_author 50%');
    expect(Book.searchBooks('q_a').map((b) => b.title)).toEqual(['Plain One']);
    expect(Book.searchBooks('0%').map((b) => b.title)).toEqual(['Plain One']);
  });

  it('rule 6: a single quote in the query is handled as text (model)', () => {
    add("Zqxquote O'Brien", 'x');
    expect(Book.searchBooks("O'Brien").map((b) => b.title)).toEqual(["Zqxquote O'Brien"]);
    const quoted = Book.searchBooks("'");
    expect(quoted.map((b) => b.title)).toContain("Zqxquote O'Brien");
    expect(quoted.length).toBeLessThan(50);
    for (const b of quoted) expect(`${b.title}${b.author}`).toContain("'");
  });

  it('rule 6: SQL injection text matches nothing and breaks nothing (model)', () => {
    expect(Book.searchBooks("' OR '1'='1")).toEqual([]);
    expect(Book.searchBooks("x'; DROP TABLE books; --")).toEqual([]);
    expect(Book.getAllBooks()).toHaveLength(50);
  });

  it('rule 7: no match returns an empty array, not an error (model)', () => {
    expect(Book.searchBooks('zzzz-no-such-book-zzzz')).toEqual([]);
  });
});

describe('searchBooks rule 8 (BOOK-101 finding)', () => {
  it('rule 8: an array q is a validation error (model)', () => {
    const Err = (Book as any).SearchValidationError;
    expect(() => Book.searchBooks(['a', 'b'] as unknown as string)).toThrow(Err);
  });

  it('rule 8: an object q is a validation error (model)', () => {
    const Err = (Book as any).SearchValidationError;
    expect(() => Book.searchBooks({ a: 'b' } as unknown as string)).toThrow(Err);
  });

  it('rule 8: a single-element array q is a validation error (model)', () => {
    const Err = (Book as any).SearchValidationError;
    expect(() => Book.searchBooks(['dune'] as unknown as string)).toThrow(Err);
  });
});
