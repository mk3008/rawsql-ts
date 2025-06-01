# SQL Unit Testing Guide for AI Maintenance

## Overview

This guide provides instructions for creating unit tests for SQL generation logic in rawsql-ts. These tests ensure safety and reliability for AI-assisted maintenance by validating SQL transformations without database execution.

## Why RawSQL Safety Testing is Critical

### The Problem
RawSQL development carries significant risks:
- **SQL Injection vulnerabilities** from improper parameter handling
- **Schema mismatches** between code and database
- **Runtime failures** when SQL errors only surface in production
- **Complex debugging** when SQL generation fails silently

### The Solution: 3-Phase Testing
Complete static validation without database execution:

1. **Schema Validation**: `SqlSchemaValidator.validate()` - Ensures all tables/columns exist
2. **Parameter Injection**: Test `SqlParamInjector` - Validates WHERE clause safety
3. **JSON Transformation**: Test `PostgresJsonQueryBuilder` - Verifies complex transformations

### Benefits
- **Left-Shift Testing**: Catch errors before database execution
- **Fast Execution**: No database required for testing
- **Complete Safety**: Full SQL validation coverage
- **AI-Ready**: Automated validation for AI maintenance

## Core Testing Principles

### 1. Test Each Transformation Separately
Create dedicated methods for each SQL transformation phase:

```typescript
// Base SQL
getBaseSqlForFindById(): string

// Phase 1: Parameter injection
injectSearchConditionsForFindById(id: string): SimpleSelectQuery

// Phase 2: JSON transformation  
applyJsonTransformationsForFindById(baseQuery: SimpleSelectQuery): SimpleSelectQuery
```

### 2. Always Compare Complete SQL Text
Never test SQL fragments - always validate the entire generated SQL:

```typescript
expect(actualQuery.toDebugSql(debugConfig)).toBe(expectedSql);
```

### 3. Use Consistent Formatting
Use standardized debug configuration for all SQL comparisons:

```typescript
const debugConfig = {
  sqlDialect: "postgres" as const,
  printOptions: {
    indent: "  ",
    upperCase: false,
    linesBetweenQueries: 1,
  },
};
```

## Test File Template

```typescript
/**
 * Tests for [ClassName] SQL generation methods
 * 
 * This test suite validates the complete SQL generation pipeline for [method name]:
 * - Phase 0: Schema validation using SqlSchemaValidator
 * - Phase 1: Search condition injection via SqlParamInjector
 * - Phase 2: JSON transformation via PostgresJsonQueryBuilder
 */

import { describe, it, expect, beforeEach } from "vitest";
import { SqlSchemaValidator } from "../../../../../../src";
import { ClassName } from "../infrastructure/class-name";
import { createTableColumnResolver } from "../test-utils/table-column-resolver";

describe("ClassName SQL Generation Tests", () => {
  let repository: ClassName;
  let tableColumnResolver: any;

  beforeEach(() => {
    repository = new ClassName();
    tableColumnResolver = createTableColumnResolver();
  });

  const debugConfig = {
    sqlDialect: "postgres" as const,
    printOptions: {
      indent: "  ",
      upperCase: false,
      linesBetweenQueries: 1,
    },
  };

  describe("methodName SQL generation", () => {
    it("Phase 0: validates base SQL schema consistency", () => {
      const baseSql = repository.getBaseSqlForMethodName();
      expect(() => {
        SqlSchemaValidator.validate(baseSql, tableColumnResolver);
      }).not.toThrow();
    });

    it("Phase 1: injects search conditions safely", () => {
      const query = repository.injectSearchConditionsForMethodName("test-id");
      const actualSql = query.toDebugSql(debugConfig);
      
      const expectedSql = `
select
  base_column
from
  base_table
where
  id = $1
      `.trim();

      expect(actualSql).toBe(expectedSql);
    });

    it("Phase 2: applies JSON transformations correctly", () => {
      const baseQuery = repository.injectSearchConditionsForMethodName("test-id");
      const jsonQuery = repository.applyJsonTransformationsForMethodName(baseQuery);
      const actualSql = jsonQuery.toDebugSql(debugConfig);
      
      const expectedSql = `
select
  json_build_object('id', base_table.id, 'data', base_table.data) as result
from
  base_table
where
  id = $1
      `.trim();

      expect(actualSql).toBe(expectedSql);
    });
  });
});
```

## Testing Strategies

### Fixed Search Conditions
For methods with fixed WHERE clauses:

```typescript
it("generates correct WHERE clause", () => {
  const query = repository.methodName();
  const sql = query.toDebugSql(debugConfig);
  expect(sql).toContain("where\n  status = $1");
});
```

### Optional Search Conditions
For methods with conditional WHERE clauses:

```typescript
it("handles empty conditions", () => {
  const query = repository.search({});
  expect(query.toDebugSql(debugConfig)).not.toContain("where");
});

it("handles single condition", () => {
  const query = repository.search({ name: "test" });
  expect(query.toDebugSql(debugConfig)).toContain("where\n  name = $1");
});
```

### Security Testing
Test parameter injection safety:

```typescript
it("prevents SQL injection", () => {
  const maliciousInput = "'; DROP TABLE users; --";
  const query = repository.findById(maliciousInput);
  const sql = query.toDebugSql(debugConfig);
  
  // Should contain parameterized query, not the raw input
  expect(sql).toContain("id = $1");
  expect(sql).not.toContain("DROP TABLE");
});
```

## File Organization

```
src/test/
├── infrastructure/
│   └── method-name/
│       ├── inject-search-conditions-for-method-name.test.ts
│       ├── apply-json-transformations-for-method-name.test.ts
│       └── complete-method-name-integration.test.ts
└── test-utils/
    └── table-column-resolver.ts
```

## Common Pitfalls

### Whitespace Sensitivity
Always trim expected SQL and use consistent indentation:

```typescript
const expectedSql = `
select
  column
from
  table
`.trim();
```

### Parameter Types
Ensure parameter types match between test and implementation:

```typescript
// Correct: string parameter
repository.findById("123")

// Incorrect: number parameter  
repository.findById(123)
```

### Debug Output
Use debug SQL for testing, not runtime SQL:

```typescript
// Correct
query.toDebugSql(debugConfig)

// Incorrect  
query.toSql()
```

## Integration with AI Maintenance

### Clear Test Descriptions
Write descriptive test names that explain the validation purpose:

```typescript
it("Phase 1: injects user ID parameter safely into WHERE clause", () => {
  // Test implementation
});
```

### Comprehensive Error Messages
Provide detailed failure information:

```typescript
expect(actualSql).toBe(expectedSql);
// If this fails, the error message will show the complete SQL diff
```

### Test Documentation
Document the testing approach in class comments:

```typescript
/**
 * This test validates the 3-phase SQL generation approach:
 * 1. Schema validation - ensures query structure is valid
 * 2. Parameter injection - validates WHERE clause safety  
 * 3. JSON transformation - verifies complex query building
 */
```

## Conclusion

This testing approach provides complete safety assurance for RawSQL operations:

- **Prevents production failures** by catching SQL errors early
- **Eliminates security vulnerabilities** through parameter validation
- **Ensures maintainability** with comprehensive test coverage
- **Enables AI maintenance** with automated validation

**Remember**: These tests are not optional - they are essential for safe RawSQL development.
