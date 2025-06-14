# SQL Unit Testing Guide for AI Maintenance

## Overview

This guide provides instructions for creating unit tests for SQL transformer classes in rawsql-ts. These tests ensure reliability for AI-assisted maintenance by validating SQL transformations and parameter handling within the library itself.

## Why Internal Testing is Critical

### The Problem
SQL transformation logic within the library carries risks:
- **Incorrect SQL generation** from faulty transformer logic
- **Parameter handling errors** in SQL injectors
- **Regression bugs** when modifying existing transformers
- **Complex debugging** when transformations fail silently

### The Solution: Direct Transformer Testing
Validate transformer classes directly without external dependencies:

1. **Input Validation**: Test transformer methods with various inputs
2. **SQL Generation**: Validate generated SQL structure and syntax
3. **Parameter Handling**: Ensure parameters are correctly applied

### Benefits
- **Fast Execution**: Direct method testing without database
- **Isolated Testing**: Each transformer tested independently  
- **Regression Prevention**: Catches changes in transformer behavior
- **AI-Friendly**: Clear test patterns for automated maintenance

## Core Testing Principles

### 1. Test Transformer Methods Directly
Test the actual transformer classes and their public methods:

```typescript
// Test the actual SqlPaginationInjector class
const injector = new SqlPaginationInjector();
const result = injector.execute(query, { page: 1, size: 10 });
```

### 2. Always Validate Both SQL and Parameters
Test both the generated SQL structure and the parameter values:

```typescript
expect(result.sql).toBe(expectedSql);
expect(result.params).toEqual(expectedParams);
```

### 3. Use SqlFormatter for Consistent Output
Use the actual SqlFormatter class from the library for consistent SQL formatting:

```typescript
const formatter = new SqlFormatter();
const { sql, params } = formatter.format(query);
```

## Test File Template

Based on the actual SqlPaginationInjector test structure, here's the template for testing transformer classes:

```typescript
/**
 * Tests for [TransformerClassName] 
 * 
 * This test suite validates the transformer's SQL generation and parameter handling.
 */

import { describe, it, expect } from "vitest";
import { TransformerClassName } from "../../../src/transformers/TransformerClassName";
import { SqlFormatter } from "../../../src/formatters/SqlFormatter";

describe("TransformerClassName", () => {
  const formatter = new SqlFormatter();

  describe("execute", () => {
    it("should generate correct SQL with parameters", () => {
      // Arrange
      const transformer = new TransformerClassName();
      const inputQuery = {
        sql: "SELECT * FROM users",
        params: {}
      };
      const options = { /* test options */ };

      // Act
      const result = transformer.execute(inputQuery, options);
      const { sql, params } = formatter.format(result);

      // Assert
      const expectedSql = `SELECT * FROM users WHERE condition = :param1`;
      const expectedParams = { param1: "value" };
      
      expect(sql).toBe(expectedSql);
      expect(params).toEqual(expectedParams);
    });

    it("should handle edge cases correctly", () => {
      // Arrange
      const transformer = new TransformerClassName();
      const inputQuery = {
        sql: "SELECT * FROM users",
        params: {}
      };
      const edgeCaseOptions = { /* edge case options */ };

      // Act
      const result = transformer.execute(inputQuery, edgeCaseOptions);
      const { sql, params } = formatter.format(result);

      // Assert
      expect(sql).toBe("/* expected edge case SQL */");
      expect(params).toEqual({});
    });
  });
});
```

## Real-World Example: SqlPaginationInjector

Here's how the actual SqlPaginationInjector is tested in the codebase:

```typescript
describe("SqlPaginationInjector", () => {
  const formatter = new SqlFormatter();

  describe("execute", () => {
    it("should inject pagination with LIMIT and OFFSET for page 1", () => {
      // Arrange
      const injector = new SqlPaginationInjector();
      const query = {
        sql: "SELECT * FROM users",
        params: {}
      };
      const pagination = { page: 1, size: 10 };

      // Act
      const result = injector.execute(query, pagination);
      const { sql, params } = formatter.format(result);

      // Assert
      expect(sql).toBe("SELECT * FROM users LIMIT :paging_limit OFFSET :paging_offset");
      expect(params).toEqual({
        paging_limit: 10,
        paging_offset: 0
      });
    });

    it("should calculate correct offset for page 2", () => {
      // Arrange
      const injector = new SqlPaginationInjector();
      const query = {
        sql: "SELECT * FROM users",
        params: {}
      };
      const pagination = { page: 2, size: 10 };

      // Act
      const result = injector.execute(query, pagination);
      const { sql, params } = formatter.format(result);

      // Assert
      expect(sql).toBe("SELECT * FROM users LIMIT :paging_limit OFFSET :paging_offset");
      expect(params).toEqual({
        paging_limit: 10,
        paging_offset: 10
      });
    });
  });
});
```

## Testing Strategies for Transformer Classes

### 1. Basic Transformation Testing
Test that the transformer correctly modifies the input query:

```typescript
it("should apply transformation to SQL", () => {
  // Arrange
  const transformer = new SqlWhereInjector();
  const query = { sql: "SELECT * FROM users", params: {} };
  const conditions = { name: "John" };

  // Act
  const result = transformer.execute(query, conditions);

  // Assert
  expect(result.sql).toBe("SELECT * FROM users WHERE name = :name");
  expect(result.params).toEqual({ name: "John" });
});
```

### 2. Edge Case Testing
Test transformer behavior with edge cases:

```typescript
it("should handle empty conditions", () => {
  // Arrange
  const transformer = new SqlWhereInjector();
  const query = { sql: "SELECT * FROM users", params: {} };
  const conditions = {};

  // Act
  const result = transformer.execute(query, conditions);

  // Assert
  expect(result.sql).toBe("SELECT * FROM users");
  expect(result.params).toEqual({});
});
```

### 3. Parameter Preservation Testing
Ensure existing parameters are preserved when adding new ones:

```typescript
it("should preserve existing parameters", () => {
  // Arrange
  const transformer = new SqlWhereInjector();
  const query = { 
    sql: "SELECT * FROM users WHERE active = :active", 
    params: { active: true } 
  };
  const conditions = { name: "John" };

  // Act
  const result = transformer.execute(query, conditions);

  // Assert
  expect(result.sql).toBe("SELECT * FROM users WHERE active = :active AND name = :name");
  expect(result.params).toEqual({ active: true, name: "John" });
});
```

### 4. Validation Testing
Test that transformers validate their inputs appropriately:

```typescript
it("should throw error for invalid input", () => {
  // Arrange
  const transformer = new SqlPaginationInjector();
  const query = { sql: "SELECT * FROM users", params: {} };
  const invalidPagination = { page: 0, size: 10 }; // page should be >= 1

  // Act & Assert
  expect(() => {
    transformer.execute(query, invalidPagination);
  }).toThrow("Page must be greater than 0");
});
```

## Common Pitfalls and Best Practices

### 1. Always Test Both SQL and Parameters
Never test just the SQL - always verify parameters too:

```typescript
// ❌ Incomplete - only tests SQL
expect(result.sql).toBe(expectedSql);

// ✅ Complete - tests both SQL and parameters
expect(result.sql).toBe(expectedSql);
expect(result.params).toEqual(expectedParams);
```

### 2. Use SqlFormatter for Consistent Output
Always use the actual SqlFormatter from the library:

```typescript
// ✅ Correct - use actual SqlFormatter
const formatter = new SqlFormatter();
const { sql, params } = formatter.format(result);
expect(sql).toBe(expectedSql);
```

### 3. Test Parameter Naming Consistency
Ensure parameter names follow the library's conventions:

```typescript
it("should use consistent parameter naming", () => {
  // Arrange
  const injector = new SqlPaginationInjector();
  const query = { sql: "SELECT * FROM users", params: {} };

  // Act
  const result = injector.execute(query, { page: 1, size: 10 });

  // Assert - verify parameter names match library conventions
  expect(result.params).toHaveProperty("paging_limit");
  expect(result.params).toHaveProperty("paging_offset");
});
```

### 4. Handle SQL Whitespace Properly
Be careful with SQL string formatting and whitespace:

```typescript
// ✅ Proper - consistent spacing
const expectedSql = "SELECT * FROM users LIMIT :paging_limit OFFSET :paging_offset";

// ❌ Problematic - inconsistent spacing might cause test failures
const expectedSql = "SELECT * FROM users LIMIT:paging_limit OFFSET:paging_offset";
```

## Test Writing Standards

### 1. Follow AAA Pattern (Arrange-Act-Assert)
Structure all transformer tests using clear AAA sections:

```typescript
it("should inject pagination parameters correctly", () => {
  // Arrange
  const injector = new SqlPaginationInjector();
  const inputQuery = { sql: "SELECT * FROM users", params: {} };
  const pagination = { page: 2, size: 20 };

  // Act
  const result = injector.execute(inputQuery,pagination);

  // Assert
  expect(result.sql).toBe("SELECT * FROM users LIMIT :paging_limit OFFSET :paging_offset");
  expect(result.params).toEqual({
    paging_limit: 20,
    paging_offset: 20
  });
});
```

**AAA Benefits for Library Maintenance:**
- **Clear Structure**: Each test phase is visually separated for AI maintenance
- **Debugging**: Easy to identify which phase fails during transformer execution
- **Documentation**: Comments serve as inline documentation for transformer behavior
- **Consistency**: All internal tests follow the same pattern

### 2. Use Descriptive Test Names
Write test names that clearly explain what is being tested:

```typescript
// ✅ Good - describes the specific behavior being tested
it("should inject pagination with LIMIT and OFFSET for page 1")

// ✅ Good - describes edge case behavior
it("should preserve existing parameters when adding pagination")

// ❌ Bad - too vague
it("should work correctly")
```

### 3. Test One Behavior Per Test
Keep tests focused on a single transformer behavior:

```typescript
// ✅ Good - tests one specific behavior
it("should calculate correct offset for page 2", () => {
  const result = injector.execute(query, { page: 2, size: 10 });
  expect(result.params.paging_offset).toBe(10);
});

// ❌ Bad - tests multiple behaviors in one test
it("should handle pagination and preserve existing params and validate inputs", () => {
  // Too many responsibilities in one test
});
```

## Testing Transformer Classes: Step by Step

### Step 1: Import Required Dependencies
```typescript
import { describe, it, expect } from "vitest";
import { YourTransformerClass } from "../../../src/transformers/YourTransformerClass";
import { SqlFormatter } from "../../../src/formatters/SqlFormatter";
```

### Step 2: Set Up Test Structure
```typescript
describe("YourTransformerClass", () => {
  const formatter = new SqlFormatter();

  describe("execute", () => {
    // Your tests go here
  });
});
```

### Step 3: Write Individual Tests
```typescript
it("should transform query correctly", () => {
  // Arrange
  const transformer = new YourTransformerClass();
  const inputQuery = { sql: "base SQL", params: {} };
  const options = { /* transformation options */ };

  // Act
  const result = transformer.execute(inputQuery, options);
  const { sql, params } = formatter.format(result);

  // Assert
  expect(sql).toBe("expected SQL");
  expect(params).toEqual(expectedParams);
});
```

## Integration with AI Maintenance

### Write AI-Friendly Tests
Structure tests so AI can easily understand and maintain them:

```typescript
/**
 * Tests for SqlPaginationInjector transformer
 * 
 * This transformer adds LIMIT and OFFSET clauses to SQL queries
 * for pagination functionality.
 */
describe("SqlPaginationInjector", () => {
  it("should inject LIMIT and OFFSET for first page", () => {
    // Clear, single-purpose test that AI can easily understand
  });

  it("should calculate correct offset for subsequent pages", () => {
    // Each test focuses on one specific behavior
  });
});
```

### Provide Context in Test Names
Use descriptive test names that explain the business logic:

```typescript
// ✅ Good - explains what the transformer should do
it("should always include OFFSET clause even when page is 1 for consistent query caching")

// ✅ Good - explains edge case handling
it("should preserve existing query parameters when adding pagination")

// ❌ Bad - doesn't explain the purpose
it("should work with page 1")
```

### Document Expected Behavior
Use comments to explain non-obvious business rules:

```typescript
it("should always include OFFSET clause for consistent query caching", () => {
  // Arrange
  const injector = new SqlPaginationInjector();
  const query = { sql: "SELECT * FROM users", params: {} };
  
  // Act - Even for page 1, we include OFFSET 0 for query caching consistency
  const result = injector.execute(query, { page: 1, size: 10 });
  
  // Assert - OFFSET should always be present, even when it's 0
  expect(result.sql).toContain("OFFSET :paging_offset");
  expect(result.params.paging_offset).toBe(0);
});
```

## Conclusion

This testing approach ensures reliable transformer functionality:

- **Direct Testing**: Test transformer classes directly without external dependencies
- **Complete Validation**: Verify both SQL structure and parameter values
- **AI-Friendly**: Clear patterns that AI can understand and replicate
- **Regression Prevention**: Catch changes in transformer behavior immediately

**Key Points for AI Maintenance:**
- Always test transformer methods directly, not through repositories or usage patterns
- Use real classes and methods from the actual codebase
- Focus on the transformer's core responsibility: SQL transformation and parameter handling
- Write tests that clearly demonstrate expected behavior for each transformer class

**Remember**: These tests validate the internal workings of rawsql-ts transformers. They ensure that when AI adds new features or modifies existing transformers, the SQL generation logic remains correct and reliable.
