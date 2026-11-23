import { all, get, run } from '../db/index.js';

export interface Book {
  id: number;
  title: string;
  author: string;
  isbn: string | null;
  cover_url: string | null;
  description: string | null;
  published_year: number | null;
  created_at: string;
}

export function getAllBooks(): Book[] {
  return all('SELECT * FROM books ORDER BY title') as unknown as Book[];
}

export function getBookById(id: number): Book | undefined {
  return get('SELECT * FROM books WHERE id = ?', [id]) as unknown as Book | undefined;
}

export const MAX_SEARCH_LENGTH = 100;

export class SearchValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SearchValidationError';
  }
}

export function searchBooks(query: string): Book[] {
  if (query !== undefined && typeof query !== 'string') {
    throw new SearchValidationError('Search query must be a single string');
  }
  const text = (query ?? '').trim();
  if (text.length > MAX_SEARCH_LENGTH) {
    throw new SearchValidationError(
      `Search query must be at most ${MAX_SEARCH_LENGTH} characters`
    );
  }
  if (text === '') return getAllBooks();

  const escaped = text.replace(/[\\%_]/g, '\\$&');
  const pattern = `%${escaped}%`;
  return all(
    "SELECT * FROM books WHERE title LIKE ? ESCAPE '\\' OR author LIKE ? ESCAPE '\\' ORDER BY title",
    [pattern, pattern]
  ) as unknown as Book[];
}

export function createBook(data: Omit<Book, 'id' | 'created_at'>): Book {
  const result = run(
    'INSERT INTO books (title, author, isbn, cover_url, description, published_year) VALUES (?, ?, ?, ?, ?, ?)',
    [data.title, data.author, data.isbn, data.cover_url, data.description, data.published_year]
  );
  return getBookById(result.lastInsertRowid)!;
}

export function updateBook(id: number, data: Partial<Omit<Book, 'id' | 'created_at'>>): Book | undefined {
  const existing = getBookById(id);
  if (!existing) return undefined;

  const updates: string[] = [];
  const values: unknown[] = [];

  if (data.title !== undefined) {
    updates.push('title = ?');
    values.push(data.title);
  }
  if (data.author !== undefined) {
    updates.push('author = ?');
    values.push(data.author);
  }
  if (data.isbn !== undefined) {
    updates.push('isbn = ?');
    values.push(data.isbn);
  }
  if (data.cover_url !== undefined) {
    updates.push('cover_url = ?');
    values.push(data.cover_url);
  }
  if (data.description !== undefined) {
    updates.push('description = ?');
    values.push(data.description);
  }
  if (data.published_year !== undefined) {
    updates.push('published_year = ?');
    values.push(data.published_year);
  }

  if (updates.length === 0) return existing;

  values.push(id);
  run(`UPDATE books SET ${updates.join(', ')} WHERE id = ?`, values);
  return getBookById(id);
}

export function deleteBook(id: number): boolean {
  const result = run('DELETE FROM books WHERE id = ?', [id]);
  return result.changes > 0;
}
