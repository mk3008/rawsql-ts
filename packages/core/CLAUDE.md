# rawsql-ts Core Package

## MUST: Response starts with `CLAUDE.md path` or `CLAUDE.md: Not recognized`

## Dev Principles
1. **KISS**: Simple, readable code > complex clever solutions
2. Maintainability > micro-optimizations  
3. One problem at a time, complete it
4. Small focused tasks

## Critical Rules
- **Tests are specs - never change expected values without user consultation**
- Add test when adding/fixing features
- Always compile to check TypeScript errors
- **Source code comments in English only**

## TDD: Red-Compile-Green-Refactor
1. **Red**: Write failing test first (bug repro included)
2. **Compile**: Fix TypeScript errors before running tests
3. **Green**: Minimal code to pass test
4. **Refactor**: Improve while keeping tests green
5. **Verify**: Break test temporarily to ensure it actually tests behavior

## Debug & Cleanup
- Temp files → `.tmp/` folder only, cleanup after debug
- Remove console.log before commit

## MANDATORY Pre-commit Steps
**ALWAYS run before ANY commit:**
```bash
npm test && npm run build && npm run lint
```
**All must pass. No exceptions.**

## Commit Sequence
1. Refactor code for maintainability
2. Run mandatory validation above
3. `git add .`
4. `git commit`

## Code Changes Not Reflecting?
1. Check imports: `from 'rawsql-ts'` (stale) vs `from '../../core/src'` (fresh)
2. Clear cache: `rm -rf dist node_modules && npm run build`
3. Add debug: `console.log('🔍 [Class] method');`
4. Monorepo: `file:../core` uses dist/, direct imports bypass cache

## Commands
```bash
npm test                # Run tests
npm run build           # TypeScript build
npm run lint            # ESLint
npm run demo:complex-sql # Complex SQL formatting demo (regression testing)
```

## Library-Specific: rawsql-ts

### JSON Mapping
```typescript
// Model-Driven: mapping.typeInfo && mapping.structure
import { convertModelDrivenMapping } from 'rawsql-ts';
// Legacy: mapping.rootName && mapping.rootEntity
```

### Common Errors & Fixes
- `Cannot read 'columns'` → Use `convertModelDrivenMapping`
- Module not found → `npm run build` first
- Wrong imports → Use `from 'rawsql-ts'` not local paths
- Use `SqlFormatter` for SQL comparison tests

## Regression Testing

### Complex SQL Demo
```bash
npm run demo:complex-sql
```
**Purpose**: Verify positioned comments system and SQL formatting quality

**Key Metrics**:
- Comment preservation rate: Target 95%+
- QualifiedName handling: No `table. /* comment */ column` splitting
- CASE expression comments: Proper order preservation
- Performance: <50ms for complex SQL (169 lines)

**Output**: Detailed Markdown report in `packages/core/reports/`

Use before/after major changes to detect regressions in SQL formatting quality.