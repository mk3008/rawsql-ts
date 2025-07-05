# SelectQueryParser Class Usage Guide

## Overview

The `SelectQueryParser` class is responsible for parsing SQL SELECT statements (including CTEs, subqueries, and set operations) into an abstract syntax tree (AST) representation. This enables advanced SQL analysis, transformation, and code generation in TypeScript projects.

## Basic Usage

### 1. Parse a SQL String to AST

```typescript
import { SelectQueryParser } from 'rawsql-ts';

const sql = 'SELECT id, name FROM users WHERE active = true';
const ast = SelectQueryParser.parse(sql);

console.log(ast);
// Output: AST object representing the parsed SELECT query
```

### 2. Asynchronous Parsing

If you want to use async/await or need future extensibility, you can use the async version:

```typescript
const sql = 'SELECT id, name FROM users WHERE active = true';
const ast = await SelectQueryParser.parseAsync(sql);
```

## Features

- Supports standard SELECT queries, CTEs (WITH), subqueries, set operations (UNION, INTERSECT, EXCEPT), and VALUES queries.
- Returns a strongly-typed AST for further analysis or transformation.
- Throws detailed errors for invalid or incomplete SQL input.

## API Reference

### `parse(query: string): SelectQuery`
Synchronously parses a SQL string and returns a `SelectQuery` AST object. Throws an error if the SQL is invalid or incomplete.

### `parseAsync(query: string): Promise<SelectQuery>`
Asynchronously parses a SQL string and returns a `Promise<SelectQuery>`. Useful for future extensibility or integration with async workflows.

## Error Handling

- If the SQL is incomplete or contains unexpected tokens, a descriptive error is thrown with the position and reason.
- If the query does not start with SELECT, WITH, or VALUES, an error is thrown.

## Practical Examples

### Parsing a Query with CTE

```typescript
const sql = `WITH cte AS (SELECT id FROM users) SELECT * FROM cte WHERE id > 10`;
const ast = SelectQueryParser.parse(sql);
console.log(ast);
```

### Parsing a Query with UNION

```typescript
const sql = `SELECT id FROM users WHERE active = true UNION SELECT id FROM admins`;
const ast = SelectQueryParser.parse(sql);
console.log(ast);
```

### Parsing a VALUES Query

```typescript
const sql = `VALUES (1, 'Alice'), (2, 'Bob')`;
const ast = SelectQueryParser.parse(sql);
console.log(ast);
```


## Important Notes

- The parser only supports SELECT-family queries (SELECT, WITH, VALUES, UNION, etc.).
- SQL comments (both single-line `--` and block `/* ... */`) are parsed and preserved in the AST, but are not exported by default. Use `SqlFormatter` with `exportComment: true` to include comments in formatted output.
- The output AST is compatible with other rawsql-ts tools (e.g., SqlParamInjector, SqlFormatter).
- The parser does not validate table existence or column types; it only parses SQL syntax.

## Performance Considerations

- Parsing is fast and suitable for both development and production use.
- Extremely large or deeply nested queries may take longer to parse, but the process is generally efficient.
