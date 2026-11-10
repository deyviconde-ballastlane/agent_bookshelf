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

export function searchBooks(query: string): Book[] {
  const pattern = `%${query}%`;
  return all(
    'SELECT * FROM books WHERE title LIKE ? OR author LIKE ? ORDER BY title',
    [pattern, pattern]
  ) as unknown as Book[];
}

export function createBook(data: Omit<Book, 'id' | 'created_at'>): Book {
  const result = run(
    'INSERT INTO books (title, author, isbn, cover_url, description, published_year) VALUES (?, ?, ?, ?, ?, ?)',
    [data.title, data.author, data.isbn ?? null, data.cover_url ?? null, data.description ?? null, data.published_year ?? null]
  );
  return getBookById(result.lastInsertRowid)!;
}

export function getBookByIsbn(isbn: string): Book | undefined {
  return get('SELECT * FROM books WHERE isbn = ?', [isbn]) as unknown as Book | undefined;
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
