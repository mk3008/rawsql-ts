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

## Pre-commit Validation
Before staging changes, run full validation:
```bash
npm test              # Full test suite (core: 1154+ tests)
npm run build         # TypeScript compilation check
npm run lint          # ESLint validation
```
Ensure all pass with no regressions before git add/commit.

## Commit Process
1. **Refactor for maintainability** (avoid over-DRY, prefer readability)
2. **Stage changes**: `git add .`
3. **Commit with descriptive message**

## Code Changes Not Reflecting?
1. Check imports: `from 'rawsql-ts'` (stale) vs `from '../../core/src'` (fresh)
2. Clear cache: `rm -rf dist node_modules && npm run build`
3. Add debug: `console.log('🔍 [Class] method');`
4. Monorepo: `file:../core` uses dist/, direct imports bypass cache

## Commands
```bash
npm test              # Run tests  
npm run build         # TypeScript build
npm run lint          # ESLint
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