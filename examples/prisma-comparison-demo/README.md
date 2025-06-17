# Prisma Comparison Demo

A comprehensive demonstration environment showcasing the capabilities of `@rawsql-ts/prisma-integration` compared to traditional Prisma ORM approaches.

## 🎯 What This Demo Shows

This project demonstrates:
- **Side-by-side comparison** between Prisma ORM and RawSqlClient approaches
- **Real-world SQL queries** with complex joins and aggregations
- **JSON mapping capabilities** for hierarchical data structures
- **Static analysis validation** of SQL files against Prisma schema
- **Type-safe development** with TypeScript integration
- **Complete development workflow** from setup to testing

## 🏗️ Project Structure

```
prisma-comparison-demo/
├── prisma/
│   ├── schema.prisma          # Database schema definition
│   ├── seed.ts                # Sample data seeding
│   └── sql/                   # Raw SQL queries for comparison
│       ├── getTodoDetail.sql
│       ├── searchTodos.sql
│       └── ...
├── rawsql-ts/                 # RawSqlClient SQL files
│   ├── getTodoDetail.sql      # Enhanced version with JSON mapping
│   ├── getTodoDetail.json     # JSON transformation mapping
│   ├── searchTodos.sql
│   ├── searchTodos.json
│   └── ...
├── src/
│   ├── contracts/             # TypeScript interfaces and types
│   ├── interfaces/            # Domain model definitions
│   ├── services/              # Business logic services
│   └── test-runners/          # Comparison test implementations
├── tests/
│   └── sql-static-analysis.test.ts  # Static validation tests
├── reports/                   # Generated analysis reports
└── docker-compose.yml         # PostgreSQL setup
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm
- Docker and Docker Compose (for PostgreSQL)
- VS Code (recommended for SQL editing)

### 1. Clone and Setup

```bash
git clone <repository-url>
cd rawsql-ts/examples/prisma-comparison-demo

# Install dependencies
npm install
```

### 2. Configure Environment

Create a `.env` file in the project root with the following content:

```bash
# Database connection for Docker PostgreSQL
DATABASE_URL="postgresql://demo_user:demo_password@localhost:5432/prisma_comparison_demo?schema=public"
```

> **Note**: These credentials match the Docker Compose configuration. Adjust if you use different settings.

### 3. Start Database

```bash
# Start PostgreSQL with Docker
docker-compose up -d

# Wait a few seconds for PostgreSQL to initialize
```

### 4. Initialize Database

```bash
# Run Prisma migrations
npx prisma migrate dev

# Seed with sample data
npx prisma db seed

# Generate Prisma client
npx prisma generate
```

### 5. Verify Setup

```bash
# Run static analysis to validate SQL files
npm run test:sql-validation

# Expected output:
# ✅ All SQL files validated successfully!
```

### 6. Explore the Demo

```bash
# Run comparison examples
npm run demo:comparison

# Run specific examples
npm run demo:prisma-vs-rawsql
npm run demo:json-mapping
npm run demo:dynamic-queries
```

## 📊 Demo Scenarios

### Scenario 1: Basic Data Retrieval

**Prisma ORM Approach:**
```typescript
// Traditional Prisma with includes
const todoWithRelations = await prisma.todo.findUnique({
  where: { id: todoId },
  include: {
    user: true,
    category: true,
    comments: {
      include: {
        user: true
      }
    }
  }
});
```

**RawSqlClient Approach:**
```typescript
// Single query with JSON mapping
const todoDetail = await rawSqlClient.queryOne<TodoDetail>(
  'getTodoDetail.sql', 
  { todoId }
);
```

### Scenario 2: Complex Search Queries

**Prisma ORM Approach:**
```typescript
// Multiple separate queries or complex where conditions
const todos = await prisma.todo.findMany({
  where: {
    AND: [
      { title: { contains: searchTerm } },
      { completed: false },
      { user: { department: 'Engineering' } }
    ]
  },
  include: { user: true, category: true }
});
```

**RawSqlClient Approach:**
```typescript
// Dynamic query with filters
const searchResults = await rawSqlClient.queryMany<TodoSearchResult>(
  'searchTodos.sql',
  {
    filter: {
      title: { ilike: `%${searchTerm}%` },
      completed: false,
      'user.department': 'Engineering'
    },
    sort: { created_at: { desc: true } },
    paging: { page: 1, pageSize: 20 }
  }
);
```

### Scenario 3: Analytics and Aggregations

**Prisma ORM Approach:**
```typescript
// Multiple queries needed for complex aggregations
const userStats = await prisma.user.findUnique({
  where: { id: userId },
  include: {
    _count: {
      select: {
        todos: true,
        comments: true
      }
    }
  }
});

const avgRating = await prisma.todo.aggregate({
  where: { userId },
  _avg: { rating: true }
});
```

**RawSqlClient Approach:**
```typescript
// Single complex query with all aggregations
const userAnalytics = await rawSqlClient.queryOne<UserAnalytics>(
  'getUserAnalytics.sql',
  { userId }
);
```

## 🔍 Exploring SQL Files

### Basic SQL Query Structure

```sql
-- rawsql-ts/getTodoDetail.sql
SELECT 
    -- Todo fields
    t.todo_id,
    t.title,
    t.description,
    t.completed,
    t.created_at,
    
    -- User fields (for nested object)
    u.user_id,
    u.user_name,
    u.email,
    
    -- Category fields (for nested object)
    c.category_id,
    c.category_name,
    c.color,
    
    -- Comment fields (for nested array)
    tc.comment_id,
    tc.comment_text,
    tc.created_at as comment_created_at,
    cu.user_name as comment_user_name

FROM todo t
INNER JOIN "user" u ON t.user_id = u.user_id
INNER JOIN category c ON t.category_id = c.category_id
LEFT JOIN todo_comment tc ON t.todo_id = tc.todo_id
LEFT JOIN "user" cu ON tc.user_id = cu.user_id
WHERE t.todo_id = $1
ORDER BY tc.created_at ASC
```

### JSON Mapping Configuration

```json
// rawsql-ts/getTodoDetail.json
{
  "rootEntity": {
    "columns": {
      "todoId": "todo_id",
      "title": "title",
      "description": "description",
      "completed": "completed",
      "createdAt": "created_at"
    }
  },
  "nestedEntities": [
    {
      "propertyName": "user",
      "relationshipType": "object",
      "columns": {
        "userId": "user_id",
        "userName": "user_name",
        "email": "email"
      }
    },
    {
      "propertyName": "category",
      "relationshipType": "object",
      "columns": {
        "categoryId": "category_id",
        "categoryName": "category_name",
        "color": "color"
      }
    },
    {
      "propertyName": "comments",
      "relationshipType": "array",
      "columns": {
        "commentId": "comment_id",
        "commentText": "comment_text",
        "createdAt": "comment_created_at",
        "userName": "comment_user_name"
      }
    }
  ]
}
```

## 🧪 Testing and Validation

### Static Analysis

```bash
# Validate all SQL files against Prisma schema
npm run test:sql-validation

# Example output:
## getTodoDetail.sql
- SQL Static Syntax Check: ✅ Passed
- SQL to JSON Query Convert Check: ✅ Passed  
- JSON to Model Structure Check: ✅ Passed

## searchTodos.sql
- SQL Static Syntax Check: ✅ Passed
- SQL to JSON Query Convert Check: ✅ Passed
- JSON to Model Structure Check: ✅ Passed
```

### Performance Testing

```bash
# Run performance comparison tests
npm run test:performance

# Compare query execution times
npm run benchmark:prisma-vs-rawsql
```

### Integration Testing

```bash
# Run full integration tests
npm run test:integration

# Test specific scenarios
npm run test:todo-scenarios
npm run test:user-scenarios
```

## 🎮 Interactive Exploration

### VS Code Integration

1. **Install recommended extensions:**
   - PostgreSQL (for SQL syntax highlighting)
   - Prisma (for schema support)

2. **Open SQL files directly:**
   - Browse `rawsql-ts/` folder
   - Edit SQL queries and see real-time validation
   - Test queries directly against the database

3. **Explore the database:**
   ```bash
   # Connect to database with VS Code PostgreSQL extension
   # Host: localhost
   # Port: 5432
   # Database: todo_demo
   # Username: demo_user
   # Password: demo_password
   ```

### Customizing the Demo

#### Add New Queries

1. **Create a new SQL file:**
   ```sql
   -- rawsql-ts/myCustomQuery.sql
   SELECT 
       u.user_name,
       COUNT(t.todo_id) as todo_count,
       AVG(CASE WHEN t.completed THEN 1 ELSE 0 END) as completion_rate
   FROM "user" u
   LEFT JOIN todo t ON u.user_id = t.user_id
   GROUP BY u.user_id, u.user_name
   HAVING COUNT(t.todo_id) > 0
   ORDER BY completion_rate DESC
   ```

2. **Create corresponding JSON mapping:**
   ```json
   {
     "rootEntity": {
       "columns": {
         "userName": "user_name",
         "todoCount": "todo_count", 
         "completionRate": "completion_rate"
       }
     }
   }
   ```

3. **Add TypeScript interface:**
   ```typescript
   interface UserStats {
     userName: string;
     todoCount: number;
     completionRate: number;
   }
   ```

4. **Test your query:**
   ```typescript
   const stats = await rawSqlClient.queryMany<UserStats>('myCustomQuery.sql');
   ```

#### Modify Sample Data

```bash
# Edit the seed file
code prisma/seed.ts

# Re-seed the database
npx prisma db seed
```

#### Add New Database Tables

1. **Modify Prisma schema:**
   ```prisma
   // prisma/schema.prisma
   model Tag {
     id     Int    @id @default(autoincrement())
     name   String @unique
     color  String?
     todos  TodoTag[]
   }

   model TodoTag {
     todoId Int
     tagId  Int
     todo   Todo @relation(fields: [todoId], references: [id])
     tag    Tag  @relation(fields: [tagId], references: [id])
     @@id([todoId, tagId])
   }
   ```

2. **Create migration:**
   ```bash
   npx prisma migrate dev --name add-tags
   ```

3. **Update seed data and create new queries!**

## 🔧 Troubleshooting

### Common Issues

**Database connection failed:**
```bash
# Check if PostgreSQL is running
docker-compose ps

# Restart PostgreSQL
docker-compose restart postgres
```

**Prisma client outdated:**
```bash
# Regenerate Prisma client
npx prisma generate
```

**SQL validation errors:**
```bash
# Check detailed error messages
npm run test:sql-validation -- --verbose

# Validate specific file
npm run validate-sql -- rawsql-ts/getTodoDetail.sql
```

### Getting Help

- **Check the logs:** All commands output detailed logs
- **Examine sample queries:** The `rawsql-ts/` folder contains working examples
- **Review test files:** The `tests/` folder shows usage patterns
- **Check the reports:** The `reports/` folder contains detailed analysis

## 📚 Learning Resources

### Next Steps

1. **Read the main documentation:** [Prisma Integration Guide](../../packages/prisma-integration/README.md)
2. **Explore usage guides:** [Usage Guides](../../docs/usage-guides/)
3. **Try advanced features:** JSON mapping, dynamic queries, static analysis
4. **Build your own queries:** Use this demo as a foundation

### Related Examples

- **[Todo API Demo](../todo-api-demo/)** - Complete REST API implementation
- **[Core Examples](../../packages/core/examples/)** - Raw SQL parsing examples

---

**Ready to explore?** Start with `npm run demo:comparison` and dive into the world of advanced SQL with TypeScript! 🚀