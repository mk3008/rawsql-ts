# Testing Guidelines

Overall testing strategy for E2E, integration, and quality gates. For React component testing specifics, see `testing-standards.md`.

## Test Strategy Implementation

### Use Three-Tier Testing Approach
**Why**: Provides comprehensive coverage while maintaining fast feedback loops and preventing test overlap
**How**: 
- Unit tests (`src/**/*.test.ts`) for isolated functions
- Integration tests (`src/**/*.integration.test.ts`) for component interactions  
- E2E tests (`tests/e2e/**/*.spec.js`) for user journeys

### Execute Quality Gates in Development Order
**Why**: Catches issues early with faster feedback, reduces CI pipeline costs
**How**:
```bash
# Pre-commit: npm run ci:essential (TypeScript + ESLint)
# Pre-push: npm run ci:check (+ Unit Tests)  
# CI/CD: npm run quality (+ E2E Tests)
```

## Regression Prevention

### Create Failing E2E Test Before Bug Fixes
**Why**: Ensures bug actually gets fixed and prevents regression reoccurrence
**How**: 
1. Write E2E test that reproduces the bug (fails)
2. Implement fix until test passes
3. Keep test as permanent regression guard

### Test Critical User Interaction Points
**Why**: These areas cause the most user-visible failures when broken
**How**: Focus E2E tests on navigation flows, state persistence, input handling, error boundaries, loading states

## Test Stability

### Use Condition-Based Waits with Strategic Timeouts
**Why**: Condition-based waits prevent flaky tests, but React state updates may need minimal timeout for stability
**How**:
```javascript
// Preferred: Wait for specific conditions
await page.waitForSelector('[data-testid="element"]');
await page.waitForLoadState('networkidle');
await expect(element).toBeVisible({ timeout: 3000 });

// E2E Only: Minimal timeout for React state settling (avoid in unit/integration tests)
await page.waitForTimeout(1000); // Use sparingly, only when condition waits fail
```

### Use Semantic Test Selectors
**Why**: CSS classes and element positioning break when UI changes, causing maintenance overhead
**How**: Priority order: `data-testid` → `aria-label` → `.class:not([disabled])` → element type

### Verify Element State Before Interaction  
**Why**: Prevents test failures from attempting actions on disabled or hidden elements
**How**: Use `:not([disabled])` filters and `toBeVisible()` assertions before clicks/fills

## Test Organization

### Name Tests with Context and Specificity
**Why**: Enables quick understanding of test purpose and failure impact during debugging
**How**: 
```javascript
test('regression: tabs should not disappear after creation', ...)
test('navigation: left menu items create visible tabs', ...)
```

### Organize Tests by Functional Domain
**Why**: Reduces test maintenance burden and improves test discoverability
**How**: Structure as `tests/e2e/[navigation|regression|user-flows|components]/`

## Performance Optimization

### Run Tests in Parallel with Conflict Prevention
**Why**: Reduces total test execution time while avoiding resource conflicts
**How**: Use `reuseExistingServer` for development, group related tests, minimize setup/teardown

### Document Test Purpose and Requirements
**Why**: Enables efficient maintenance and prevents removal of critical regression tests
**How**: Include bug references, expected vs actual behavior, special prerequisites in test comments