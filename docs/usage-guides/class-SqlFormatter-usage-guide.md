# SqlFormatter Class Usage Guide

## Overview

The `SqlFormatter` class provides a unified interface for formatting SQL queries. It supports pretty-printing, parameter symbol customization, keyword case conversion, indentation, and more. This makes it easy to generate readable, consistent, and database-specific SQL output from your query models or parsed SQL objects.

## Basic Usage

### 1. Formatting a Query

```typescript
import { SqlFormatter, SelectQueryParser } from 'rawsql-ts';

const sql = 'SELECT id, name FROM users WHERE active = true';
const query = SelectQueryParser.parse(sql);

const formatter = new SqlFormatter();
const { formattedSql, params } = formatter.format(query);

console.log(formattedSql);
// Output: SELECT "id", "name" FROM "users" WHERE "active" = true
```

### 2. Formatting with Parameters

If your query contains parameters (e.g., injected by SqlParamInjector), `SqlFormatter` will extract and format them for you:

```typescript
import { SqlFormatter, SqlParamInjector } from 'rawsql-ts';

const sql = 'SELECT id, name FROM users WHERE active = true';
const state = { id: 42, name: 'Alice' };
const injectedQuery = new SqlParamInjector().inject(sql, state);

const formatter = new SqlFormatter();
const { formattedSql, params } = formatter.format(injectedQuery);

console.log(formattedSql);
// Output: SELECT "id", "name" FROM "users" WHERE "active" = true AND "id" = :id AND "name" = :name
console.log(params);
// Output: { id: 42, name: 'Alice' }
```

## Configuration Options

You can customize the output format using various options:

```typescript
const formatter = new SqlFormatter({
    preset: 'postgres', // 'mysql' | 'postgres' | 'sqlserver' | 'sqlite'
    parameterSymbol: ':', // or '?', '$', etc.
    parameterStyle: 'named', // 'named' | 'indexed' | 'anonymous'
    indentSize: 2, // Number of spaces for indentation
    indentChar: ' ', // Indentation character
    newline: '\n', // Newline character
    keywordCase: 'upper', // 'upper' | 'lower' | 'none'
    commaBreak: 'before', // 'before' | 'after' | 'none'
    andBreak: 'before', // 'before' | 'after' | 'none'
    withClauseStyle: 'cte-oneline', // 'standard' | 'cte-oneline' | 'full-oneline'
    exportComment: true, // Include comments in output
    strictCommentPlacement: false, // Only export clause-level comments
});
```

### Presets

Presets provide sensible defaults for different SQL dialects:
- `mysql`
- `postgres`
- `sqlserver`
- `sqlite`

Each preset sets identifier escaping, parameter symbols, and parameter style to match the target database.

## Advanced Features

### 1. Keyword Case Conversion

You can automatically convert SQL keywords to upper or lower case:

```typescript
const formatter = new SqlFormatter({ keywordCase: 'upper' });
// Output: SELECT "ID", "NAME" FROM "USERS"
```

### 2. Indentation and Line Breaks

Control indentation and line breaks for improved readability:

```typescript
const formatter = new SqlFormatter({
    indentSize: 4,
    indentChar: ' ',
    newline: '\n',
    commaBreak: 'before',
    andBreak: 'before',
});
```

### 3. Parameter Symbol and Style

Choose how parameters are represented in the output:
- `parameterSymbol`: e.g., `:`, `?`, `$`, `@`
- `parameterStyle`: `'named'`, `'indexed'`, `'anonymous'`

```typescript
const formatter = new SqlFormatter({ parameterSymbol: '?', parameterStyle: 'anonymous' });
```

### 4. WITH Clause Formatting

Control how Common Table Expressions (CTEs) are formatted:

```typescript
// Standard formatting (default)
const standardFormatter = new SqlFormatter({ withClauseStyle: 'standard' });
// Output:
// with
//   "user_summary" as (
//     select
//       "id", "name"
//     from
//       "users"
//   )
// select * from "user_summary"

// Individual CTEs as one-liners
const cteOnelineFormatter = new SqlFormatter({ withClauseStyle: 'cte-oneline' });
// Output:
// with
//   "user_summary" as (select "id", "name" from "users")
// select * from "user_summary"

// Entire WITH clause as continuous block
const fullOnelineFormatter = new SqlFormatter({ withClauseStyle: 'full-oneline' });
// Output:
// with "user_summary" as (
//   select
//     "id", "name"
//   from
//     "users"
// ) select * from "user_summary"
```

### 5. Comment Handling

Control how SQL comments are handled in the output:

```typescript
const formatter = new SqlFormatter({
    exportComment: true, // Include comments in output
    strictCommentPlacement: false, // Include all comments, not just clause-level
});

// With exportComment: true, comments are preserved
// With strictCommentPlacement: true, only clause-level comments are exported
```

## Error Handling

- If you specify an invalid preset, the constructor will throw an error.
- If the input query is not a valid SQL model, formatting may fail.

## Practical Examples

### Pretty-Printing for Readability

```typescript
const sql = `SELECT id, name, created_at FROM users WHERE active = true AND created_at > :date`;
const query = SelectQueryParser.parse(sql);
const formatter = new SqlFormatter({
    indentSize: 2,
    keywordCase: 'lower',
    commaBreak: 'before',
    andBreak: 'before',
});
console.log(formatter.format(query).formattedSql);
```

### Database-Specific Output

```typescript
const sql = 'SELECT id, name FROM users WHERE id = ?';
const query = SelectQueryParser.parse(sql);
const formatter = new SqlFormatter({ preset: 'mysql', parameterSymbol: '?' });
console.log(formatter.format(query).formattedSql);
```

### Complex Queries with CTEs

```typescript
const complexSql = `
WITH active_users AS (
    SELECT id, name, email FROM users WHERE active = true
),
user_orders AS (
    SELECT user_id, COUNT(*) as order_count 
    FROM orders 
    GROUP BY user_id
)
SELECT u.id, u.name, u.email, o.order_count
FROM active_users u
LEFT JOIN user_orders o ON u.id = o.user_id
ORDER BY o.order_count DESC;
`;

const query = SelectQueryParser.parse(complexSql);

// Standard formatting
const standardFormatter = new SqlFormatter({
    indentSize: 2,
    keywordCase: 'upper',
    withClauseStyle: 'standard'
});
console.log('Standard formatting:');
console.log(standardFormatter.format(query).formattedSql);

// CTE oneline formatting
const cteOnelineFormatter = new SqlFormatter({
    indentSize: 2,
    keywordCase: 'upper',
    withClauseStyle: 'cte-oneline'
});
console.log('\nCTE oneline formatting:');
console.log(cteOnelineFormatter.format(query).formattedSql);

// Full oneline formatting
const fullOnelineFormatter = new SqlFormatter({
    indentSize: 2,
    keywordCase: 'upper',
    withClauseStyle: 'full-oneline'
});
console.log('\nFull oneline formatting:');
console.log(fullOnelineFormatter.format(query).formattedSql);
```

### Working with Comments

```typescript
const sqlWithComments = `
-- User summary query
WITH user_summary AS (
    -- Get active users with their basic info
    SELECT id, name, email 
    FROM users 
    WHERE active = true
)
SELECT * FROM user_summary;
`;

const query = SelectQueryParser.parse(sqlWithComments);

// Include comments in output
const formatterWithComments = new SqlFormatter({
    exportComment: true,
    withClauseStyle: 'cte-oneline',
    keywordCase: 'upper'
});

const { formattedSql } = formatterWithComments.format(query);
console.log(formattedSql);
// Output includes comments in the formatted SQL
```

## Configuration Reference

### Complete Options List

```typescript
interface SqlFormatterOptions {
    // Database presets
    preset?: 'mysql' | 'postgres' | 'sqlserver' | 'sqlite';
    
    // Database-specific settings
    identifierEscape?: { start: string; end: string };
    parameterSymbol?: string | { start: string; end: string };
    parameterStyle?: 'anonymous' | 'indexed' | 'named';
    
    // Formatting settings
    indentSize?: number;                    // Default: 0
    indentChar?: string;                    // Default: ''
    newline?: string;                       // Default: ' '
    keywordCase?: 'none' | 'upper' | 'lower'; // Default: 'none'
    
    // Line break settings
    commaBreak?: 'none' | 'before' | 'after'; // Default: 'none'
    andBreak?: 'none' | 'before' | 'after';   // Default: 'none'
    
    // WITH clause formatting
    withClauseStyle?: 'standard' | 'cte-oneline' | 'full-oneline'; // Default: 'standard'
    
    // Comment handling
    exportComment?: boolean;                // Default: false
    strictCommentPlacement?: boolean;       // Default: false
}
```

### WITH Clause Style Guide

| Style | Description | Use Case |
|-------|-------------|----------|
| `'standard'` | Normal formatting with proper indentation | General use, development |
| `'cte-oneline'` | Individual CTEs compressed to single lines | Compact output while maintaining structure |
| `'full-oneline'` | Entire WITH clause as continuous block | Maximum compactness |

## Important Notes

- The formatter does not validate SQL semantics; it only formats the given query model.
- Parameter extraction works best with queries generated or transformed by rawsql-ts tools.
- For best results, use with queries parsed by `SelectQueryParser` or injected by `SqlParamInjector`.
- The `withClauseStyle` option only affects WITH clauses containing CTEs; regular queries are unaffected.
- Comment handling requires `exportComment: true` to include comments in the output.

## Performance Considerations

- Formatting is fast and suitable for both development and production use.
- Extremely large or deeply nested queries may take longer to format, but the process is generally efficient.
- The `full-oneline` WITH clause style may improve performance for queries with many CTEs by reducing output size.

## Migration from Legacy Options

If you were using the deprecated `cteOneline` property:

```typescript
// Legacy (deprecated)
const formatter = new SqlFormatter({ cteOneline: true });

// New approach
const formatter = new SqlFormatter({ withClauseStyle: 'cte-oneline' });
```

The `withClauseStyle` option provides more flexibility and clearer semantics for WITH clause formatting.
