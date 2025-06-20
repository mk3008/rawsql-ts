# @msugiura/rawsql-prisma

![npm version](https://img.shields.io/npm/v/@msugiura/rawsql-prisma)
![npm downloads](https://img.shields.io/npm/dm/@msugiura/rawsql-prisma)
![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)

`@msugiura/rawsql-prisma` transforms raw SQL into structured TypeScript models automatically.Break free from Prisma model constraints and let SQL handle your DTO creation with comprehensive static validation.

**PostgreSQL Only** - This library is specifically designed for PostgreSQL databases.

## Key Features

- **Write Simple SQL** - Just write normal flat SQL queries, no complex structuring needed
- **Get Custom Models** - Return any TypeScript model structure, not limited to Prisma models
- **JSON Configuration** - Map SQL results to TypeScript models with simple JSON files  
- **Offline Validation** - Validate SQL syntax and schema without database connection
- **File Organization** - Organize SQL queries in maintainable, version-controlled files
- **One-Time Test Setup** - Single validation test covers all your SQL files automatically

## 🎯 Design Philosophy

**Focus on Read Operations**: Prisma excels at CUD (Create, Update, Delete) operations. This library specifically enhances the **R** (Read) capabilities, letting each tool do what it does best.

**Integration Testing Over Static Perfection**: Accurate type information exists only on the server, making integration tests more practical than perfect static type alignment.

**Schema Structure Matters Most**: However, column definitions are stable and structural validation provides real value—catching missing tables or columns where static analysis excels.

## Prerequisites

This library requires [Prisma](https://prisma.io) as a peer dependency. Prisma is licensed under the Apache License 2.0.

## Installation

```bash
npm install @msugiura/rawsql-prisma 
```

## 🚀 Getting Started 

Assuming you already have a Prisma project set up:

> **Don't have a Prisma project yet?** Check out our [complete demo environment](../../examples/prisma-comparison-demo/README.md) which includes a full setup with sample data.

### Step 1: Create SQL Folder

Create a folder to store your SQL files:

```bash
mkdir sql
```

### Step 2: Write Raw SQL Files

Create SQL files with your queries. Just write normal SQL - no special syntax needed.

Write simple SQL appropriate for your database schema:

```sql
-- sql/users/profile.sql (Example - adjust table/column names for your schema)
SELECT 
  u.id, u.name, u.email,
  p.title, p.bio
FROM users u
LEFT JOIN profiles p ON u.id = p.user_id
```

> **Note**: This is just a sample. Please write simple SQL queries that match your actual database schema and table names.

### Step 3: Execute with RawSqlClient

Now you can execute your SQL files with full TypeScript support:

```typescript
import { PrismaClient } from '@prisma/client';
import { RawSqlClient } from '@msugiura/rawsql-prisma';

const prisma = new PrismaClient();
const client = new RawSqlClient(prisma, {
    sqlFilesPath: './sql'  // Point to your SQL folder
});

// Execute SQL file and get result
const profile = await client.queryOne('users/profile.sql', { userId: 123 });
```

That's it! Your execution environment is now ready! 

Continue reading the following sections to explore advanced features like custom model mapping, offline validation, and structured result transformation.

## 📁 File-Based SQL Organization 

Organize your SQL queries in a clean, maintainable folder structure:

```
sql/
└── users/
   ├── profile.sql          # User profile query
   └── profile.json         # JSON mapping for nested structure
```

Benefits: Logical grouping, IDE support, version control friendly, and easy discovery.

*[→ Learn more: SQL File Organization Guide](../../docs/usage-guides/sql-file-organization-guide.md)*

## 🔄 Development Workflow

Three-step pattern for structured data handling:

### 1. Define Domain Models

Start by defining TypeScript interfaces that represent your **domain models** - not your database schema, but the structured data your application needs. This is about creating DTOs (Data Transfer Objects) that serve your business logic, which may aggregate data from multiple tables or transform database structures into application-friendly formats.

```typescript
// src/types/models.ts
// This is a DOMAIN MODEL - not a Prisma model!
// It represents how your application wants to consume user data,
// aggregating information from multiple database tables.
interface UserProfile {
  id: number;
  name: string;
  email: string;
  profile: {
    title: string;
    bio: string;
  };
  posts: Array<{
    id: number;
    title: string;
    content: string;
  }>;
}
```

### 2. Write Flat SQL Query

Create SQL queries that aggregate data from multiple tables to support your domain model. This eliminates the need for manual DTO mapping logic that you'd have to write and maintain when using Prisma's ORM approach:

```sql
-- sql/users/get-profile.sql
-- Aggregate data from multiple tables for domain model
SELECT 
  u.id as user_id, u.name, u.email,
  p.title as profile_title, p.bio as profile_bio,
  pt.id as post_id, pt.title as post_title, pt.content as post_content
FROM users u
LEFT JOIN profiles p ON u.id = p.user_id  
LEFT JOIN posts pt ON u.id = pt.author_id
-- No WHERE clause needed - library handles filtering automatically
```

### 3. Create JSON Mapping

Define how flat SQL results should be transformed into your domain structure:

```json
// sql/users/get-profile.json
{
  "rootName": "userProfile", 
  "typeInfo": {
    "interface": "UserProfile",
    "importPath": "src/types/models.ts"
  },
  "rootEntity": {
    "id": "user",
    "columns": { "id": "user_id", "name": "name", "email": "email" }
  },
  "nestedEntities": [
    {
      "id": "profile",
      "parentId": "user",
      "propertyName": "profile",
      "relationshipType": "object",
      "columns": { "title": "profile_title", "bio": "profile_bio" }
    },
    {
      "id": "posts",
      "parentId": "user", 
      "propertyName": "posts",
      "relationshipType": "array",
      "columns": { "id": "post_id", "title": "post_title", "content": "post_content" }
    }
  ]
}
```

### Result: Structured Domain Models

```typescript
const profile = await client.queryOne<UserProfile>('users/get-profile.sql', { 
  userId: 123 
});

// Get structured domain model, not flat database records
console.log(profile.name);           // Full TypeScript support
console.log(profile.profile.title);  // Nested object access
console.log(profile.posts[0].title); // Array access
```

*[→ Learn more: RawSqlClient Usage Guide](../../docs/usage-guides/class-RawSqlClient-usage-guide.md)*

---

## RawSqlClient Features

The `RawSqlClient` class provides a modern interface for executing SQL queries with Prisma. It bridges the gap between raw SQL power and TypeScript integration, offering both single-result and multi-result query methods with automatic parameter binding.

Key benefits include:
- **TypeScript Integration**: Generic methods (`queryOne<T>`, `queryMany<T>`) provide full TypeScript intellisense and compile-time checking.
- **Automatic Parameter Binding**: Built-in SQL injection protection with safe parameter substitution.
- **Flexible Result Handling**: Choose between single results or arrays based on your query expectations.
- **Minimal Configuration**: Works seamlessly with existing Prisma setups without additional schema definitions.
- **File-Based Organization**: SQL queries organized in files for better maintainability and version control.
- **Development-Friendly**: Clear error messages and validation warnings to help identify issues early.

```typescript
import { RawSqlClient } from '@msugiura/rawsql-prisma';

const client = new RawSqlClient(prisma, { sqlFilesPath: './sql' });

// Single result with TypeScript integration
const user = await client.queryOne<User>('users/get-profile.sql', { 
  userId: 123 
});

// Multiple results with filtering
const todos = await client.queryMany<Todo>('todos/search.sql', { 
  status: 'pending',
  priority: 'high'
});

// Results are automatically structured based on your generic parameter
console.log(user.name);        // TypeScript provides full intellisense
console.log(todos[0].title);   // Complete autocomplete support
```

*[→ Learn more: RawSqlClient Usage Guide](../../docs/usage-guides/class-RawSqlClient-usage-guide.md)*  
*[→ Learn more: Dynamic Query Building Guide](../../docs/usage-guides/dynamic-query-building-guide.md)*

## SqlSchemaValidator Features

The `SqlSchemaValidator` class catches SQL errors, missing tables, and column mismatches at development time—not in production. The static analysis engine validates your SQL queries against your Prisma schema without requiring a database connection, ensuring your queries are correct before deployment.

Key benefits include:
- **Static Syntax Validation**: Catches basic SQL syntax errors before runtime execution.
- **Schema Consistency Checking**: Validates table and column names against your Prisma schema definitions.
- **Schema Structure Validation**: Detects structural mismatches between SQL results and TypeScript interfaces.
- **JSON Mapping Validation**: Ensures mapping files structure matches your domain models correctly.
- **Offline Analysis**: No database connection required—perfect for CI/CD pipelines and development workflows.
- **Comprehensive Reporting**: Detailed validation reports with specific error locations and suggestions.

```typescript
import { runComprehensiveStaticAnalysis } from '@msugiura/rawsql-prisma';

// Run comprehensive validation in your tests
const report = await runComprehensiveStaticAnalysis({
  baseDir: __dirname,
  mappingDir: './sql',
  prismaClient,
  debug: false
});

// Display the detailed analysis report
console.log('\n# Static Analysis Results\n');
const summary = report.getConciseFileSummary!();
summary.forEach(line => console.log(line));

// Automatic error reporting
if (report.sqlAnalysis.invalidFiles > 0) {
  throw new Error(`Found ${report.sqlAnalysis.invalidFiles} SQL files with syntax errors`);
}

if (report.sqlAnalysis.invalidMappings > 0) {
  throw new Error(`Found ${report.sqlAnalysis.invalidMappings} JSON mapping files with errors`);
}

// Example validation output:
/*
## users/get-profile.sql
- SQL Static Syntax Check: ✅ Passed
- SQL to JSON Query Convert Check: ✅ Passed
- JSON to Model Structure Check: ✅ Passed

## todos/search.sql
- SQL Static Syntax Check: 🚨 Failed
- SQL to JSON Query Convert Check: ⚠️ No JSON Mapping
- JSON to Model Structure Check: ⏭️ Skipped (No JSON mapping file)

🚨 SQL Syntax Errors: Table 'todo_items' not found in schema. Please fix these SQL syntax issues to ensure proper query execution.
*/
```

## 🧪 Testing and Quality Assurance

### Static Analysis Testing

```typescript
// tests/sql-validation.test.ts
import { runComprehensiveStaticAnalysis } from '@msugiura/rawsql-prisma';

it('should validate all SQL files', async () => {
    const report = await runComprehensiveStaticAnalysis({
        baseDir: __dirname,
        mappingDir: './sql',
        prismaClient,
        debug: false
    });

    if (report.sqlAnalysis.invalidFiles > 0) {
        throw new Error(`Found ${report.sqlAnalysis.invalidFiles} SQL files with syntax errors`);
    }
});
```

### CI/CD Integration

```json
{
  "scripts": {
    "test:sql-validation": "vitest run tests/sql-validation.test.ts"
  }
}
```

## Examples and Resources 📚

### Demo Project
**[Complete Demo Environment](../../examples/prisma-comparison-demo/)** - Full working example with Prisma schema, SQL queries, and test suite.

### Documentation
- **[RawSqlClient Usage Guide](../../docs/usage-guides/class-RawSqlClient-usage-guide.md)** - Complete client reference
- **[Model-Driven JSON Mapping Guide](../../docs/usage-guides/model-driven-json-mapping-usage-guide.md)** - Modern mapping patterns and best practices
- **[SQL File Organization Guide](../../docs/usage-guides/sql-file-organization-guide.md)** - Best practices

---

Questions, feature requests, and bug reports are always welcome! 🎉

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

### Third-Party Dependencies

This library integrates with [Prisma](https://github.com/prisma/prisma), which is licensed under the Apache License 2.0. Please see [Prisma's license](https://github.com/prisma/prisma/blob/main/LICENSE) for more details.
