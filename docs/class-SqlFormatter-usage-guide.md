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

## Important Notes

- The formatter does not validate SQL semantics; it only formats the given query model.
- Parameter extraction works best with queries generated or transformed by rawsql-ts tools.
- For best results, use with queries parsed by `SelectQueryParser` or injected by `SqlParamInjector`.

## Performance Considerations

- Formatting is fast and suitable for both development and production use.
- Extremely large or deeply nested queries may take longer to format, but the process is generally efficient.
