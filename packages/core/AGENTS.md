# rawsql-ts Core Package

## Dev Principles
1. **KISS**: reach for the simplest data structures and flows that explain the behavior.
2. Maintainability beats micro-optimizations unless a benchmark proves otherwise.
3. Close one problem at a time; ship incremental patches instead of mega-commits.
4. Keep pull requests scoped to a single area when possible.

## Critical Rules
- Tests are specs-never update expectations without user alignment.
- Add or update tests whenever you add features or fix bugs.
- Compile before running tests; TypeScript errors must stay at 0.
- Source code comments live in English only.

## SQL Parsing Expectations
- Prefer AST helpers (`SelectQueryParser`, `SelectAnalyzer`, `splitQueries`, formatter APIs) for *all* SQL analysis.
- Regex-based rewrites are allowed only as explicit fallbacks with comments explaining the limitation and an issue reference for follow-up work.
- When triaging bugs, extend the AST pipeline (tokens, visitors, formatter patches) rather than layering bespoke regex filters.

## TDD: Red -> Compile -> Green -> Refactor
1. **Red**: add a failing Vitest (or reproduction script) first-even for bug fixes.
2. **Compile**: fix TypeScript errors before running the suite so diagnostics stay focused.
3. **Green**: implement the minimum change to flip the test.
4. **Refactor**: once green, clean up control flow and naming.
5. **Verify**: break the new test intentionally to ensure it really guards the behavior.

## Debug & Cleanup
- Temp or experimental artifacts belong in `./tmp/`; delete them when done.
- Strip `console.log`, `debugger`, and tracing hooks before opening a PR.

## Mandatory Pre-commit Steps
Run these inside `packages/core` or via filters from the workspace root:
```
pnpm --filter rawsql-ts test && pnpm --filter rawsql-ts build && pnpm --filter rawsql-ts lint
```
All three must pass before you commit.

## Commit Sequence
1. Refactor for clarity and keep public APIs documented.
2. Run the validation stack above.
3. `git add -p` to review exactly what you staged.
4. `git commit` with a focused message (feature/fix/refactor).

## Code Changes Not Showing Up?
1. Verify imports target `rawsql-ts` (built) versus `../../core/src` (live) depending on context.
2. Clear caches: `rm -rf dist node_modules && pnpm --filter rawsql-ts build`.
3. Add temporary instrumentation: `console.log('[trace] SelectAnalyzer', payload)` (remember to remove!).
4. Monorepo consumers using `file:../core` pull from `dist/`; direct TS path imports bypass the bundle.

## Commands
```
pnpm --filter rawsql-ts test          # Vitest suite
pnpm --filter rawsql-ts build         # tsc --build
pnpm --filter rawsql-ts lint          # ESLint (fix mode is allowed locally)
pnpm --filter rawsql-ts benchmark     # parse benchmarks
pnpm demo:complex-sql                 # regression demo (from repo root)
```

## Library-Specific Notes
### JSON Mapping Helpers
```ts
import { convertModelDrivenMapping } from 'rawsql-ts';
// Use when mapping.typeInfo && mapping.structure
// Legacy mode still expects mapping.rootName && mapping.rootEntity
```

### Common Errors & Fixes
- `Cannot read 'columns'`: ensure `convertModelDrivenMapping` wraps descriptor objects.
- `Module not found`: run `pnpm --filter rawsql-ts build` to refresh `dist/`.
- Wrong imports: prefer `import { ... } from 'rawsql-ts'` instead of deep relative paths.
- Comparing SQL in tests: go through `SqlFormatter` to normalize whitespace and casing.

## Regression Testing
### Complex SQL Demo
```
pnpm demo:complex-sql
```
**Purpose**: spot regressions in positioned comments and SQL formatting.

**Watch For**
- Comment preservation >=95%.
- Qualified names should not split tokens like `table. /* comment */ column`.
- CASE expression comments must remain in evaluation order.
- Performance goal: <50 ms for the 169-line sample query.
- Output lives in `packages/core/reports/`; compare before/after when touching rewrites.

## Build / Bundling Notes
- Use `esbuild` with `--minify-syntax --minify-whitespace`; avoid `--minify-identifiers` (breaks comment bookkeeping and named exports).
- When enabling full minification temporarily, double-check both ESM/CJS bundles for comment alignment issues before publishing.
- Browser bundles rely on `tsconfig.browser.json`; run `pnpm --filter rawsql-ts build:browser` when tweaking formatter exports.
