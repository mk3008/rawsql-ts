# Core Package Dev Notes

## Commands
```bash
pnpm --filter rawsql-ts test
pnpm --filter rawsql-ts build
pnpm --filter rawsql-ts lint
pnpm --filter rawsql-ts benchmark
pnpm demo:complex-sql
pnpm --filter rawsql-ts build:browser
```

## Troubleshooting
1. Confirm import target (`rawsql-ts` package build output vs `../../core/src` source path).
2. Clear caches and rebuild:

```bash
rm -rf dist node_modules && pnpm --filter rawsql-ts build
```

3. If tracing is required, add temporary instrumentation and remove it before commit:

```ts
console.log('[trace] SelectAnalyzer', payload);
```

4. Projects using `file:../core` resolve from `dist/`, not TypeScript source paths.

Common error hints:
- `Cannot read 'columns'`: validate wrapper objects around descriptors.
- `Module not found`: run package build to refresh `dist/`.
- Prefer `import { ... } from 'rawsql-ts'` over deep relative imports.
- For SQL string assertions, normalize with `SqlFormatter`.

## JSON Mapping Helpers

```ts
import { convertModelDrivenMapping } from 'rawsql-ts';
// Use when mapping.typeInfo && mapping.structure.
// Legacy mode expects mapping.rootName && mapping.rootEntity.
```

## Complex SQL Regression Demo

Checklist:
- Comment preservation rate stays at or above 95%.
- No token split artifacts like `table. /* comment */ column`.
- CASE expression comments keep evaluation order.
- Runtime target for the 169-line sample remains under 50 ms.
- Compare before/after outputs in `packages/core/reports/` when parser/formatter changes are made.

## Build and Bundling Notes

- Use esbuild with `--minify-syntax --minify-whitespace`.
- Avoid `--minify-identifiers` because it can break comment bookkeeping and named exports.
- Browser bundles depend on `tsconfig.browser.json`.
