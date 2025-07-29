# TypeScript Development Rules

This document defines the standard development rules for the rawsql-ts project.

## Core Principles

### Development Process
- **Test-First Development (TDD) is mandatory**
  - Always write tests before implementing business logic
  - Follow the Red-Green-Refactor cycle
  - See `testing-standards.md` for details

### Type Safety Enforcement
- **Type definitions are mandatory for all code**
- Use of `any` type is prohibited in principle (use `// @ts-ignore` with reason comments only when unavoidable)
- Use `unknown` type and narrow safely with type guards

### File Size Limits
- **Recommended: Under 500 lines**
- **Maximum: 1000 lines** (excluding comments)
- Split files by responsibility when exceeding the limit

### Error Handling Principles
- **No fallback unless explicitly instructed**
- Errors should be properly propagated and handled by callers
- Avoid automatic fallback to default values

### Module Loading Rules
- **Dynamic imports (`await import()`) are prohibited**
- **Reason**: This project targets Node.js environments, and dynamic imports may hinder build-time optimizations
- All modules must use static imports (`import ... from`)
- For conditional module loading, import all modules upfront and select at runtime

## Coding Conventions

### Naming Rules
```typescript
// Interface: PascalCase without prefix
interface User {
  id: string;
  name: string;
}

// Type alias: PascalCase
type UserId = string;
type QueryResult = Record<string, unknown>;

// Class: PascalCase
class UserService {
  // Private members: underscore prefix
  private _users: User[] = [];
  
  // Public methods: camelCase
  public getUser(id: UserId): User | undefined {
    return this._users.find(u => u.id === id);
  }
}

// Function: camelCase
function calculateTotal(items: Item[]): number {
  return items.reduce((sum, item) => sum + item.price, 0);
}

// Constants: UPPER_SNAKE_CASE
const MAX_RETRY_COUNT = 3;
const DEFAULT_TIMEOUT_MS = 5000;

// Enum: PascalCase (values in UPPER_SNAKE_CASE)
enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  ERROR = 'ERROR'
}
```

### Import Order
```typescript
// 1. Node.js built-in modules
import fs from 'fs';
import path from 'path';

// 2. External libraries
import { describe, it, expect } from 'vitest';

// 3. Internal modules (relative paths)
import { SelectQueryParser } from '../parsers/SelectQueryParser';
import { SqlFormatter } from '../transformers/SqlFormatter';

// 4. Relative paths (same directory)
import { formatDate } from './utils';
import type { LocalConfig } from './types';
```

### Documentation

#### JSDoc Comments (Recommended)
Write JSDoc comments for 80% or more of public classes, functions, and interfaces:

```typescript
/**
 * Parser class that analyzes SQL strings and converts them to AST
 * @example
 * ```typescript
 * const parser = new SelectQueryParser();
 * const query = parser.parse('SELECT * FROM users');
 * console.log(query.tableList); // ['users']
 * ```
 */
export class SelectQueryParser {
  /**
   * Parses SQL string and converts it to SelectQuery object
   * @param sql - SQL string to parse
   * @returns Parsed query object
   * @throws {ParseError} When SQL syntax is invalid
   * @example
   * ```typescript
   * const query = SelectQueryParser.parse('SELECT id, name FROM users');
   * console.log(query.selectClause.items); // [SelectItem, SelectItem]
   * ```
   */
  public static parse(sql: string): SelectQuery {
    // Implementation
  }
}

/**
 * Utility function to format dates
 * @param date - Date to format
 * @param format - Format string (e.g., 'YYYY-MM-DD')
 * @returns Formatted date string
 * @example
 * ```typescript
 * const formatted = formatDate(new Date(), 'YYYY-MM-DD');
 * console.log(formatted); // '2023-01-15'
 * ```
 */
export function formatDate(date: Date, format: string): string {
  // Implementation
}

/**
 * Interface representing SQL query execution result
 * @interface QueryResult
 */
export interface QueryResult {
  /** Executed SQL string */
  sql: string;
  /** Result row data */
  rows: unknown[];
  /** Execution time in milliseconds */
  executionTime: number;
}
```

#### JSDoc Tag Usage Guidelines
- `@param` - Parameter description
- `@returns` - Return value description
- `@throws` - Possible exceptions
- `@example` - Usage examples (required)
- `@deprecated` - When deprecated
- `@since` - Version when added
- `@see` - Related references

### Type Definition Best Practices

#### 1. Interface vs Type Alias
```typescript
// ✅ Use interfaces for object shape definitions
interface SelectClause {
  items: SelectItem[];
  distinct?: boolean;
}

// ✅ Use type aliases for union types, intersection types, and primitive type aliases
type JoinType = 'INNER' | 'LEFT' | 'RIGHT' | 'FULL';
type NodeId = string | number;
type ExtendedQuery = SelectQuery & { metadata: QueryMetadata };
```

#### 2. Utilizing Readonly Modifiers
```typescript
// ✅ Ensure immutability
interface FormatterOptions {
  readonly indentSize: number;
  readonly keywordCase: 'upper' | 'lower';
}

// ✅ Use ReadonlyArray
function processColumns(columns: ReadonlyArray<ColumnReference>): void {
  // columns.push() will cause compile error
}
```

#### 3. Strict Typing
```typescript
// ❌ Avoid: Ambiguous types
function processQuery(data: any): void { }

// ✅ Recommended: Strict typing
function processQuery(data: unknown): void {
  if (isSelectQuery(data)) {
    // Process safely with type checking
  }
}

// Type guard function
function isSelectQuery(data: unknown): data is SelectQuery {
  return (
    typeof data === 'object' &&
    data !== null &&
    'selectClause' in data &&
    'fromClause' in data
  );
}
```

## Architecture Rules

### Layer Separation
```typescript
// ✅ Models layer (data structures) - no external dependencies
// src/models/SelectQuery.ts
export interface SelectQuery {
  selectClause: SelectClause;
  fromClause?: FromClause;
  whereClause?: WhereClause;
}

// src/models/Clause.ts
export class SelectClause {
  constructor(public readonly items: SelectItem[]) {}
  
  public getColumnNames(): string[] {
    // Business logic
  }
}

// ✅ Parsers layer (parsing logic)
// src/parsers/SelectQueryParser.ts
export class SelectQueryParser {
  public static parse(sql: string): SelectQuery {
    // Parse logic
  }
}

// ✅ Transformers layer (transformation logic)
// src/transformers/SqlFormatter.ts
export class SqlFormatter {
  public format(query: SelectQuery): FormattedResult {
    // Format logic
  }
}
```

### Dependency Direction
- Models layer does not depend on other layers
- Parsers and Transformers layers depend on Models layer
- Circular dependencies must be absolutely avoided

## rawsql-ts Specific Patterns

### SQL Processing Standardization (Required)
```typescript
// ✅ Correct implementation
import { 
  SelectQueryParser, 
  SqlFormatter,
  SelectQuery,
  FormatterOptions
} from '../index';

// SQL analysis implementation example
export function analyzeQuery(sql: string) {
  const query = SelectQueryParser.parse(sql);
  return {
    tables: query.fromClause?.getTableNames() || [],
    columns: query.selectClause?.getColumnNames() || [],
    hasWhere: !!query.whereClause
  };
}

// SQL formatting implementation example
export function formatQuery(
  query: SelectQuery, 
  options: FormatterOptions = {}
): string {
  const formatter = new SqlFormatter(options);
  return formatter.format(query).formattedSql;
}

// ❌ Prohibited implementation: SQL parsing with regex
export function analyzeQueryBad(sql: string) {
  const tableMatch = sql.match(/FROM\s+(\w+)/i);
  const columnMatch = sql.match(/SELECT\s+(.+?)\s+FROM/i);
  // Custom parser implementation is prohibited
}

// ❌ Prohibited implementation: SQL construction with string concatenation
export function buildQueryBad(columns: string[], table: string): string {
  return `SELECT ${columns.join(', ')} FROM ${table}`;  // Prohibited
}
```

### AST Operation Patterns
```typescript
// ✅ AST-based operations are recommended
export class QueryTransformer {
  public addWhereCondition(query: SelectQuery, condition: WhereCondition): SelectQuery {
    const newWhereClause = query.whereClause
      ? new WhereClause([query.whereClause.condition, 'AND', condition])
      : new WhereClause([condition]);
      
    return {
      ...query,
      whereClause: newWhereClause
    };
  }
}

// ❌ Avoid string operations
export class BadQueryTransformer {
  public addWhereCondition(sql: string, condition: string): string {
    return sql + ' AND ' + condition;  // Dangerous
  }
}
```

## Performance Considerations

### Efficient Parser Usage
```typescript
// ✅ Reuse parser instances
const parser = new SelectQueryParser();
const queries = sqlStrings.map(sql => parser.parse(sql));

// ❌ Create new instance every time
const queries = sqlStrings.map(sql => new SelectQueryParser().parse(sql));
```

### Utilizing Memoization
```typescript
// Memoization for complex transformation processes
const memoizedTransform = memoize((query: SelectQuery) => {
  return expensiveTransformation(query);
});
```

## Prohibited Practices

### Patterns That Must Never Be Used
```typescript
// ❌ Using eval()
eval('console.log("dangerous")');

// ❌ Function() constructor
new Function('return true');

// ❌ Overuse of any type
let data: any = parseQuery();

// ❌ Overuse of type assertions
const query = {} as SelectQuery;  // Dangerous

// ❌ Overuse of @ts-ignore
// @ts-ignore
const result = dangerousOperation();

// ❌ Overuse of ! (non-null assertion)
const value = possiblyNull!;  // Dangerous

// ❌ SQL parsing with regex
const tables = sql.match(/FROM\s+(\w+)/gi);  // Prohibited
```

### Recommended Alternatives
```typescript
// ✅ Use type guards
if (isSelectQuery(data)) {
  // Use safely
}

// ✅ Proper type definitions
const query: Partial<SelectQuery> = {};

// ✅ Null checking
if (possiblyNull !== null) {
  const value = possiblyNull;
}

// ✅ Structured SQL parsing
const query = SelectQueryParser.parse(sql);
const tables = query.fromClause?.getTableNames() || [];
```

## Error Handling

### Custom Error Class Definitions
```typescript
// SQL parsing error
export class ParseError extends Error {
  constructor(
    message: string,
    public readonly sql: string,
    public readonly position?: number
  ) {
    super(message);
    this.name = 'ParseError';
  }
}

// Format error
export class FormatError extends Error {
  constructor(
    message: string,
    public readonly query: SelectQuery,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'FormatError';
  }
}

// Error handling example
export function safeParseQuery(sql: string): SelectQuery | null {
  try {
    return SelectQueryParser.parse(sql);
  } catch (error) {
    if (error instanceof ParseError) {
      console.warn(`Parse error at position ${error.position}: ${error.message}`);
      return null;
    }
    
    // Unexpected error
    console.error('Unexpected parse error', error);
    throw error;
  }
}
```

### Asynchronous Processing
```typescript
// ✅ Use async/await
async function processQuery(sql: string): Promise<QueryResult> {
  const query = SelectQueryParser.parse(sql);
  const formatted = await formatQuery(query);
  return { query, formatted };
}

// ❌ Avoid Promise chains
function processQuery(sql: string): Promise<QueryResult> {
  return Promise.resolve(SelectQueryParser.parse(sql))
    .then(query => formatQuery(query))
    .then(formatted => ({ query, formatted }));
}
```
