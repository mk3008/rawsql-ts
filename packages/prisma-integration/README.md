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
const profile = await client.queryOne('users/profile.sql', { filter: { userId: 123 } });
```

That's it! Your execution environment is now ready! 

Continue reading the following sections to explore advanced features like custom model mapping, offline validation, and structured result transformation.

## 🔧 TypeScript Integration

### Generic Type Usage

Use TypeScript generics to get full type safety for your query results:

```typescript
// Define your domain models
interface UserProfile {
  id: number;
  name: string;
  email: string;
  profile?: {
    title: string;
    bio: string;
  };
}

interface UserList {
  id: number;
  name: string;
  email: string;
  isActive: boolean;
}

// Type-safe query execution
const profile = await client.queryOne<UserProfile>('users/get-profile.sql', {
  filter: { id: 1 }
});
// profile is typed as UserProfile | null

const users = await client.queryMany<UserList>('users/list-active.sql', {
  filter: { isActive: true }
});
// users is typed as UserList[]

// With complex filtering
const searchResults = await client.queryMany<UserProfile>('users/search.sql', {
  filter: {
    name: { ilike: '%john%' },
    email: { ilike: '%@company.com' },
    'profile.title': { ilike: '%engineer%' }
  },
  sort: [{ column: 'name', direction: 'asc' }],
  limit: 10,
  offset: 0
});
```

### Parameter Type Safety

Ensure your parameters match expected types:

```typescript
// Define parameter interfaces for better type safety
interface UserSearchParams {
  filter?: {
    id?: number;
    name?: string | { ilike: string };
    email?: string | { ilike: string };
    isActive?: boolean;
  };
  sort?: Array<{ column: string; direction: 'asc' | 'desc' }>;
  limit?: number;
  offset?: number;
}

// Use typed parameters
const searchUsers = async (params: UserSearchParams): Promise<UserList[]> => {
  return client.queryMany<UserList>('users/search.sql', params);
};
```

## ⚙️ Configuration Options

### Complete RawSqlClient Configuration

```typescript
import { PrismaClient } from '@prisma/client';
import { RawSqlClient } from '@msugiura/rawsql-prisma';

const client = new RawSqlClient(prisma, {
  // SQL files directory path (default: './sql')
  sqlFilesPath: './sql',
  
  // Enable debug logging (default: false)
  debug: true,
  
  // Default schema name (default: undefined)
  defaultSchema: 'public',
  
  // Custom table name mappings (default: {})
  tableNameMappings: {
    'User': 'users',
    'UserProfile': 'user_profiles'
  },
  
  // Custom column name mappings (default: {})
  columnNameMappings: {
    'users': {
      'firstName': 'first_name',
      'lastName': 'last_name'
    }
  },
  
  // Custom path to schema.prisma file (default: auto-detect)
  schemaPath: './prisma/schema.prisma'
});
```

### Configuration Details

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `sqlFilesPath` | `string` | `'./sql'` | Base directory for SQL files (relative or absolute) |
| `debug` | `boolean` | `false` | Enable detailed logging for troubleshooting |
| `defaultSchema` | `string` | `undefined` | Default database schema name |
| `tableNameMappings` | `Record<string, string>` | `{}` | Map model names to table names |
| `columnNameMappings` | `Record<string, Record<string, string>>` | `{}` | Map column names per table |
| `schemaPath` | `string` | auto-detect | Custom path to schema.prisma file |

### Path Resolution

- **Relative paths**: Resolved from current working directory
- **Absolute paths**: Used as-is
- **Cross-platform**: Automatically handles Windows/Linux path separators
- **Normalization**: Redundant path segments are cleaned up

```typescript
// These all resolve to the same file
const variants = [
  'users/profile.sql',
  './users/profile.sql', 
  'users/./profile.sql',
  'users/../users/profile.sql'
];
```

### Debug Mode

Enable debug mode to get detailed information about:

```typescript
const client = new RawSqlClient(prisma, { debug: true });

// Debug output will show:
// - SQL file loading paths
// - JSON mapping file resolution
// - Query execution details  
// - Schema resolution process
// - Path normalization steps
```

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

## 📄 JSON Mapping Guide

### When JSON Mapping is Required vs Optional

JSON mapping files control how SQL query results are structured into TypeScript objects:

**JSON Mapping is REQUIRED when:**
- You need nested object structures (parent-child relationships)
- You want to group related columns into sub-objects
- You need to transform column names to different property names
- Your SQL query joins multiple tables and you want structured results

**JSON Mapping is OPTIONAL when:**
- You're returning simple flat data (scalar values)
- Column names in SQL match your TypeScript interface properties
- You only need the first column of each row (scalar fallback)

### Scalar Fallback Behavior

Without JSON mapping, queries return only the **first column** of each row:

```sql
-- sql/users/get-names.sql
SELECT name, email, created_at FROM users;
```

```typescript
// Without JSON mapping file
const result = await client.queryMany('users/get-names.sql');
// Result: ['John', 'Jane', 'Bob'] - only first column (name)

// With JSON mapping file (users/get-names.json)
const result = await client.queryMany('users/get-names.sql');
// Result: [{ name: 'John', email: 'john@...', createdAt: '...' }, ...]
```

### File Naming and Location Requirements

**Critical Requirements:**
- JSON mapping files must be in the **same directory** as the SQL file
- JSON mapping files must have the **exact same name** as the SQL file
- Use `.json` extension for mapping files

```
✅ CORRECT Structure:
sql/
├── users/
│   ├── profile.sql
│   └── profile.json          ← Same directory, same name
└── orders/
    ├── list.sql
    └── list.json

❌ INCORRECT - Subdirectory mapping (NOT SUPPORTED):
sql/
├── users/
│   ├── profile.sql
│   └── mappings/
│       └── profile.json      ← Different directory - won't work
```

### JSON Mapping Examples

**Simple Property Mapping:**
```json
{
  "rootEntity": {
    "id": "user",
    "name": "User",
    "columns": {
      "id": "user_id",
      "name": "user_name",
      "email": "user_email"
    }
  }
}
```

**Nested Object Structure:**
```json
{
  "rootEntity": {
    "id": "user",
    "name": "User",
    "columns": {
      "id": "user_id",
      "name": "user_name",
      "email": "user_email"
    }
  },
  "childEntities": [
    {
      "id": "profile",
      "name": "Profile",
      "parentId": "user",
      "propertyName": "profile",
      "relationshipType": "object",
      "columns": {
        "title": "profile_title",
        "bio": "profile_bio"
      }
    }
  ]
}
```

*[→ Learn more: Model-Driven JSON Mapping Guide](../../docs/usage-guides/model-driven-json-mapping-usage-guide.md)*

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
  filter: { userId: 123 }
});

// Get structured domain model, not flat database records
console.log(profile.name);           // Full TypeScript support
console.log(profile.profile.title);  // Nested object access
console.log(profile.posts[0].title); // Array access
```

*[→ Learn more: RawSqlClient Usage Guide](../../docs/usage-guides/class-RawSqlClient-usage-guide.md)*

## 🚨 Error Handling & Troubleshooting

### Common Error Types

RawSqlClient provides enhanced error messages with specific, actionable information:

```typescript
import { RawSqlClient, SqlFileNotFoundError, JsonMappingError, SqlExecutionError } from '@msugiura/rawsql-prisma';

try {
  const result = await client.queryOne('users/profile.sql', { 
    filter: { id: 1 } 
  });
} catch (error) {
  if (error instanceof SqlFileNotFoundError) {
    console.log('File not found:', error.filename);
    console.log('Searched in:', error.searchedPath);
    console.log('Suggestions:', error.message);
  } else if (error instanceof JsonMappingError) {
    console.log('JSON mapping issue:', error.message);
  } else if (error instanceof SqlExecutionError) {
    console.log('Query execution failed:', error.message);
  }
}
```

### Common Scenarios and Solutions

**1. SQL File Not Found**
```
❌ Error: SQL file not found: 'users/profile.sql'
```
**Solutions:**
- Check file exists at `./sql/users/profile.sql`
- Verify `sqlFilesPath` configuration
- Ensure `.sql` file extension
- Check directory structure matches

**2. JSON Mapping Issues**  
```
❌ Error: Invalid JSON mapping in users/profile.json
```
**Solutions:**
- Validate JSON syntax
- Ensure column names match SQL SELECT aliases
- Verify nested entity relationships are correct
- Check `importPath` points to valid TypeScript files

**3. Parameter Naming Issues**
```typescript
// ❌ Inconsistent parameter naming
await client.queryOne('users/search.sql', { filters: {...} });
await client.queryMany('users/list.sql', { filter: {...} });

// ✅ Consistent parameter naming
await client.queryOne('users/search.sql', { filter: {...} });
await client.queryMany('users/list.sql', { filter: {...} });
```

### Debug Mode Usage

Enable debug mode for detailed troubleshooting information:

```typescript
const client = new RawSqlClient(prisma, { 
  debug: true,  // Enable detailed logging
  sqlFilesPath: './sql' 
});

// Debug output shows:
// - SQL file loading paths and resolution
// - JSON mapping file search and parsing
// - Query parameter injection
// - Database query execution details
// - Schema resolution process
```

### Best Practices

**File Organization:**
- Keep SQL and JSON files in same directory
- Use consistent naming: `profile.sql` + `profile.json`
- Avoid subdirectories for JSON mapping files

**Parameter Usage:**
- Always use `filter` parameter (not `filters`)
- Use TypeScript interfaces to define parameter types
- Enable debug mode during development

**Error Prevention:**
- Test SQL queries manually first
- Validate JSON mapping syntax
- Use static analysis for early error detection

*[→ Learn more: Error Handling Guide](../../docs/usage-guides/error-handling-guide.md)*

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
  filter: { userId: 123 }
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

## ❓ Frequently Asked Questions

### Package and Installation

**Q: What's the correct package name to install?**
A: Use `npm install @msugiura/rawsql-prisma`. The package was renamed from `@rawsql-ts/prisma-integration`.

**Q: What are the peer dependency requirements?**
A: You need `@prisma/client` >= 4.0.0 and `prisma` >= 4.0.0.

### JSON Mapping and File Organization

**Q: When do I need JSON mapping files?**
A: JSON mapping is optional for simple queries returning flat data. It's required when you need nested objects, column name transformation, or structured results from joined tables.

**Q: What happens if I don't provide a JSON mapping file?**
A: The query returns only the first column of each row (scalar fallback behavior). This is useful for simple queries like getting a list of IDs or names.

**Q: Can I put JSON mapping files in subdirectories?**
A: No, JSON mapping files must be in the same directory as their corresponding SQL files. Subdirectory mapping is not supported.

**Q: Do column names in SQL need to match my TypeScript interface?**
A: Not if you use JSON mapping. The mapping file allows you to transform SQL column names (like `user_name`) to TypeScript properties (like `name`).

### TypeScript and Type Safety

**Q: How do I get full TypeScript support?**
A: Use generic methods: `client.queryOne<UserProfile>()` and `client.queryMany<UserList>()`. Define your interfaces and use them as type parameters.

**Q: Should I use `filter` or `filters` for parameters?**
A: Always use `filter` (singular). This is the consistent naming convention throughout the library.

### Error Handling and Debugging

**Q: How do I troubleshoot file not found errors?**
A: Enable debug mode (`debug: true`) to see detailed path resolution. Verify your `sqlFilesPath` configuration and ensure files exist at the expected locations.

**Q: Why am I getting "scalar fallback" instead of structured objects?**
A: This happens when JSON mapping files are missing. Add a `.json` file with the same name as your `.sql` file for structured results.

**Q: How do I handle different database providers?**
A: This library is currently **PostgreSQL only**. Support for other databases may be added in future versions.

### Migration and Best Practices

**Q: How do I migrate from the old package name?**
A: Uninstall the old package and install the new one:
```bash
npm uninstall @rawsql-ts/prisma-integration
npm install @msugiura/rawsql-prisma
```
Update your imports to use `@msugiura/rawsql-prisma`.

**Q: What are the recommended file organization patterns?**
A: Group SQL files by domain (users/, orders/, reports/), keep SQL and JSON files together, use descriptive names with verbs (get-profile.sql, list-active.sql).

**Q: How do I optimize performance?**
A: SQL files are cached after first load, JSON mappings are parsed once at startup, use database indexes for filtered columns, and consider pagination for large result sets.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

### Third-Party Dependencies

This library integrates with [Prisma](https://github.com/prisma/prisma), which is licensed under the Apache License 2.0. Please see [Prisma's license](https://github.com/prisma/prisma/blob/main/LICENSE) for more details.
