# QueryBuilder Class Usage Guide

## Overview

The `QueryBuilder` class provides static utility methods for constructing, converting, and transforming SQL query AST objects. It is designed to help you programmatically build or adapt queries for advanced SQL generation, migration, or transformation scenarios.


## Why QueryBuilder Matters: Safe and Efficient Workflows for UPDATE, INSERT, and DELETE

QueryBuilder lets you represent all data modification operations—UPDATE, INSERT, and DELETE—as SELECT queries first. This makes it easy to preview, debug, and verify the impact of any change before running it.

In traditional SQL workflows, you often write a SELECT to check affected rows, then manually rewrite it as an UPDATE, INSERT, or DELETE. If you need to debug, you switch back and forth, which is error-prone and tedious.

With QueryBuilder, you keep your logic as a SELECT, inspect the results, and only generate the final data modification query when you are confident. This removes manual rewriting and greatly reduces the risk of mistakes.

This approach is valuable for anyone who wants safe, auditable, and efficient workflows for all types of data modification—without the hassle of switching between SELECT and DML statements. You always get the benefits of preview, debug, and safe transformation.

> **Best Practice:** Maintain and review only your SELECT query. All data modification queries (UPDATE, INSERT, DELETE) can be generated from this single source. This simplifies maintenance and reduces mistakes—just keep your SELECT up to date and let QueryBuilder handle the rest!

## Basic Usage

### 1. Combine Multiple Queries (UNION, INTERSECT, etc.)

```typescript
import { QueryBuilder, SelectQueryParser } from 'rawsql-ts';

const q1 = SelectQueryParser.parse('SELECT id FROM users');
const q2 = SelectQueryParser.parse('SELECT id FROM admins');
const unionQuery = QueryBuilder.buildBinaryQuery([q1, q2], 'union');
```


### 2. Convert to SimpleSelectQuery

The `buildSimpleQuery` function is designed to convert any supported `SelectQuery` (including union queries and values queries) into a `SimpleSelectQuery`—a single, standard SELECT query. If you pass a regular `SimpleSelectQuery`, it is returned as-is without modification.

This conversion is especially useful because many transformation and analysis tools in rawsql-ts are built to operate on `SimpleSelectQuery` objects. Union queries (such as those created with `UNION`, `INTERSECT`, or `EXCEPT`) can be complex, with multiple entry points and column dependencies that make direct processing cumbersome. By wrapping a union or values query as a subquery within a new `SimpleSelectQuery`, you get a single, unified query structure that is much easier to work with programmatically.

For example, after conversion, you can apply parameter injection, formatting, or further transformations without worrying about the intricacies of set operations or column alignment.

```typescript
const query = SelectQueryParser.parse('SELECT id FROM users UNION SELECT id FROM admins');
const simpleQuery = QueryBuilder.buildSimpleQuery(query);
// Now you can use simpleQuery with other tools that expect a SimpleSelectQuery
```

## Features

- Combine multiple queries with set operators (UNION, INTERSECT, EXCEPT, etc.)
- Convert any supported query type to a `SimpleSelectQuery`
- Convert VALUES queries to SELECT queries with column aliases
- Build CREATE TABLE ... AS SELECT ... queries
- Build INSERT INTO ... SELECT ... queries
- Build UPDATE ... FROM ... queries using a SELECT as the source

## API Reference

### `buildBinaryQuery(queries: SelectQuery[], operator: string): BinarySelectQuery`
Combine two or more queries using a set operator (e.g., 'union', 'intersect'). Throws if less than two queries are provided.

### `buildSimpleQuery(query: SelectQuery): SimpleSelectQuery`
Convert any supported query type (including BinarySelectQuery and ValuesQuery) to a `SimpleSelectQuery`.

### `buildCreateTableQuery(query: SelectQuery, tableName: string, isTemporary?: boolean): CreateTableQuery`
Generate a CREATE TABLE (or CREATE TEMPORARY TABLE) statement from a SELECT query.

### `buildInsertQuery(selectQuery: SimpleSelectQuery, tableName: string): InsertQuery`
Generate an INSERT INTO ... SELECT ... statement. Columns are inferred from the select list.

### `buildUpdateQuery(selectQuery: SimpleSelectQuery, selectSourceName: string, updateTableExprRaw: string, primaryKeys: string | string[]): UpdateQuery`
Generate an UPDATE ... FROM ... statement using a SELECT as the source. All columns to update and primary keys must be present in the select list.

## Error Handling

- Throws descriptive errors if required columns or aliases are missing, or if queries are not compatible for the requested transformation.
- When converting VALUES queries, column aliases must be provided and must match the number of columns.

## Practical Examples

### Creating a CREATE TABLE ... AS SELECT ... Query

```typescript
const selectQuery = SelectQueryParser.parse('SELECT id, name FROM users');
const createTableQuery = QueryBuilder.buildCreateTableQuery(selectQuery, 'new_table');
```

### Creating an INSERT INTO ... SELECT ... Query

```typescript
const selectQuery = SelectQueryParser.parse('SELECT id, name FROM users');
const insertQuery = QueryBuilder.buildInsertQuery(selectQuery, 'target_table');
```

### Creating an UPDATE ... FROM ... Query

```typescript
const selectQuery = SelectQueryParser.parse('SELECT id, name FROM users');
const updateQuery = QueryBuilder.buildUpdateQuery(selectQuery, 'src', 'users', 'id');
```

## Important Notes

- QueryBuilder only operates on AST objects (not raw SQL strings). Use `SelectQueryParser` to parse SQL first.
- When converting VALUES queries, you must provide column aliases.
- For UPDATE queries, all columns to update and all primary keys must be present in the select list.
- The output queries are compatible with other rawsql-ts tools (e.g., SqlFormatter).

## Performance Considerations

- All methods are synchronous and fast for typical query sizes.
- Extremely large or deeply nested queries may take longer to process, but the process is generally efficient.
