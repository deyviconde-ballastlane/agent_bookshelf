import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import { initDb, closeDb } from '../../src/db/index.js';
import * as Book from '../../src/models/book.js';

const DB = '/tmp/test-book-search-model.db';

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

const titles = (books: Book.Book[]) => books.map((b) => b.title);
const search = (q: string) => Book.searchBooks(q);

describe('searchBooks (model)', () => {
  it('exports MAX_SEARCH_LENGTH = 100 and SearchValidationError', () => {
    expect(Book.MAX_SEARCH_LENGTH).toBe(100);
    const err = new Book.SearchValidationError('x');
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('SearchValidationError');
  });

  it('rule 1: leading and trailing spaces are trimmed', () => {
    expect(titles(search('   Zqx Alpha   '))).toEqual(['Zqx Alpha']);
  });

  it('rule 1: tabs and newlines are trimmed', () => {
    expect(titles(search('\t\nZqx Alpha\n '))).toEqual(['Zqx Alpha']);
  });

  it('rule 1: inner spaces are kept', () => {
    expect(search('Zqx  Alpha')).toEqual([]);
  });

  it('rule 2: empty query returns all books ordered by title', () => {
    const res = search('');
    expect(res).toHaveLength(58);
    expect(titles(res)).toEqual(titles(Book.getAllBooks()));
  });

  it('rule 2: whitespace-only query returns all books', () => {
    expect(titles(search('   \t '))).toEqual(titles(Book.getAllBooks()));
  });

  it('rule 2: missing query (undefined) returns all books', () => {
    expect(titles(Book.searchBooks(undefined as unknown as string))).toEqual(
      titles(Book.getAllBooks())
    );
  });

  it('rule 3: exactly 100 characters is valid', () => {
    const q = 'k'.repeat(100);
    add(q + 'tail', 'Long Author');
    expect(titles(search(q))).toEqual([q + 'tail']);
  });

  it('rule 3: 101 characters is a validation error', () => {
    expect(() => search('k'.repeat(101))).toThrow(Book.SearchValidationError);
  });

  it('rule 3: length is counted after trimming (100 + spaces is valid)', () => {
    expect(() => search('  ' + 'k'.repeat(100) + '  ')).not.toThrow();
  });

  it('rule 3: 101 characters plus spaces is a validation error', () => {
    expect(() => search(' ' + 'k'.repeat(101) + ' ')).toThrow(Book.SearchValidationError);
  });

  it('rule 4: matches inside the title', () => {
    expect(titles(search('Alpha'))).toEqual(['Zqx Alpha']);
  });

  it('rule 4: matches inside the author', () => {
    expect(titles(search('Bob Zqx'))).toEqual(['Plain Title']);
  });

  it('rule 4: matches title or author, ordered by title', () => {
    expect(titles(search('zqx'))).toEqual(['LOUD ZQX Gamma', 'Plain Title', 'Zqx Alpha']);
  });

  it('rule 4: lower case query matches upper case text', () => {
    expect(titles(search('loud'))).toEqual(['LOUD ZQX Gamma']);
  });

  it('rule 4: upper case query matches lower case text', () => {
    expect(titles(search('ALPHA'))).toContain('Zqx Alpha');
  });

  it('rule 4: apostrophe in query matches literally', () => {
    expect(titles(search("O'Brien"))).toEqual(["O'Brien Tales"]);
  });

  it('rule 5: % matches itself, not any text', () => {
    expect(titles(search('100%'))).toEqual(['100% Pure']);
  });

  it('rule 5: a lone % matches only books containing a percent sign', () => {
    expect(titles(search('%'))).toEqual(['100% Pure']);
  });

  it('rule 5: _ matches itself, not any single character', () => {
    expect(titles(search('Snake_case'))).toEqual(['Snake_case Guide']);
  });

  it('rule 5: a lone _ matches only books containing an underscore', () => {
    expect(titles(search('_'))).toEqual(['Snake_case Guide']);
  });

  it('rule 6: SQL injection text is data, not SQL (OR clause)', () => {
    expect(search("' OR '1'='1")).toEqual([]);
  });

  it('rule 6: SQL injection text does not drop the table', () => {
    expect(search("'; DROP TABLE books; --")).toEqual([]);
    expect(Book.getAllBooks()).toHaveLength(58);
  });

  it('rule 7: no match returns an empty array, not an error', () => {
    expect(search('nothing-matches-this-xyz')).toEqual([]);
  });

  it('rule 8: an array is a validation error', () => {
    expect(() => Book.searchBooks(['a', 'b'] as unknown as string)).toThrow(
      Book.SearchValidationError
    );
  });

  it('rule 8: an object is a validation error', () => {
    expect(() => Book.searchBooks({ x: '1' } as unknown as string)).toThrow(
      Book.SearchValidationError
    );
  });
});
