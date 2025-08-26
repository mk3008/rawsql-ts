# TypeScript Testing Standards

This document defines the standard testing rules for the rawsql-ts project.

## Testing Framework

### Recommended Testing Framework
- **Vitest** - Modern and fast test runner
  - High compatibility with Vite-based projects
  - Jest API compatibility
  - Parallel execution for improved performance
  - Built-in TypeScript support

### Alternative Options
- **Jest** - Widely used standard testing framework
- **Mocha + Chai** - Highly flexible combination

## Core Principles

### Test-Driven Development (TDD)
- **Red-Green-Refactor cycle is recommended**
  1. **Red**: Write a failing test first
  2. **Green**: Implement minimal code to pass the test
  3. **Refactor**: Remove duplication and improve design
- **SQL processing logic must be implemented with test-first approach**
- **Parser and formatter features can be tested after implementation**

### Reliability-First Testing Strategy
- **Test as close to the implementation as possible**
- **Mock only truly necessary external dependencies**
- **Actively leverage lightweight implementation classes**

### Testing Strategy Pyramid
- **Unit Tests (80%)**: Implementation-focused main priority
  - Individual testing of models, parsers, transformers, and utilities
  - Use actual code with minimal mocking
- **Integration Tests (15%)**: Testing collaboration between parser, formatter, and transformer
  - Ensure consistency of SQL processing flow
  - Round-trip testing: parse → transform → format
- **E2E Tests (5%)**: Minimal
  - Verification with actual use cases

### Quality Goals
- **Unit test coverage: 90% or higher**
- **SQL processing logic coverage: 100%**
- **Execution time: Within 30 seconds for all unit tests**
- **Minimize gap between tests and implementation**

## Test File Structure

### File Naming Conventions (Actual Structure)
```
packages/core/src/                    # Implementation code
├── models/
│   ├── SelectQuery.ts
│   ├── Clause.ts
│   └── ValueComponent.ts
├── parsers/
│   ├── SelectQueryParser.ts
│   ├── SqlTokenizer.ts
│   └── ValueParser.ts
├── transformers/
│   ├── SqlFormatter.ts
│   ├── JoinAggregationDecomposer.ts
│   └── CTEQueryDecomposer.ts
└── utils/
    ├── CommentEditor.ts
    └── ParameterDetector.ts

packages/core/tests/                  # Test code (separate directory)
├── models/                           # Model tests
│   ├── SelectQuery.test.ts
│   ├── SelectQuery.cte-management.test.ts
│   └── SelectQueryJoin.test.ts
├── parsers/                          # Parser tests
│   ├── SelectQueryParser.test.ts
│   ├── ValueParser.test.ts
│   └── FromClauseParser.test.ts
├── transformers/                     # Transformer tests
│   ├── SqlFormatter.test.ts
│   ├── JoinAggregationDecomposer.test.ts
│   ├── CTEQueryDecomposer.test.ts
│   └── hierarchical/                 # Hierarchical processing specific
│       ├── SimpleHierarchyBuilder.test.ts
│       └── ComplexHierarchyBuilder.test.ts
├── utils/                            # Utility tests
│   ├── CommentEditor.test.ts
│   └── ParameterDetector.test.ts
└── [Integration Tests]               # Root level
    ├── practical-cte-workflow.test.ts
    └── comment-preservation-cte.test.ts
```

### File Naming Patterns
- Unit tests: `*.test.ts` or `*.spec.ts`
- Integration tests: `*.integration.test.ts`
- E2E tests: `*.e2e.test.ts`

## Unit Testing Rules

### Mandatory Testing Targets
The following code **must** have unit tests:

1. **SQL processing logic** - All methods
2. **Parser functionality** - All parsing processes
3. **Formatter functionality** - All formatting processes
4. **Transformer functionality** - All transformation processes
5. **Utility functions** - All functions

### Test Structure
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SelectQueryParser } from '../SelectQueryParser';
import { SqlFormatter } from '../SqlFormatter';

describe('SelectQueryParser', () => {
  let parser: SelectQueryParser;
  
  beforeEach(() => {
    parser = new SelectQueryParser();
  });
  
  describe('parse', () => {
    it('should parse simple SELECT query correctly', () => {
      // Arrange
      const sql = 'SELECT id, name FROM users';
      
      // Act
      const result = parser.parse(sql);
      
      // Assert
      expect(result.selectClause.items).toHaveLength(2);
      expect(result.fromClause?.table.name).toBe('users');
    });
    
    it('should throw error for invalid SQL syntax', () => {
      // Arrange
      const invalidSql = 'SELCT * FROM users'; // Typo
      
      // Act & Assert
      expect(() => parser.parse(invalidSql)).toThrow('Invalid SQL syntax');
    });
  });
});
```

### AAA (Arrange-Act-Assert) Pattern
```typescript
it('should format query with correct indentation', () => {
  // Arrange - Prepare test data
  const query = SelectQueryParser.parse('SELECT id,name FROM users');
  const formatter = new SqlFormatter({ indentSize: 2 });
  
  // Act - Execute the actual operation
  const result = formatter.format(query);
  
  // Assert - Verify the result
  expect(result.formattedSql).toContain('  '); // 2-space indentation
});
```

## Test Double Strategy

### Priority Order: Implementation > Lightweight Implementation > Mock

```typescript
// 🥇 Top Priority: Use implementation as-is
describe('SqlFormatter', () => {
  it('should format SELECT query correctly', () => {
    const formatter = new SqlFormatter();
    const query = SelectQueryParser.parse('SELECT * FROM users');
    const result = formatter.format(query);
    expect(result.formattedSql).toContain('SELECT');
  });
});

// 🥈 Second Priority: Lightweight test implementation
class InMemoryQueryCache implements QueryCachePort {
  private cache = new Map<string, SelectQuery>();
  
  async get(sql: string): Promise<SelectQuery | null> {
    return this.cache.get(sql) || null;
  }
  
  async set(sql: string, query: SelectQuery): Promise<void> {
    this.cache.set(sql, query);
  }
}

// 🥉 Last Resort: Mock external dependencies only
describe('QueryExecutor', () => {
  let mockDatabase: MockedObject<Database>;
  
  beforeEach(() => {
    mockDatabase = {
      execute: vi.fn(),
      close: vi.fn()
    };
  });
});
```

### Criteria for Mock Usage

#### ✅ Acceptable to Mock
- **External systems**: Database connections, API calls
- **File system**: File I/O operations, disk operations
- **Time dependencies**: Date.now(), setTimeout
- **Randomness**: Math.random()

#### ❌ Should Not Mock
- **Custom SQL processing logic**
- **Parser and formatter functionality**: SelectQueryParser, SqlFormatter
- **Pure functions**: Calculation processing, string processing
- **Data structures**: Array operations, object transformations

## rawsql-ts Specific Test Patterns

### SQL Processing Tests (tests/transformers/JoinAggregationDecomposer.test.ts)
```typescript
// tests/transformers/JoinAggregationDecomposer.test.ts
describe('JoinAggregationDecomposer', () => {
  let decomposer: JoinAggregationDecomposer;
  
  beforeEach(() => {
    decomposer = new JoinAggregationDecomposer();
  });
  
  it('should decompose CTE using real parser', () => {
    const sql = `
      WITH user_stats AS (
        SELECT user_id, COUNT(*) FROM orders GROUP BY user_id
      )
      SELECT * FROM user_stats
    `;
    
    // Test with actual parser
    const result = decomposer.analyze(SelectQueryParser.parse(sql));
    
    expect(result.success).toBe(true);
    expect(result.metadata.joinCount).toBe(0);
    expect(result.metadata.aggregationCount).toBe(1);
  });
  
  it('should reject window functions with incomplete conversion', () => {
    const sql = `
      SELECT 
        c.category_name,
        COUNT(p.id) as product_count,
        ROW_NUMBER() OVER (ORDER BY COUNT(p.id) DESC) as rank
      FROM categories c
      JOIN products p ON c.id = p.category_id
      GROUP BY c.category_name
    `;
    
    const query = SelectQueryParser.parse(sql) as SimpleSelectQuery;
    const result = decomposer.analyze(query);
    
    expect(result.success).toBe(false);
    expect(result.error).toContain('Window functions');
  });
});
```

### Parser Integration Tests (tests/parsers/SelectQueryParser.test.ts)
```typescript
// tests/parsers/SelectQueryParser.test.ts
describe('SQL Parsing Integration', () => {
  describe('complex queries', () => {
    it('should parse and format complex CTE correctly', () => {
      const complexSql = `
        WITH RECURSIVE category_tree AS (
          SELECT id, parent_id, name, 0 as level 
          FROM categories 
          WHERE parent_id IS NULL
          UNION ALL
          SELECT c.id, c.parent_id, c.name, ct.level + 1
          FROM categories c
          JOIN category_tree ct ON c.parent_id = ct.id
        )
        SELECT * FROM category_tree ORDER BY level, name
      `;
      
      // Verify consistency: parse -> format -> reparse
      const parsed = SelectQueryParser.parse(complexSql);
      const formatter = new SqlFormatter({ identifierEscape: { start: '', end: '' } });
      const formatted = formatter.format(parsed).formattedSql;
      const reparsed = SelectQueryParser.parse(formatted);
      
      expect(reparsed.withClause?.commonTables).toHaveLength(1);
      expect(reparsed.withClause?.recursive).toBe(true);
    });
  });
});
```

## Performance Testing

### Execution Time Measurement
```typescript
describe('Performance Tests', () => {
  it('should parse large query within time limit', () => {
    const largeQuery = generateComplexQuery(1000); // 1000 JOINs
    const startTime = performance.now();
    
    const result = SelectQueryParser.parse(largeQuery);
    
    const endTime = performance.now();
    const executionTime = endTime - startTime;
    
    expect(executionTime).toBeLessThan(1000); // Within 1 second
    expect(result.fromClause?.joins).toHaveLength(1000);
  });
  
  it('should format complex query efficiently', () => {
    const complexQuery = SelectQueryParser.parse(TEST_SQL_QUERIES.complex);
    const formatter = new SqlFormatter();
    
    const startTime = performance.now();
    const result = formatter.format(complexQuery);
    const endTime = performance.now();
    
    expect(endTime - startTime).toBeLessThan(100); // Within 100ms
    expect(result.formattedSql).toBeDefined();
  });
});
```

## Test Data Management

### SQL-Related Test Fixtures
```typescript
// tests/helpers/test-sql-data.ts (Helper files placed in tests folder)
export const TEST_SQL_QUERIES = {
  simple: 'SELECT id, name FROM users',
  withWhere: 'SELECT id, name FROM users WHERE active = 1',
  withJoin: `
    SELECT u.name, p.title 
    FROM users u 
    JOIN posts p ON u.id = p.user_id
  `,
  withCte: `
    WITH active_users AS (
      SELECT id, name FROM users WHERE active = 1
    )
    SELECT * FROM active_users
  `,
  complex: `
    WITH user_stats AS (
      SELECT user_id, COUNT(*) as order_count
      FROM orders 
      GROUP BY user_id
    ),
    high_value_users AS (
      SELECT user_id FROM user_stats WHERE order_count > 10
    )
    SELECT u.name, us.order_count
    FROM users u
    JOIN user_stats us ON u.id = us.user_id
    WHERE u.id IN (SELECT user_id FROM high_value_users)
  `,
  invalid: {
    syntaxError: 'SELCT * FROM users',  // Typo in SELECT
    missingFrom: 'SELECT * users',      // Missing FROM
    unclosedParenthesis: 'SELECT * FROM users WHERE id IN (1, 2'
  }
};

export function createTestSelectQuery(overrides?: Partial<SelectQuery>): SelectQuery {
  const defaultQuery = SelectQueryParser.parse(TEST_SQL_QUERIES.simple);
  return {
    ...defaultQuery,
    ...overrides
  };
}
```

### Formatter Options Test Data
```typescript
export const TEST_FORMATTER_OPTIONS = {
  minimal: {
    indentSize: 0,
    keywordCase: 'lower' as const
  },
  standard: {
    indentSize: 2,
    keywordCase: 'upper' as const,
    identifierEscape: { start: '"', end: '"' }
  },
  verbose: {
    indentSize: 4,
    keywordCase: 'upper' as const,
    linesBetweenQueries: 2,
    identifierEscape: { start: '"', end: '"' }
  }
};
```

## Test Execution Rules

### Execution Commands (Current Configuration)
```bash
# Run all tests (using vitest)
npm test

# Watch mode
npm run test:watch

# UI mode test execution (vitest UI)
npm run test:ui

# Run with coverage
npm run test:coverage

# Run specific test files
npm test JoinAggregationDecomposer                    # In transformers folder
npm test SelectQueryParser                            # In parsers folder
npm test SelectQuery.cte-management                   # In models folder

# Run specific category tests
npm test tests/transformers/                          # Transformers only
npm test tests/parsers/                               # Parsers only
npm test tests/models/                                # Models only

# Hierarchical processing specific tests
npm test tests/transformers/hierarchical/

# Specific test patterns
npm test -- -t "should parse"
npm test -- -t "CTE"
npm test -- -t "aggregation"

# Integration test execution
npm test practical-cte-workflow
npm test comment-preservation-cte
```

## Prohibited Practices

### Tests You Should Not Write
```typescript
// ❌ Don't test implementation details
it('should call internal parse method', () => {
  const spy = vi.spyOn(parser, '_internalParse');
  parser.parse(sql);
  expect(spy).toHaveBeenCalled();
});

// ❌ Don't access external systems directly
it('should save to real database', async () => {
  await queryExecutor.execute(sql);
  const saved = await realDatabase.find(queryId);
  expect(saved).toEqual(query);
});

// ❌ Don't write time-dependent tests
it('should return current timestamp', () => {
  const result = formatter.addTimestamp();
  expect(result).toBe(Date.now()); // Unstable
});

// ❌ Don't write order-dependent tests
describe('Sequential Tests', () => {
  let sharedParser: SelectQueryParser;
  
  it('should initialize parser', () => {
    sharedParser = new SelectQueryParser();
  });
  
  it('should use initialized parser', () => {
    expect(sharedParser.parse(sql)).toBeDefined(); // Depends on previous test
  });
});

// ❌ rawsql-tsの内部実装をモック
it('should parse with mocked parser', () => {
  const mockParser = vi.fn().mockReturnValue(fakeResult);
  // Doesn't validate actual parser behavior
});
```

### Recommended Alternatives
```typescript
// ✅ Test behavior
it('should return formatted SQL', () => {
  const result = formatter.format(query);
  expect(result.formattedSql).toContain('SELECT');
});

// ✅ Use lightweight implementation
it('should cache parsed queries', async () => {
  const cache = new InMemoryQueryCache();
  const parser = new CachingParser(cache);
  
  await parser.parse(sql);
  const cached = await cache.get(sql);
  expect(cached).toBeDefined();
});

// ✅ Mock time
it('should add timestamp to query', () => {
  const fixedTime = new Date('2023-01-01').getTime();
  vi.spyOn(Date, 'now').mockReturnValue(fixedTime);
  
  const result = formatter.addTimestamp();
  expect(result).toBe(fixedTime);
});

// ✅ Independent tests
describe('Independent Tests', () => {
  let parser: SelectQueryParser;
  
  beforeEach(() => {
    parser = new SelectQueryParser();
  });
  
  it('should handle empty input', () => {
    expect(() => parser.parse('')).toThrow('Empty SQL');
  });
  
  it('should handle valid input', () => {
    const result = parser.parse('SELECT 1');
    expect(result).toBeDefined();
  });
});

// ✅ Use actual rawsql-ts
it('should decompose complex query correctly', () => {
  const sql = TEST_SQL_QUERIES.complex;
  const query = SelectQueryParser.parse(sql); // Actual parser
  const decomposer = new JoinAggregationDecomposer();
  
  const result = decomposer.analyze(query);
  expect(result.success).toBe(true);
});
```

## Debug and Troubleshooting

### Investigation Procedures for Test Failures
```typescript
// デバッグ用のログ出力
it('should process complex SQL correctly', () => {
  const sql = TEST_SQL_QUERIES.complex;
  
  // デバッグ情報を出力
  console.log('Input SQL:', sql);
  
  const query = SelectQueryParser.parse(sql);
  console.log('Parsed Query:', JSON.stringify(query, null, 2));
  
  const result = formatter.format(query);
  console.log('Formatted SQL:', result.formattedSql);
  
  expect(result.formattedSql).toContain('SELECT');
});

// パーサーの動作を段階的に確認
it('should parse step by step', () => {
  const sql = 'SELECT id FROM users WHERE active = 1';
  
  // 段階的に解析
  const tokens = tokenize(sql);
  console.log('Tokens:', tokens);
  
  const ast = parseTokens(tokens);
  console.log('AST:', ast);
  
  const query = buildQuery(ast);
  expect(query.selectClause).toBeDefined();
});
```

### Asynchronous Test Debugging
```typescript
it('should handle async parsing', async () => {
  const sql = TEST_SQL_QUERIES.complex;
  
  // 非同期処理のテスト
  const parsePromise = asyncParser.parse(sql);
  expect(parsePromise).toBeInstanceOf(Promise);
  
  const result = await parsePromise;
  expect(result).toBeDefined();
});

// タイムアウトの設定
it('should complete within timeout', async () => {
  const largeQuery = generateLargeQuery();
  
  const result = await parser.parse(largeQuery);
  expect(result).toBeDefined();
}, 10000); // 10 second timeout
```

## Quality Checklist

### Pre-Pull Request Verification Items
- [ ] 新規追加したSQL処理ロジックに単体テストを追加
- [ ] カバレッジが90%以上を維持
- [ ] すべてのテストが独立して実行可能
- [ ] モックが適切に使用されている（外部依存のみ）
- [ ] テスト名が振る舞いを表現している
- [ ] AAA（Arrange-Act-Assert）パターンに従っている
- [ ] 実装詳細ではなく振る舞いをテストしている
- [ ] 非同期処理が適切にテストされている
- [ ] パフォーマンステストが含まれている（該当する場合）

## rawsql-ts Specific Testing Strategy

### Ensuring SQL Processing Reliability
1. **実際のSQLクエリを使用**: テストデータは実際に使われるSQLパターンを反映
2. **パーサーとフォーマッターの一貫性**: parse → format → parse の往復テスト
3. **複雑なクエリの網羅**: CTE、JOIN、サブクエリの組み合わせ
4. **エラーケースの充実**: 構文エラー、意味エラーの適切な処理

### Improving Maintainability
1. **テストの可読性**: ビジネス要件が理解できるテスト名とコメント
2. **テストデータの共通化**: 再利用可能なテストフィクスチャ
3. **段階的なテスト**: 単純 → 複雑へのステップアップ
4. **回帰テストの自動化**: 既存機能の継続的な検証
