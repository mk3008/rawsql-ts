# SQL Unit Testing Guide for AI Maintenance

## Overview

This guide provides comprehensive instructions for creating and maintaining unit tests for SQL generation logic in the rawsql-ts project. These guidelines ensure thorough testing of SQL transformations and provide reliable automated validation for AI-assisted maintenance.

## Core Testing Principles

### 1. Test Each SQL Transformation Separately
```typescript
// ✅ Good: Test each transformation in isolation
describe('SqlParamInjector - Search Condition Injection', () => {
    it('should inject WHERE clause correctly', () => {
        // Test only SqlParamInjector functionality
    });
});

describe('PostgresJsonQueryBuilder - JSON Processing', () => {
    it('should transform result columns correctly', () => {
        // Test only PostgresJsonQueryBuilder functionality  
    });
});

// ❌ Bad: Testing multiple transformations together
describe('Complete SQL Generation', () => {
    it('should generate final SQL with all transformations', () => {
        // This tests too many things at once
    });
});
```

### 2. Always Compare Complete SQL Text
```typescript
// ✅ Good: Full SQL comparison
it('should generate expected SQL structure', () => {
    const result = repository.injectSearchConditions(id);
    const { formattedSql, params } = formatter.format(result);
    
    const expectedSql = `select
    "t"."todo_id"
    , "t"."title"
from
    "todo" as "t"
where
    "t"."todo_id" = $1`;
    
    expect(formattedSql.trim()).toBe(expectedSql.trim());
    expect(params).toEqual([123]);
});

// ❌ Bad: Partial SQL validation
it('should include WHERE clause', () => {
    const result = repository.injectSearchConditions(id);
    expect(result.where).toBeDefined(); // Not sufficient!
});
```

### 3. Never Judge Correctness by SQL Fragments

**⚠️ CRITICAL: Partial SQL testing is strictly forbidden.**

```typescript
// ❌ NEVER DO THIS: Fragment testing is unreliable and dangerous
expect(sql).toContain('WHERE');
expect(sql).toContain('todo_id = $1');
expect(sql).toContain('jsonb_build_object');
expect(sql).toContain('LEFT JOIN');

// ❌ NEVER DO THIS: Component-level validation
expect(result.where).toBeDefined();
expect(result.select.columns).toHaveLength(5);
expect(result.joins[0].type).toBe('LEFT');

// ❌ NEVER DO THIS: Pattern matching on SQL parts
expect(formattedSql).toMatch(/WHERE\s+"t"\."todo_id"\s*=\s*\$1/);

// ✅ ALWAYS DO THIS: Complete structure validation
expect(formattedSql.trim()).toBe(expectedCompleteSQL.trim());
```

**Why partial testing is dangerous:**
- SQL generation is complex with many interdependent parts
- Fragment existence doesn't guarantee correct placement or syntax
- Partial tests can pass while the complete SQL is malformed
- Context matters: same fragments can be valid or invalid depending on position
- Full SQL comparison catches integration issues between components

**Examples of hidden bugs that fragment testing misses:**
```sql
-- Fragment test: ✅ Contains "WHERE" and "todo_id = $1"
-- Reality: ❌ Malformed SQL with syntax error
SELECT "todo_id" WHERE FROM "todo" WHERE "todo_id" = $1

-- Fragment test: ✅ Contains "jsonb_build_object" and "LEFT JOIN"  
-- Reality: ❌ Missing GROUP BY clause breaks aggregation
SELECT jsonb_agg(...) FROM todo LEFT JOIN category -- Missing GROUP BY!
```

## File Organization

### Directory Structure
```
src/
  test/
    {infrastructure-class}/
      {rawsql-function-name}.test.ts
      {rawsql-function-name}-integration.test.ts
```

### Example File Organization
```
src/
  test/
    rawsql-todo-repository/
      inject-search-conditions-for-find-by-id.test.ts
      apply-json-transformations-for-find-by-id.test.ts
      find-by-id-integration.test.ts
    rawsql-user-repository/
      inject-search-conditions-for-find-by-email.test.ts
      apply-pagination-for-list-users.test.ts
```

## Test File Template

### Basic Template Structure
```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { YourRepositoryClass } from '../infrastructure/your-infrastructure';

// Consistent SQL formatting for testing
const debugSqlStyle = {
    identifierEscape: { start: "\"", end: "\"" },
    parameterSymbol: "$",
    parameterStyle: "indexed" as const,
    indentSize: 4,
    indentChar: " " as const,
    newline: "\n" as const,
    keywordCase: "lower" as const,
    commaBreak: "before" as const,
    andBreak: "before" as const
};

/**
 * Unit tests for [SPECIFIC_FUNCTION_NAME] - [TRANSFORMATION_DESCRIPTION]
 * Tests only [SPECIFIC_COMPONENT] functionality with full SQL comparison
 */
describe('YourRepositoryClass - [Transformation Name]', () => {
    let repository: YourRepositoryClass;

    beforeAll(() => {
        repository = new YourRepositoryClass(false, debugSqlStyle);
    });

    describe('[functionName] - Full SQL Structure Verification', () => {
        it('should generate expected SQL structure', () => {
            // Arrange
            const inputParam = 'test-value';

            // Act
            const result = repository.yourFunction(inputParam);
            const { formattedSql, params } = repository['sqlFormatter'].format(result);

            // Debug output (helpful during development)
            console.log('Actual SQL:', formattedSql);

            // Assert - Complete SQL verification
            const expectedSql = `select
    "column1"
    , "column2"
from
    "table1"
where
    "column1" = $1`;

            expect(formattedSql.trim()).toBe(expectedSql.trim());
            expect(params).toEqual(['expected-param-value']);
        });
    });
});
```

## Testing Strategies for Different Scenarios

### 1. Fixed Search Conditions
For functions like `findById` where the search condition is fixed:
```typescript
describe('Fixed Search Conditions', () => {
    it('should generate consistent SQL structure', () => {
        const result = repository.findById('123');
        // Test complete SQL with expected WHERE clause
    });

    it('should handle different ID values correctly', () => {
        const result1 = repository.findById('100');
        const result2 = repository.findById('999');
        
        // Verify SQL structure is consistent, only parameters differ
        const sql1WithoutParams = formatSql(result1).replace(/\$\d+/g, '$?');
        const sql2WithoutParams = formatSql(result2).replace(/\$\d+/g, '$?');
        
        expect(sql1WithoutParams).toBe(sql2WithoutParams);
    });
});
```

### 2. Optional Search Conditions
For functions with optional search parameters, test one representative case unless user specifies otherwise:
```typescript
describe('Optional Search Conditions', () => {
    it('should generate SQL with provided search criteria', () => {
        // Test with one typical search condition combination
        const searchCriteria = { status: 'active', priority: 'high' };
        const result = repository.searchTodos(searchCriteria);
        
        // Verify complete SQL includes both conditions
        const { formattedSql, params } = formatter.format(result);
        expect(formattedSql).toContain('WHERE');
        expect(formattedSql).toContain('"status" = $1');
        expect(formattedSql).toContain('AND "priority" = $2');
        expect(params).toEqual(['active', 'high']);
    });

    it('should generate base SQL when no search criteria provided', () => {
        const result = repository.searchTodos({});
        
        // Verify SQL without WHERE clause
        const { formattedSql } = formatter.format(result);
        expect(formattedSql).not.toContain('WHERE');
    });
});
```

### 3. Security Testing
Always include SQL injection protection tests:
```typescript
describe('SQL Injection Protection', () => {
    it('should safely handle malicious input', () => {
        const maliciousInput = "1; DROP TABLE users; --";
        const result = repository.findById(maliciousInput);
        const { formattedSql, params } = formatter.format(result);
        
        expect(formattedSql).not.toContain('DROP TABLE');
        expect(formattedSql).not.toContain('--');
        expect(params).toHaveLength(1);
        expect(typeof params[0]).toBe('number'); // Should be safely converted
    });
});
```

## SQL Formatting Consistency

### Standard Debug Configuration
Always use consistent SQL formatting for predictable test results:
```typescript
const debugSqlStyle = {
    identifierEscape: { start: "\"", end: "\"" },
    parameterSymbol: "$",
    parameterStyle: "indexed" as const,
    indentSize: 4,
    indentChar: " " as const,
    newline: "\n" as const,
    keywordCase: "lower" as const,
    commaBreak: "before" as const,
    andBreak: "before" as const
};
```

### Expected SQL Format
```sql
select
    "table1"."column1"
    , "table1"."column2" as "alias1"
    , "table2"."column3"
from
    "main_table" as "table1"
    left join "related_table" as "table2" on "table1"."id" = "table2"."main_id"
where
    "table1"."status" = $1
    and "table1"."created_at" > $2
order by
    "table1"."created_at"
```

## Common Pitfalls and Solutions

### 1. Whitespace Sensitivity
```typescript
// ✅ Good: Trim whitespace for comparison
expect(formattedSql.trim()).toBe(expectedSql.trim());

// ❌ Bad: Sensitive to leading/trailing whitespace
expect(formattedSql).toBe(expectedSql);
```

### 2. Parameter Type Consistency
```typescript
// ✅ Good: Verify parameter types and values
expect(params).toEqual([123]); // number
expect(params).toEqual(['active']); // string

// ❌ Bad: Ignoring parameter validation
// Only checking SQL structure without parameters
```

### 3. Debug Output
```typescript
// ✅ Good: Include debug output for development
console.log('Actual SQL:', formattedSql);
console.log('Parameters:', params);

// Remove or comment out console.log in final version
```

## Test Maintenance Guidelines

### 1. Update Tests When SQL Changes
- When modifying SQL generation logic, update corresponding tests immediately
- Run tests after any SQL-related changes
- Update expected SQL patterns to match new formatting

### 2. Version Control for Expected SQL
- Store expected SQL patterns in test files, not external files
- Keep expected SQL readable with proper indentation
- Comment complex SQL expectations when necessary

### 3. Test Performance Considerations
- SQL generation tests should be fast (< 100ms per test)
- Mock external dependencies (databases, APIs)
- Focus on logic validation, not actual database operations

## Integration with AI Maintenance

### 1. Clear Test Descriptions
```typescript
/**
 * Unit tests for SqlParamInjector functionality in findById operation
 * Validates that WHERE clause injection works correctly with proper parameterization
 * Expected: Single WHERE condition with todo_id parameter
 */
```

### 2. Comprehensive Error Messages
```typescript
expect(formattedSql.trim()).toBe(expectedSql.trim(), 
    `SQL mismatch. Expected proper WHERE clause injection.
     Actual: ${formattedSql}
     Expected: ${expectedSql}`);
```

### 3. Test Documentation
- Document the purpose of each test suite
- Explain complex SQL transformations in comments
- Provide examples of expected vs actual SQL in test descriptions

## Example: Complete Test File

See `src/test/rawsql-todo-repository/inject-search-conditions-for-find-by-id.test.ts` for a complete implementation example following these guidelines.

## Conclusion

Following these guidelines ensures:
- **Reliable SQL validation** through complete text comparison
- **Maintainable test suites** with clear organization
- **AI-friendly codebase** with comprehensive automated testing
- **Security assurance** through injection protection testing
- **Consistent formatting** for predictable test results

Remember: SQL generation is complex and error-prone. Comprehensive unit testing with full SQL comparison is essential for maintaining code quality and enabling safe AI-assisted development.
