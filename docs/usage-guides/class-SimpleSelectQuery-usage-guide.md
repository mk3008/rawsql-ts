# SimpleSelectQuery Class Usage Guide

## Overview

The `SimpleSelectQuery` class represents a single, standard SQL SELECT query in the rawsql-ts library. It provides a rich API for building, transforming, and extending SELECT queries programmatically, making it easy to construct complex SQL statements, add conditions, joins, and more—all in a type-safe and composable way.

## Key Features

- Represents a single SELECT query (with support for WITH, WHERE, GROUP BY, HAVING, ORDER BY, LIMIT, OFFSET, FETCH, FOR, and WINDOW clauses)
- Can store and manage parameter values directly on the query object
- Methods for combining queries (UNION, INTERSECT, EXCEPT, and their ALL variants)
- Fluent API for appending WHERE/HAVING conditions, JOINs, and CTEs
- Supports both raw SQL strings and parsed query objects
- Integrates with other rawsql-ts utilities (e.g., parameter injection, formatting)

## Basic Usage

```typescript
import { SimpleSelectQuery, SelectQueryParser } from 'rawsql-ts';

// Parse a SQL string into a SimpleSelectQuery
const query = SelectQueryParser.parse('SELECT id, name FROM users WHERE active = true');

// Add a WHERE condition
query.appendWhereRaw("status = 'active'");

// Add a JOIN
query.innerJoinRaw('accounts', 'a', 'user_id');

// Combine with another query using UNION
const query2 = SelectQueryParser.parse('SELECT id, name FROM admins');
const unionQuery = query.toUnion(query2);
```

## API Reference

### Constructor

```
new SimpleSelectQuery(params: { ... })
```
- Accepts all standard SQL clauses as constructor parameters.

### Combining Queries

- `toUnion(rightQuery: SelectQuery): BinarySelectQuery`
- `toUnionAll(rightQuery: SelectQuery): BinarySelectQuery`
- `toIntersect(rightQuery: SelectQuery): BinarySelectQuery`
- `toIntersectAll(rightQuery: SelectQuery): BinarySelectQuery`
- `toExcept(rightQuery: SelectQuery): BinarySelectQuery`
- `toExceptAll(rightQuery: SelectQuery): BinarySelectQuery`

### Appending Conditions

- `appendWhereRaw(rawCondition: string): void`  
  Appends a raw SQL string as a WHERE condition (AND logic).
- `appendWhere(condition: ValueComponent): void`  
  Appends a ValueComponent as a WHERE condition.
- `appendHavingRaw(rawCondition: string): void`  
  Appends a raw SQL string as a HAVING condition.
- `appendHaving(condition: ValueComponent): void`  
  Appends a ValueComponent as a HAVING condition.
- `appendWhereExpr(columnName, exprBuilder, options?)`  
  Appends a WHERE condition for a specific column, optionally applying to upstream queries.

### Appending JOINs

- `innerJoinRaw(joinSourceRawText, alias, columns, resolver?)`
- `leftJoinRaw(joinSourceRawText, alias, columns, resolver?)`
- `rightJoinRaw(joinSourceRawText, alias, columns, resolver?)`
- `innerJoin(sourceExpr, columns, resolver?)`
- `leftJoin(sourceExpr, columns, resolver?)`
- `rightJoin(sourceExpr, columns, resolver?)`

### Appending CTEs (WITH clause)

- `appendWith(commonTable | commonTable[])`
- `appendWithRaw(rawText, alias)`


### Other Utilities

- `toSource(alias: string): SourceExpression`  
  Wraps the query as a subquery source with an alias (for use in joins, CTEs, etc).
- `overrideSelectItemExpr(columnName, fn)`  
  Override a select item using a callback that receives the original SQL expression.
- `setParameter(name, value)`  
  Set a parameter value by name in the query. See details below.

---


## Adding Conditions by Column Name: appendWhereExpr

The `appendWhereExpr` method lets you add WHERE conditions to a query by specifying only the column name, without worrying about the actual table, alias, or expression used in the SELECT clause. This is a powerful feature for writing generic, reusable query logic—especially when working with CTEs, subqueries, or complex expressions.

### Why is this important?

- **Abstraction:** You can target a column by name, regardless of its source (table, CTE, subquery, or even an expression/alias). You don't need to know the underlying table or how the column is defined.
- **Generic logic:** Enables writing functions or utilities that add conditions to queries in a generic way, making your code more reusable and maintainable.
- **Upstream injection:** With the `upstream` option, you can inject the condition into all upstream queries that define the column, not just the current query. This is super useful for optimizing CTEs and subqueries.
- **Safety:** If the column is ambiguous or missing, an error is thrown, so you always know your condition is being applied correctly.

### How it works (Code Insight)

`appendWhereExpr(columnName, exprBuilder, options?)` works by:
1. Collecting all expressions in the query (or upstream queries, if `upstream: true`) that match the given column name.
2. For each match, it generates the SQL string for the column/expression.
3. Passes that SQL string to your `exprBuilder` callback, which returns a WHERE condition string (e.g., `expr => `${expr} > 100``).
4. Appends the resulting condition to the WHERE clause (using AND logic).
5. Throws an error if the column is ambiguous or missing.

### Example

```typescript
import { SelectQueryParser } from 'rawsql-ts';

const query = SelectQueryParser.parse('SELECT id, salary * 1.1 AS adjusted_salary FROM employees');
// Add a condition to the adjusted_salary column, regardless of its source
query.appendWhereExpr('adjusted_salary', expr => `${expr} > 50000`);

// With upstream injection (e.g., for CTEs)
query.appendWhereExpr('id', expr => `${expr} > 1000`, { upstream: true });
```

### Error Handling

- Throws if the column is not found or is ambiguous (e.g., multiple columns with the same name).

### Best Practice

- Use this method to write generic query transformations, especially when you want to add conditions to columns that might be defined as expressions, aliases, or in upstream queries.

## Managing Parameters with setParameter

The `setParameter(name, value)` method allows you to assign values to named parameters directly on the query object. This is especially useful for portable query objects and function-based query generation, where you want to keep parameter values and query logic together.

### Why is this important?

- **Portability:** You can pass around query objects with their parameters already set, making it easy to reuse and compose queries in different parts of your application.
- **Separation of concerns:** Query generation and parameter assignment are decoupled. You don't have to worry about parameter values at the call site—just set them on the query and format/execute later.
- **Safety:** If you try to set a parameter that does not exist in the query, an error is thrown. This prevents silent mistakes and ensures that all parameters are valid and used in the SQL.

### Example

```typescript
import { SelectQueryParser } from 'rawsql-ts';

const query = SelectQueryParser.parse('SELECT * FROM users WHERE id = :id AND status = :status');
query.setParameter('id', 123);
query.setParameter('status', 'active');

// Later, format and execute
import { SqlFormatter } from 'rawsql-ts';
const { formattedSql, params } = new SqlFormatter().format(query);
// formattedSql: SELECT * FROM users WHERE id = :id AND status = :status
// params: { id: 123, status: 'active' }
```

### Error Handling

If you call `setParameter` with a name that does not match any parameter in the query, an error is thrown:

```typescript
query.setParameter('not_exist', 1); // Throws: Parameter 'not_exist' not found in query
```

This ensures that your parameter management is always safe and explicit.

## Practical Example

```typescript
import { SimpleSelectQuery, SelectQueryParser } from 'rawsql-ts';

const query = SelectQueryParser.parse('SELECT id, name FROM users');
query.appendWhereRaw('active = true');
query.leftJoinRaw('accounts', 'a', 'user_id');
query.appendWithRaw('(SELECT * FROM logs)', 'user_logs');

// Combine with another query
const adminQuery = SelectQueryParser.parse('SELECT id, name FROM admins');
const allUsers = query.toUnionAll(adminQuery);
```

## Best Practices

- Use `appendWhereExpr` to safely add conditions for specific columns, especially when working with CTEs or subqueries.
- Always provide an alias when using `toSource()` for subqueries or joins.
- Use the provided join methods to avoid manual SQL string manipulation and ensure type safety.
- Integrate with parameter injection and formatting utilities for safe, readable, and maintainable SQL generation.

## Error Handling

- Most methods throw errors if required clauses (like FROM) or columns are missing, or if duplicate column names are found.
- Always check for the existence of columns before overriding or appending conditions.

## See Also

- `SelectQueryParser` for parsing SQL strings into query objects
- `QueryBuilder` for advanced query transformations
- `SqlParamInjector` for parameter injection
- `SqlFormatter` for formatting queries
