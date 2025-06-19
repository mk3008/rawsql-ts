# SQL File Organization Guide

This guide covers best practices for organizing your SQL files in a rawsql-ts project.

## Recommended Directory Structure

```
sql/
├── users/
│   ├── get-profile.sql
│   ├── get-profile.json
│   ├── search-users.sql
│   ├── search-users.json
│   └── list-active.sql
├── orders/
│   ├── get-details.sql
│   ├── get-details.json
│   ├── list-by-customer.sql
│   └── recent-orders.sql
├── reports/
│   ├── monthly-sales.sql
│   ├── user-engagement.sql
│   └── analytics/
│       ├── conversion-rates.sql
│       └── traffic-sources.sql
└── shared/
    ├── common-joins.sql
    └── utility-functions.sql
```

## Naming Conventions

### SQL Files
- Use **kebab-case** for file names: `get-user-profile.sql`
- Use **descriptive verbs**: `get-`, `list-`, `search-`, `count-`, `update-`
- Group related queries in subdirectories by domain/feature

### JSON Mapping Files
- Match the SQL file name exactly: `get-user-profile.json`
- Place in the same directory as the corresponding SQL file

## File Organization Patterns

### 1. Domain-Based Organization
```
sql/
├── authentication/     # User auth queries
├── billing/           # Payment and subscription queries
├── catalog/           # Product and inventory queries
├── orders/            # Order management queries
└── reporting/         # Analytics and reporting queries
```

### 2. Feature-Based Organization
```
sql/
├── user-management/
│   ├── authentication/
│   ├── profiles/
│   └── permissions/
├── e-commerce/
│   ├── products/
│   ├── orders/
│   └── payments/
└── analytics/
    ├── user-behavior/
    └── sales-metrics/
```

### 3. Layer-Based Organization
```
sql/
├── queries/           # Read-only SELECT queries
├── commands/          # Data modification queries
├── views/             # Reusable view definitions
└── procedures/        # Complex stored procedures
```

## Best Practices

### SQL File Guidelines
1. **Include comments** describing the query purpose
2. **Use consistent formatting** with proper indentation
3. **Parameterize all inputs** to prevent SQL injection
4. **Test queries independently** before adding JSON mappings

```sql
-- users/get-profile.sql
-- Retrieves complete user profile with related data
-- Parameters: userId (number)

SELECT 
    u.id,
    u.name,
    u.email,
    u.created_at,
    p.title as profile_title,
    p.bio as profile_bio,
    COUNT(posts.id) as post_count
FROM users u
LEFT JOIN profiles p ON u.id = p.user_id
LEFT JOIN posts ON u.id = posts.author_id
WHERE u.id = $1
  AND u.active = true
GROUP BY u.id, u.name, u.email, u.created_at, p.title, p.bio
```

### JSON Mapping Guidelines
1. **Start simple** with basic column mappings
2. **Add nested structures** only when needed
3. **Document complex mappings** with comments
4. **Validate mappings** against TypeScript interfaces

```json
{
  "_comment": "User profile with nested profile data and post count",
  "rootEntity": {
    "columns": {
      "id": "id",
      "name": "name", 
      "email": "email",
      "createdAt": "created_at",
      "postCount": "post_count"
    }
  },
  "nestedEntities": [
    {
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

## Configuration in RawSqlClient

```typescript
import { RawSqlClient } from '@rawsql-ts/prisma';

const client = new RawSqlClient(prisma, {
  sqlFilesPath: './sql',  // Base directory for all SQL files
  debug: true
});

// Execute using relative paths from sqlFilesPath
const userProfile = await client.queryOne('users/get-profile.sql', { userId: 123 });
const orders = await client.queryMany('orders/list-by-customer.sql', { customerId: 456 });
const report = await client.queryMany('reports/monthly-sales.sql', { month: '2024-01' });
```

## Integration with Development Tools

### VS Code Extensions
- **[PostgreSQL](https://marketplace.visualstudio.com/items?itemName=ms-ossdata.vscode-postgresql)** - Syntax highlighting and query execution
- **[SQL Tools](https://marketplace.visualstudio.com/items?itemName=mtxr.sqltools)** - Database connections and query runners

### Testing Integration
```typescript
// tests/sql-files.test.ts
import { describe, it } from 'vitest';
import { RawSqlClient } from '@rawsql-ts/prisma';
import { glob } from 'glob';

describe('SQL File Organization', () => {
  it('all SQL files should have valid syntax', async () => {
    const sqlFiles = await glob('./sql/**/*.sql');
    
    for (const file of sqlFiles) {
      // Validate each SQL file
      const content = await fs.readFile(file, 'utf-8');
      expect(content).toBeTruthy();
      expect(content).toMatch(/SELECT|INSERT|UPDATE|DELETE/i);
    }
  });
  
  it('JSON mappings should exist for complex queries', async () => {
    const sqlFiles = await glob('./sql/**/get-*.sql');
    
    for (const sqlFile of sqlFiles) {
      const jsonFile = sqlFile.replace('.sql', '.json');
      const jsonExists = await fs.pathExists(jsonFile);
      
      if (jsonExists) {
        const mapping = JSON.parse(await fs.readFile(jsonFile, 'utf-8'));
        expect(mapping.rootEntity).toBeDefined();
      }
    }
  });
});
```

## Migration from Existing Projects

### Step 1: Identify Query Patterns
```bash
# Find all raw SQL usage in your codebase
grep -r "SELECT\|INSERT\|UPDATE\|DELETE" src/ --include="*.ts" --include="*.js"
```

### Step 2: Extract SQL to Files
```typescript
// Before: Inline SQL
const users = await prisma.$queryRaw`
  SELECT u.*, p.title FROM users u 
  LEFT JOIN profiles p ON u.id = p.user_id 
  WHERE u.active = true
`;

// After: File-based SQL
const users = await client.queryMany('users/list-active.sql');
```

### Step 3: Add JSON Mappings
Create corresponding `.json` files for queries that need structured results.

### Step 4: Update Import Statements
```typescript
// Replace Prisma raw queries with RawSqlClient calls
import { RawSqlClient } from '@rawsql-ts/prisma';

const client = new RawSqlClient(prisma, { sqlFilesPath: './sql' });
```

## Performance Considerations

### File Loading
- SQL files are loaded and cached on first use
- JSON mappings are parsed once per application startup
- Use relative paths to minimize filesystem operations

### Directory Structure Impact
- Nested directories don't affect performance significantly
- Logical grouping improves maintainability more than performance
- Consider file count per directory (recommend < 50 files per folder)

## Troubleshooting

### Common Issues

**SQL file not found**
```
Error: SQL file 'users/invalid.sql' not found
```
- Check file path relative to `sqlFilesPath`
- Verify file extension is `.sql`
- Ensure proper case sensitivity

**JSON mapping errors**
```
Error: Invalid JSON mapping in users/get-profile.json
```
- Validate JSON syntax with a JSON validator
- Check that column names match SQL SELECT aliases
- Ensure nested entity relationships are properly defined

**Path resolution issues**
```typescript
// ❌ Absolute paths don't work
await client.query('/full/path/to/users/get-profile.sql');

// ✅ Use relative paths from sqlFilesPath
await client.query('users/get-profile.sql');
```

---

This organization approach scales well from small projects to enterprise applications, providing clear separation of concerns while maintaining excellent developer experience.
