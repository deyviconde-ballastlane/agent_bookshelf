```
╔═════════════════════════════════════════════╗
║│▓│▒│░│█│▓│░│▒│█│▓│▒│░│█│▓│░│▒│█│▓│▒│░│█│▓│░│║
╠═════════════════════════════════════════════╣
║                                             ║
║     ▄▀█ █▀▀ █▀▀ █▄░█ ▀█▀                    ║
║     █▀█ █▄█ █▄▄ █░▀█ ░█░                    ║
║                                             ║
║     █▄▄ █▀█ █▀█ █▄▀ █▀ █░█ █▀▀ █░░ █▀▀      ║
║     █▄█ █▄█ █▄█ █░█ ▄█ █▀█ █▄▄ █▄▄ █▀░      ║
║                                             ║
║  a goodreads-lite playground for AI agents  ║
║                                             ║
╠═════════════════════════════════════════════╣
║│█│▓│░│▒│█│▓│▒│░│█│▓│░│▒│█│▓│▒│░│█│▓│░│▒│█│▓│║
╚═════════════════════════════════════════════╝
```

# Agent Bookshelf

A Goodreads-lite application designed as a teaching playground for AI agents courses. Students install it locally and use AI agents (Claude Code, etc.) to complete homework assignments.

## Prerequisites

**Node.js 24 LTS** is required.

| OS | Install |
|---|---|
| **macOS** | Download `.pkg` from [nodejs.org](https://nodejs.org) — Universal binary (Intel + Apple Silicon) |
| **Windows** | Download `.msi` from [nodejs.org](https://nodejs.org) — tick "Tools for Native Modules" during install |
| **Linux** | `curl -fsSL https://deb.nodesource.com/setup_24.x \| sudo -E bash - && sudo apt-get install -y nodejs` |

Verify:

```bash
node -v   # should print v24.x.x
npm -v    # should print 11.x.x
```

## Quick Start

### Using npx

```bash
corepack enable
npm install
npm run build
npx agent-bookshelf
```

That's it! The app will start at http://localhost:3000 with pre-seeded data.

## What is this?

Agent Bookshelf is a deliberately structured teaching codebase where:

- **Students** get an easy-to-install app that works immediately
- **AI agents** get a familiar, well-structured codebase to work with
- **Homework gaps** are built in for agents to fill

### Features

- Browse 50 pre-seeded books (tech and sci-fi)
- View book details with reviews and ratings
- Manage user shelves (want-to-read, currently-reading, read)
- Add reviews and ratings
- REST API for agent interaction
- HTMX-powered dynamic UI

### Pre-seeded Data

The app comes with:
- 50 books across tech and sci-fi genres
- 3 users: Alice Chen, Bob Martinez, Carol Okafor
- Sample shelves and reviews
- SQLite database (zero configuration)

## For Students

### Installation

**Prerequisites:** Node.js 20 or higher

**macOS / Linux:**
```bash
npx agent-bookshelf
```

**Windows:**
```bash
npx agent-bookshelf
```

The app will start automatically at http://localhost:3000

### Using the App

1. Browse books at http://localhost:3000
2. Click a book to see details and reviews
3. Visit /shelves to see user bookshelves
4. Add reviews and manage shelves through the UI

### For AI Agents

The app provides a REST API at `/api/*`:

```bash
# Get all books
curl http://localhost:3000/api/books

# Get a specific book
curl http://localhost:3000/api/books/1

# Add a review
curl -X POST http://localhost:3000/api/reviews \
  -H "Content-Type: application/json" \
  -d '{"userId": 1, "bookId": 5, "rating": 5, "reviewText": "Excellent!"}'

# Get user shelves
curl http://localhost:3000/api/shelves/user/1
```

### Routes

<!-- routes:start -->
JSON API (`src/routes/api.ts`)

| Method | Path | Body | Success | Errors |
|---|---|---|---|---|
| GET | `/api/books` | — | 200 book list | — |
| GET | `/api/books/:id` | — | 200 book | 404 |
| POST | `/api/books` | `title`, `author`, `isbn?`, `cover_url?`, `description?`, `published_year?` | 201 book | 400 |
| PATCH | `/api/books/:id` | `title?`, `author?`, `isbn?`, `cover_url?`, `description?`, `published_year?` | 200 book | 404 |
| DELETE | `/api/books/:id` | — | 204 | 404 |
| GET | `/api/users` | — | 200 user list | — |
| GET | `/api/users/:id` | — | 200 user | 404 |
| POST | `/api/users` | `username`, `displayName` | 201 user | 400 |
| PATCH | `/api/users/:id` | `username?`, `displayName?` | 200 user | 404 |
| DELETE | `/api/users/:id` | — | 204 | 404 |
| GET | `/api/reviews/book/:bookId` | — | 200 review list | — |
| GET | `/api/reviews/user/:userId` | — | 200 review list | — |
| GET | `/api/reviews/:id` | — | 200 review | 404 |
| POST | `/api/reviews` | `userId`, `bookId`, `rating` (1–5), `reviewText?` | 201 review | 400, 409 |
| PATCH | `/api/reviews/:id` | `rating?` (no range check), `reviewText?` | 200 review | 404 |
| DELETE | `/api/reviews/:id` | — | 204 | 404 |
| GET | `/api/shelves/user/:userId` | — | 200 shelf list | — |
| GET | `/api/shelves/:id` | — | 200 shelf with books | 404 |
| POST | `/api/shelves` | `userId`, `name` | 201 shelf | 400 |
| DELETE | `/api/shelves/:id` | — | 204 | 404 |
| POST | `/api/shelves/:id/books` | `bookId` | 201 `{ message }` | 400, 409 |
| DELETE | `/api/shelves/:id/books/:bookId` | — | 204 | 404 |

HTML pages (`src/routes/books.ts`, `shelves.ts`, `reviews.ts`)

| Method | Path | Renders | Called by HTMX |
|---|---|---|---|
| GET | `/` | `books/index` page | no |
| GET | `/books/search` | TODO: placeholder snippet, ignores `?q=` | yes, from `books/index` |
| GET | `/books/:id` | `books/show` page (404 → `error`) | no |
| POST | `/books/:id/reviews` | `books/reviews-list` partial; form `userId`, `rating`, `reviewText?` (400, 409 → error snippet) | yes, from `books/show` |
| GET | `/shelves` | `shelves/index` page | no |
| GET | `/shelves/user/:userId` | `shelves/user` page (404 → `error`) | no |
| GET | `/shelves/:id` | `shelves/show` page (404 → `error`) | no |
| POST | `/shelves/:id/books` | `shelves/books-list` partial; form `bookId` (400 → error snippet; duplicates ignored) | yes, from `shelves/show` |
| DELETE | `/shelves/:id/books/:bookId` | `shelves/books-list` partial | yes, from `shelves/books-list` |
| GET | `/reviews/:id` | `reviews/show` page (404 → `error`) | no |
<!-- routes:end -->

## For Instructors

### Homework Gaps

The codebase includes deliberate gaps for homework assignments:

1. **Search functionality** - UI exists but backend is a TODO
   - Location: `src/routes/books.ts` line 14
   - Students can implement the search backend

2. **Missing tests** - Models have no test coverage
   - Location: `tests/` directory
   - QA homework: write test suites for models

3. **Input validation** - API endpoints lack validation
   - Location: `src/routes/api.ts`
   - Students can add validation middleware

4. **UI improvements** - Functional but minimal design
   - Location: `src/public/css/style.css`
   - PM homework: redesign specific components

### Architecture

- **Backend:** Express + TypeScript
- **Database:** SQLite via sql.js (WebAssembly, zero native dependencies)
- **Frontend:** EJS templates + HTMX
- **Testing:** Vitest (setup included, tests are homework)

### Project Structure

```
agent_bookshelf/
├── src/
│   ├── server.ts          # Express app + server
│   ├── db/
│   │   ├── schema.sql     # Database schema
│   │   ├── seed.sql       # Pre-seeded data
│   │   └── index.ts       # DB connection
│   ├── models/            # Data models (no tests - homework gap)
│   ├── routes/
│   │   ├── books.ts       # HTML routes
│   │   ├── shelves.ts
│   │   ├── reviews.ts
│   │   └── api.ts         # JSON API
│   ├── views/             # EJS templates
│   └── public/            # Static assets
├── tests/                 # Vitest setup (tests are homework)
├── bin/                   # CLI entry point
└── docs/adr/              # Architecture decisions
```

### Running Tests

```bash
npm test          # Run tests in watch mode
npm run test:run  # Run tests once
```

Note: The test setup is included, but actual tests are intentionally missing (homework gap).

## License

GPL-3.0

## Contributing

This is a teaching project. Contributions should maintain the deliberate gaps that make homework assignments possible.
