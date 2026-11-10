import { Router, Request, Response } from 'express';
import * as Book from '../models/book.js';
import * as User from '../models/user.js';
import * as Review from '../models/review.js';
import * as Shelf from '../models/shelf.js';

const router = Router();

const isNonEmptyString = (v: unknown): v is string => typeof v === 'string' && v !== '';
const isOptionalString = (v: unknown): boolean => v === undefined || v === null || typeof v === 'string';
const isOptionalInt = (v: unknown): boolean => v === undefined || v === null || Number.isInteger(v);
const isId = (v: unknown): v is number => Number.isInteger(v) && (v as number) > 0;
const isRating = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 1 && (v as number) <= 5;

// Books API
router.get('/books', (req: Request, res: Response) => {
  const books = Book.getAllBooks();
  res.json(books);
});

router.get('/books/:id', (req: Request, res: Response) => {
  const bookId = parseInt(req.params.id as string, 10);
  const book = Book.getBookById(bookId);

  if (!book) {
    return res.status(404).json({ error: 'Book not found' });
  }

  res.json(book);
});

router.post('/books', (req: Request, res: Response) => {
  const { title, author, isbn, cover_url, description, published_year } = req.body;

  if (!isNonEmptyString(title) || !isNonEmptyString(author)) {
    return res.status(400).json({ error: 'Title and author are required' });
  }

  if (!isOptionalString(isbn) || !isOptionalString(cover_url) || !isOptionalString(description) || !isOptionalInt(published_year)) {
    return res.status(400).json({ error: 'Invalid book fields' });
  }

  if (typeof isbn === 'string' && Book.getBookByIsbn(isbn)) {
    return res.status(409).json({ error: 'A book with this ISBN already exists' });
  }

  const book = Book.createBook({ title, author, isbn, cover_url, description, published_year });
  res.status(201).json(book);
});

router.patch('/books/:id', (req: Request, res: Response) => {
  const bookId = parseInt(req.params.id as string, 10);
  const { title, author, isbn, cover_url, description, published_year } = req.body;

  if ((title !== undefined && !isNonEmptyString(title)) || (author !== undefined && !isNonEmptyString(author)) ||
      !isOptionalString(isbn) || !isOptionalString(cover_url) || !isOptionalString(description) || !isOptionalInt(published_year)) {
    return res.status(400).json({ error: 'Invalid book fields' });
  }

  if (!Book.getBookById(bookId)) {
    return res.status(404).json({ error: 'Book not found' });
  }

  if (typeof isbn === 'string') {
    const other = Book.getBookByIsbn(isbn);
    if (other && other.id !== bookId) {
      return res.status(409).json({ error: 'A book with this ISBN already exists' });
    }
  }

  const book = Book.updateBook(bookId, req.body);

  if (!book) {
    return res.status(404).json({ error: 'Book not found' });
  }

  res.json(book);
});

router.delete('/books/:id', (req: Request, res: Response) => {
  const bookId = parseInt(req.params.id as string, 10);
  const deleted = Book.deleteBook(bookId);

  if (!deleted) {
    return res.status(404).json({ error: 'Book not found' });
  }

  res.status(204).send();
});

// Users API
router.get('/users', (req: Request, res: Response) => {
  const users = User.getAllUsers();
  res.json(users);
});

router.get('/users/:id', (req: Request, res: Response) => {
  const userId = parseInt(req.params.id as string, 10);
  const user = User.getUserById(userId);

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  res.json(user);
});

router.post('/users', (req: Request, res: Response) => {
  const { username, displayName } = req.body;

  if (!isNonEmptyString(username) || !isNonEmptyString(displayName)) {
    return res.status(400).json({ error: 'Username and displayName are required' });
  }

  if (User.getUserByUsername(username)) {
    return res.status(409).json({ error: 'Username already taken' });
  }

  const user = User.createUser(username, displayName);
  res.status(201).json(user);
});

router.patch('/users/:id', (req: Request, res: Response) => {
  const userId = parseInt(req.params.id as string, 10);
  const { username, displayName } = req.body;

  if ((username !== undefined && !isNonEmptyString(username)) || (displayName !== undefined && !isNonEmptyString(displayName))) {
    return res.status(400).json({ error: 'Username and displayName must be non-empty strings' });
  }

  if (!User.getUserById(userId)) {
    return res.status(404).json({ error: 'User not found' });
  }

  if (username !== undefined) {
    const other = User.getUserByUsername(username);
    if (other && other.id !== userId) {
      return res.status(409).json({ error: 'Username already taken' });
    }
  }

  const user = User.updateUser(userId, req.body);

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  res.json(user);
});

router.delete('/users/:id', (req: Request, res: Response) => {
  const userId = parseInt(req.params.id as string, 10);
  const deleted = User.deleteUser(userId);

  if (!deleted) {
    return res.status(404).json({ error: 'User not found' });
  }

  res.status(204).send();
});

// Reviews API
router.get('/reviews/book/:bookId', (req: Request, res: Response) => {
  const bookId = parseInt(req.params.bookId as string, 10);
  const reviews = Review.getReviewsByBookId(bookId);
  res.json(reviews);
});

router.get('/reviews/user/:userId', (req: Request, res: Response) => {
  const userId = parseInt(req.params.userId as string, 10);
  const reviews = Review.getReviewsByUserId(userId);
  res.json(reviews);
});

router.get('/reviews/:id', (req: Request, res: Response) => {
  const reviewId = parseInt(req.params.id as string, 10);
  const review = Review.getReviewById(reviewId);

  if (!review) {
    return res.status(404).json({ error: 'Review not found' });
  }

  res.json(review);
});

router.post('/reviews', (req: Request, res: Response) => {
  const { userId, bookId, rating, reviewText } = req.body;

  if (!userId || !bookId || !rating) {
    return res.status(400).json({ error: 'userId, bookId, and rating are required' });
  }

  if (!isId(userId) || !isId(bookId)) {
    return res.status(400).json({ error: 'userId and bookId must be positive integers' });
  }

  if (!isRating(rating)) {
    return res.status(400).json({ error: 'Rating must be between 1 and 5' });
  }

  if (!isOptionalString(reviewText)) {
    return res.status(400).json({ error: 'reviewText must be a string' });
  }

  if (!User.getUserById(userId)) {
    return res.status(404).json({ error: 'User not found' });
  }

  if (!Book.getBookById(bookId)) {
    return res.status(404).json({ error: 'Book not found' });
  }

  const existing = Review.getReviewByUserAndBook(userId, bookId);
  if (existing) {
    return res.status(409).json({ error: 'User has already reviewed this book' });
  }

  const review = Review.createReview(userId, bookId, rating, reviewText);
  res.status(201).json(review);
});

router.patch('/reviews/:id', (req: Request, res: Response) => {
  const reviewId = parseInt(req.params.id as string, 10);
  const { rating, reviewText } = req.body;

  if (rating !== undefined && !isRating(rating)) {
    return res.status(400).json({ error: 'Rating must be between 1 and 5' });
  }

  if (!isOptionalString(reviewText)) {
    return res.status(400).json({ error: 'reviewText must be a string' });
  }

  const review = Review.updateReview(reviewId, req.body);

  if (!review) {
    return res.status(404).json({ error: 'Review not found' });
  }

  res.json(review);
});

router.delete('/reviews/:id', (req: Request, res: Response) => {
  const reviewId = parseInt(req.params.id as string, 10);
  const deleted = Review.deleteReview(reviewId);

  if (!deleted) {
    return res.status(404).json({ error: 'Review not found' });
  }

  res.status(204).send();
});

// Shelves API
router.get('/shelves/user/:userId', (req: Request, res: Response) => {
  const userId = parseInt(req.params.userId as string, 10);
  const shelves = Shelf.getShelvesByUserId(userId);
  res.json(shelves);
});

router.get('/shelves/:id', (req: Request, res: Response) => {
  const shelfId = parseInt(req.params.id as string, 10);
  const shelf = Shelf.getShelfWithBooks(shelfId);

  if (!shelf) {
    return res.status(404).json({ error: 'Shelf not found' });
  }

  res.json(shelf);
});

router.post('/shelves', (req: Request, res: Response) => {
  const { userId, name } = req.body;

  if (!isId(userId) || !isNonEmptyString(name)) {
    return res.status(400).json({ error: 'userId and name are required' });
  }

  if (!User.getUserById(userId)) {
    return res.status(404).json({ error: 'User not found' });
  }

  if (Shelf.getShelvesByUserId(userId).some((s) => s.name === name)) {
    return res.status(409).json({ error: 'Shelf with this name already exists' });
  }

  const shelf = Shelf.createShelf(userId, name);
  res.status(201).json(shelf);
});

router.delete('/shelves/:id', (req: Request, res: Response) => {
  const shelfId = parseInt(req.params.id as string, 10);
  const deleted = Shelf.deleteShelf(shelfId);

  if (!deleted) {
    return res.status(404).json({ error: 'Shelf not found' });
  }

  res.status(204).send();
});

router.post('/shelves/:id/books', (req: Request, res: Response) => {
  const shelfId = parseInt(req.params.id as string, 10);
  const { bookId } = req.body;

  if (!isId(shelfId)) {
    return res.status(400).json({ error: 'Invalid shelf id' });
  }

  if (!isId(bookId)) {
    return res.status(400).json({ error: 'bookId is required' });
  }

  if (!Shelf.getShelfById(shelfId)) {
    return res.status(404).json({ error: 'Shelf not found' });
  }

  if (!Book.getBookById(bookId)) {
    return res.status(404).json({ error: 'Book not found' });
  }

  const added = Shelf.addBookToShelf(shelfId, bookId);
  if (!added) {
    return res.status(409).json({ error: 'Book already on shelf' });
  }

  res.status(201).json({ message: 'Book added to shelf' });
});

router.delete('/shelves/:id/books/:bookId', (req: Request, res: Response) => {
  const shelfId = parseInt(req.params.id as string, 10);
  const bookId = parseInt(req.params.bookId as string, 10);
  const removed = Shelf.removeBookFromShelf(shelfId, bookId);

  if (!removed) {
    return res.status(404).json({ error: 'Book not found on shelf' });
  }

  res.status(204).send();
});

export default router;
