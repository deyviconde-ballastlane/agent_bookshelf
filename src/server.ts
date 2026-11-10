import express, { Request, Response, NextFunction } from 'express';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { initDb } from './db/index.js';
import booksRouter from './routes/books.js';
import shelvesRouter from './routes/shelves.js';
import reviewsRouter from './routes/reviews.js';
import apiRouter from './routes/api.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', join(__dirname, 'views'));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(join(__dirname, 'public')));

app.use((req, res, next) => {
  res.locals.currentPath = req.path;
  next();
});

app.use('/', booksRouter);
app.use('/shelves', shelvesRouter);
app.use('/reviews', reviewsRouter);
app.use('/api', apiRouter);

app.use((err: Error & { status?: number; statusCode?: number }, req: Request, res: Response, next: NextFunction) => {
  const status = err.status ?? err.statusCode;
  if (status && status >= 400 && status < 500) {
    return res.status(status).json({ error: err.message });
  }
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

export async function startServer(dbPath?: string) {
  await initDb(dbPath);

  app.listen(PORT, () => {
    console.log(`Bookshelf running at http://localhost:${PORT}`);
  });
}

const isMainModule = import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith('server.ts') ||
  process.argv[1]?.endsWith('server.js');

if (isMainModule) {
  startServer();
}

export default app;
