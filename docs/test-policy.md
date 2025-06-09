# Test Policy

This document outlines the testing strategy for the rawsql-ts library.

## Types of Tests

We use two main types of tests:

1. **Unit Tests**: These tests verify individual components in isolation, focusing on a specific functionality of a single class or function.
2. **Integration Tests**: These tests verify how multiple components work together, often including parsing from SQL strings, transforming, and formatting back to SQL.

## Test File Structure

- Tests should be located in the `tests` directory, mirroring the structure of the `src` directory.
- Test files should be named with the pattern `[component-name].test.ts`.
- For utilities and transformers, use the pattern `tests/[directory]/[utility-name].test.ts`.

## Test Frameworks and Tools

- We use [Vitest](https://vitest.dev/) as the test runner.
- Tests should use standard assertion methods provided by Vitest.

## Test Organization

Tests should be organized using `describe` blocks to group related tests:

```typescript
describe('Component', () => {
  describe('method or functionality', () => {
    test('specific behavior or case', () => {
      // Test code
    });
  });
});
```

## Test Approach for SQL Components

For utilities and transformers that work with SQL AST components, we recommend a two-level testing approach:

1. **SqlComponent-level unit tests**: These test the utility using manually constructed AST nodes. These tests are precise and clearly show the expected behavior.

2. **Query-level integration tests**: These test the utility by:
   - Parsing SQL from a string
   - Applying the transformation
   - Formatting back to SQL
   - Asserting on the resulting SQL string

This approach ensures both that the internal logic works correctly and that the utility integrates properly with the SQL parser and formatter.

## Example

```typescript
describe('MyUtility', () => {
  describe('SqlComponent-level unit tests', () => {
    test('handles specific case', () => {
      // Create AST manually
      const node = new SomeComponent(/* ... */);
      
      // Apply transformation
      const result = MyUtility.transform(node);
      
      // Assert on the result
      expect(result).toBeInstanceOf(SomeComponent);
      expect(result.property).toBe(expectedValue);
    });
  });

  describe('query-level integration tests', () => {
    test('transforms SQL correctly', () => {
      // Parse SQL
      const sql = `SELECT * FROM users WHERE id = 1`;
      const query = SelectQueryParser.parse(sql);
      
      // Apply transformation
      const result = MyUtility.transform(query);
      
      // Format back to SQL
      const formatter = new Formatter();
      const resultSql = formatter.format(result);
      
      // Assert on the resulting SQL
      expect(resultSql).toBe(expectedSql);
    });
  });
});
```

## Test Coverage

- Aim for high test coverage, particularly for complex transformations and utilities.
- Test both normal cases and edge cases.
- For complex operations, test compound cases with multiple features interacting.

## Testing New Features

When adding a new feature:

1. Start by writing tests that define the expected behavior.
2. Implement the feature to make the tests pass.
3. Include both SqlComponent-level unit tests and query-level integration tests.
4. Consider edge cases and add tests for them.

This test-driven approach helps ensure that features are well-defined and correctly implemented.