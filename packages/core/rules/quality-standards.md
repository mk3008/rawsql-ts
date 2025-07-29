# AI Development Guide - Quality Standards

This document defines quality standards and commands for AI assistants (such as Claude Code) working on the rawsql-ts project.

## Basic Principles

### Development Flow
1. **Code Changes**
2. **Quality Check Execution** (mandatory)
3. **Error Resolution**
4. **Re-check**
5. **Commit**

### Quality Standards

#### Absolutely Required Items (Release Blockers)
- **TypeScript Errors: 0** - Compilation required
- **Test Failures: 0** - Regression prevention required
- **Build Errors: 0** - Package creation required

#### Recommended Items (Quality Improvement)
- **Lint Errors: Ideally 0** - Any usage allowed up to 5% of total codebase
- **Test Coverage: 80%+ overall, 90%+ for Core layer** - Quality target
- **Type Safety: Minimize usage of unknown and any types** - Leverage TypeScript's core benefits
- **JSDoc Comments: 80%+ of public classes and functions** - Improve API comprehensibility

## Commands to Meet Quality Standards

### 1. TypeScript Type Checking
```bash
# Check for type errors (most important)
tsc --noEmit

# Type check specific file
tsc --noEmit src/transformers/JoinAggregationDecomposer.ts

# Example of type error
# src/transformers/SqlFormatter.ts(25,3): error TS2322: Type 'string' is not assignable to type 'FormatterOptions'
```

**Execution Timing**: Must be run first after any code changes

### 2. ESLint Execution
```bash
# Check for lint errors
npm run lint

# Auto-fix available issues
npm run lint:fix

# Lint specific file
npx eslint src/transformers/JoinAggregationDecomposer.ts
```

**Execution Timing**: After TypeScript type checking

### 3. Test Execution
```bash
# Run all tests (vitest)
npm test

# Run specific test file
npm test JoinAggregationDecomposer

# Run tests with coverage
npm run test:coverage

# Watch mode (during development)
npm run test:watch
```

**Execution Timing**: After lint fixes

### 4. Build Verification
```bash
# TypeScript build
npm run build

# Check build artifacts
ls -la dist/

# Test packaging
npm pack
```

**Execution Timing**: After tests pass

## Partial Checks During Development

### File-level Type Checking
```bash
# Type check specific file
tsc --noEmit src/models/SelectQuery.ts

# Type check specific directory
tsc --noEmit src/transformers/**/*.ts
```

### Watch Mode
```bash
# Watch tests during development
npm run test:watch

# TypeScript watch (IDE features recommended like VS Code)
tsc --noEmit --watch
```

## Error Resolution Flow

### TypeScript Error Resolution
```bash
# 1. Check errors
tsc --noEmit

# 2. Analyze error content
# - Missing type definitions
# - Type mismatches
# - Import errors

# 3. Re-check after fixes
tsc --noEmit
```

### Lint Error Resolution
```bash
# 1. Check errors
npm run lint

# 2. Attempt auto-fix
npm run lint:fix

# 3. Manual fixes when needed
# - Remove unused variables
# - Fix naming conventions
# - Unify code style

# 4. Re-check after fixes
npm run lint
```

### Test Failure Resolution
```bash
# 1. Check failed tests
npm test

# 2. Run specific test file in detail
npm test JoinAggregationDecomposer.test.ts

# 3. Re-test after fixes
npm test
```

## Automated Quality Checks by AI

### Example Check Script
```typescript
// scripts/quality-check.ts
export async function runQualityChecks(): Promise<QualityCheckResult> {
  const results: QualityCheckResult = {
    typescript: false,
    lint: false,
    tests: false,
    build: false
  };
  
  // TypeScript type checking
  try {
    await execCommand('tsc --noEmit');
    results.typescript = true;
    console.log('✅ TypeScript: No errors');
  } catch (error) {
    console.error('❌ TypeScript errors found:', error);
  }
  
  // ESLint execution
  try {
    await execCommand('npm run lint');
    results.lint = true;
    console.log('✅ ESLint: No errors');
  } catch (error) {
    console.error('❌ Lint errors found:', error);
  }
  
  // Test execution
  try {
    await execCommand('npm test');
    results.tests = true;
    console.log('✅ Tests: All passing');
  } catch (error) {
    console.error('❌ Test failures found:', error);
  }
  
  // Build verification
  try {
    await execCommand('npm run build');
    results.build = true;
    console.log('✅ Build: Successful');
  } catch (error) {
    console.error('❌ Build errors found:', error);
  }
  
  return results;
}
```

### Staged Check Strategy
```bash
# Step 1: Basic checks (fast)
tsc --noEmit
npm run lint

# Step 2: Complete checks (detailed)
npm test
npm run build

# Step 3: Integration checks (final verification)
npm run test:coverage
npm pack
```

## rawsql-ts Specific Quality Checks

### SQL Processing Reliability Checks
```bash
# Run parser tests
npm test -- --grep "SelectQueryParser"

# Run formatter tests  
npm test -- --grep "SqlFormatter"

# Run transformer tests
npm test -- --grep "JoinAggregationDecomposer"
```

### AST Operation Accuracy Verification
```bash
# Run AST-related tests intensively
npm test -- --grep "AST|parse|transform"

# Type safety check
tsc --noEmit --strict
```

## Performance Optimization

### Parallel Execution
```bash
# Run type check and lint in parallel
tsc --noEmit & npm run lint & wait

# Run tests and build in parallel (when resources allow)
npm test & npm run build & wait
```

### Cache Utilization
```bash
# TypeScript incremental compilation (fast)
tsc --noEmit --incremental

# Clear Vitest cache (when needed)
rm -rf node_modules/.vitest
```

## Consistency with CI/CD Environment

### GitHub Actions Equivalent Checks
```bash
# Same content as .github/workflows/test.yml
npm ci
npm run lint
npm test
npm run build
```

### Pre-publish Package Checks
```bash
# Final verification before npm publish
npm run build
npm pack
npm run test:coverage

# Verify package contents
tar -tzf rawsql-ts-*.tgz
```

## Troubleshooting

### Common Error Patterns

#### 1. Type Errors
```typescript
// Error example
Property 'tableList' does not exist on type 'SelectQuery'

// Fix method
interface SelectQuery {
  selectClause: SelectClause;
  fromClause?: FromClause;
  tableList: string[]; // Add to type definition
}
```

#### 2. Lint Errors
```typescript
// Error example
'SelectQueryParser' is defined but never used

// Fix method
import type { SelectQueryParser } from './SelectQueryParser'; // Change to type import
```

#### 3. Test Failures
```typescript
// Error example
Expected: "SELECT * FROM users"
Received: "select * from users"

// Fix method
expect(result.toUpperCase()).toBe("SELECT * FROM USERS");
// or
expected(result).toBe("select * from users"); // Fix expected value
```

#### 4. Build Errors
```bash
# Error example
Module not found: Can't resolve '../models/SelectQuery'

# Fix method
# Check tsconfig.json paths
# Verify import statement paths
```

### Debug Commands
```bash
# Detailed error information
tsc --noEmit --listFiles

# Detailed lint information
npm run lint -- --format verbose

# Detailed test information
npm test -- --reporter verbose

# Detailed build information
npm run build -- --verbose
```

## Quality Check Best Practices

### 1. Frequent Checks with Small Changes
```bash
# Run immediately after file save
tsc --noEmit src/transformers/JoinAggregationDecomposer.ts
```

### 2. Error Priority
1. **TypeScript Errors** - Fix with highest priority
2. **Test Failures** - Business logic issues
3. **Lint Errors** - Code style issues
4. **Build Errors** - Environment configuration issues

### 3. Complete Checks After Fixes
```bash
# Always run full checks after fixes are complete
tsc --noEmit && npm run lint && npm test && npm run build
```

## AIアシスタント向けガイド

### 開発作業時の必須チェックリスト
- [ ] `tsc --noEmit` でTypeScriptエラー0件
- [ ] `npm run lint` でLintエラー0件  
- [ ] `npm test` でテスト全合格
- [ ] `npm run build` でビルド成功
- [ ] publicなクラス・関数の80%以上にJSDocコメントが記述されている

### 修正作業の進め方
1. **エラー内容を正確に把握**
2. **最小限の変更で修正**
3. **修正後に関連テストを実行**
4. **全体品質チェックで最終確認**

### Report Format
```markdown
## Quality Check Results

### TypeScript
✅ 0 errors

### ESLint  
✅ 0 errors

### Tests
✅ All 24 tests passing (JoinAggregationDecomposer.test.ts)

### Build
✅ Success

## Fix Details
- Integrated implementation of JoinAggregationDecomposer class
- Added window function validation
- Implemented comprehensive test suite
```

## rawsql-ts Specific Considerations

### Parser Reliability
```bash
# Regression tests with complex SQL statements
npm test -- --grep "complex.*SQL"

# Tests with Unicode/Japanese SQL
npm test -- --grep "unicode.*SQL"
```

### Memory Usage Monitoring
```bash
# Memory tests with large SQL files
npm test -- --grep "large.*query"

# Performance tests
npm test -- --grep "performance"
```

### Type Safety Maintenance
```bash
# Strict type checking
tsc --noEmit --strict --noImplicitAny

# Detect unused code
tsc --noEmit --noUnusedLocals --noUnusedParameters
```
