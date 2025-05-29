# Onion Architecture Todo API Demo

This demo showcases how to use **rawsql-ts** with **Onion Architecture** pattern, featuring:

- **Hono** - Fast web framework for Node.js
- **Docker & PostgreSQL** - Containerized database setup
- **rawsql-ts** - Type-safe SQL query building and formatting
- **Onion Architecture** - Clean architecture implementation with clear separation of concerns

## Features

This demo implements a single feature: **Todo Search with Dynamic Conditions**

The search API allows filtering todos by:
- **Title** (partial match using ILIKE)
- **Status** (completed/pending)
- **Priority** (high/medium/low)
- **Creation date range** (fromDate/toDate)

## Architecture Layers

```
src/
├── domain/           # Domain Layer
│   ├── Todo.ts      # → Todo entity and value objects
│   └── TodoRepository.ts # → Repository interface
├── application/      # Application Layer
│   └── SearchTodosUseCase.ts # → Business logic for searching todos
├── infrastructure/   # Infrastructure Layer
│   ├── DatabaseConnection.ts # → Database connection management
│   └── PostgresTodoRepository.ts # → rawsql-ts implementation
├── presentation/     # Presentation Layer
│   ├── dto.ts       # → Data transfer objects and validation
│   └── TodoController.ts # → Hono HTTP endpoints
└── scripts/         # Utility Scripts
    ├── setup-db.ts  # → Database setup verification
    └── demo.ts      # → Interactive demo script
```

### Key Architecture Benefits

1. **Dependency Inversion**: Outer layers depend on inner layers through interfaces
2. **Testability**: Each layer can be unit tested independently
3. **Flexibility**: Easy to swap implementations (e.g., different databases)
4. **Business Logic Isolation**: Core business rules are in the domain/application layers

## rawsql-ts Integration

This demo demonstrates several rawsql-ts features:

1. **Dynamic Query Building**: Using `SelectQueryParser.parse()` to create base queries
2. **SQL Formatting**: Using `SqlFormatter` with PostgreSQL preset for dialect-specific output
3. **Parameter Handling**: Converting named parameters to PostgreSQL numbered parameters
4. **Type Safety**: Strongly typed SQL AST manipulation

## Quick Start

### Option 1: Automated Setup (Windows)
```bash
# Clone and navigate to demo
cd demo/onion-todo-api

# Install dependencies
npm install

# Run automated demo (starts DB, runs demo, shows examples)
.\run-demo.bat
```

### Option 2: Manual Setup

1. **Start PostgreSQL**:
```bash
docker-compose up -d
```

2. **Install dependencies**:
```bash
npm install
```

3. **Verify database setup**:
```bash
npm run db:setup
```

4. **Run interactive demo**:
```bash
npm run demo
```

5. **Start the API server**:
```bash
npm run dev
```

## API Endpoints

### Search Todos
- **Endpoint**: `GET /todos/search`
- **Description**: Search todos with optional query parameters

**Query Parameters:**
- `title` - Filter by title (partial match)
- `status` - Filter by status (`completed` | `pending`)
- `priority` - Filter by priority (`high` | `medium` | `low`)
- `fromDate` - Filter todos created after this date (ISO 8601)
- `toDate` - Filter todos created before this date (ISO 8601)

### Other Endpoints
- `GET /health` - Health check endpoint
- `GET /docs` - API documentation

## Example Usage

```bash
# Search all todos
curl "http://localhost:3000/todos/search"

# Search by title (partial match)
curl "http://localhost:3000/todos/search?title=プレゼン"

# Search by status and priority
curl "http://localhost:3000/todos/search?status=pending&priority=high"

# Search by date range
curl "http://localhost:3000/todos/search?fromDate=2024-01-01T00:00:00Z&toDate=2024-12-31T23:59:59Z"

# Complex search
curl "http://localhost:3000/todos/search?title=meeting&status=pending&priority=high"
```

## Sample Data

The database is initialized with Japanese sample todos:

- 完成プレゼンテーション (high priority, pending)
- 食料品の買い物 (medium priority, completed)
- 歯医者の予約 (low priority, pending)
- プロジェクト報告書 (high priority, pending)
- 運動する (medium priority, completed)
- And more...

## Code Highlights

### rawsql-ts Dynamic Query Building

```typescript
// Base query parsing
const baseQuery = `SELECT id, title, description, status, priority, created_at, updated_at FROM todos WHERE 1 = 1`;
const parsedQuery = SelectQueryParser.parse(baseQuery);

// Dynamic condition building
const conditions: string[] = [];
if (criteria.title) {
  conditions.push(`title ILIKE :title`);
}

// PostgreSQL formatting
const formatter = new SqlFormatter({ preset: 'postgres' });
const { formattedSql } = formatter.format(formattedQuery);
```

### Onion Architecture Dependency Flow

```typescript
// Infrastructure → Application → Presentation
const todoRepository = new PostgresTodoRepository(pool);        // Infrastructure
const searchTodosUseCase = new SearchTodosUseCase(todoRepository); // Application  
const todoController = new TodoController(searchTodosUseCase);     // Presentation
```

## Development

```bash
# Start in development mode (with file watching)
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Database utilities
npm run db:setup    # Verify database setup
npm run demo        # Run interactive demo
```

## Environment Variables

```bash
# Database configuration (optional, defaults provided)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=todoapp
DB_USER=todouser
DB_PASSWORD=todopass

# Server configuration (optional)
PORT=3000
```

## Cleanup

```bash
# Stop and remove containers
docker-compose down

# Remove volumes (deletes data)
docker-compose down -v
```

## Technical Notes

- **Parameter Conversion**: The demo converts rawsql-ts named parameters (`:param`) to PostgreSQL numbered parameters (`$1`, `$2`)
- **Error Handling**: Comprehensive error handling at each architecture layer
- **Type Safety**: Full TypeScript support throughout all layers
- **SQL Injection Prevention**: Uses parameterized queries exclusively
- **Connection Pooling**: Efficient PostgreSQL connection management

This demo serves as a practical example of implementing clean architecture principles while leveraging rawsql-ts for type-safe, dynamic SQL query construction.
