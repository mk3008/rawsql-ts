# @rawsql-ts/testkit-core

## Scope
- Provides AST-powered SELECT rewrites, fixture validation, and schema helpers consumed by driver adapters.
- Owns `SelectFixtureRewriter`, `SelectAnalyzer`, and the `FixtureStore` pipeline.

## How to Work Here
- Keep docs/comments in English and add concise inline comments before complex logic blocks (passthrough rules, fixture scheduling, AST fallbacks).
- Use `Vitest` for unit coverage and `pnpm --filter @rawsql-ts/testkit-core test` for the local suite.
- Source changes should stay compatible with Node 20+.

## AST-First SQL Policy
- Always call `SelectQueryParser`, `SelectAnalyzer`, or `splitQueries` from `rawsql-ts` when rewriting SQL.
- Regex merges (e.g., appending `WITH` clauses) are last-resort fallbacks. Log the fallback, explain it with a comment, and open an issue if the analyzer lacks a feature.
- When adding new rewrite capabilities, extend `SelectAnalyzer` to expose the metadata you need instead of re-parsing downstream.

## Fixture & Schema Guidelines
- Treat fixtures as authoritative: throw `MissingFixtureError` unless the caller explicitly opts into `warn`/`passthrough` strategies.
- Normalize identifiers via `normalizeIdentifier` before lookups; never trust caller casing.
- When schema lookups fail, surface actionable diagnostics that include table + column hints from `FixtureStore.describeColumns`.
- Use `SqliteValuesBuilder` to keep generated CTE rows deterministic; never string-build VALUES lists manually.

## Multi-Statement Rewrites
- Always split inputs with `splitQueries(sql)`; apply fixtures per statement and reassemble with `ensureTerminated` semantics to keep trailing semicolons consistent.
- Preserve the original statement order and whitespace by formatting each rewritten query individually and then joining them with a single space.

## Testing & Tooling
- Add Vitest cases under `tests/` that cover fixture combinations, AST fallbacks, and passthrough paths.
- For regression hunting, craft focused SQL samples rather than large fixtures; the SelectFixtureRewriter already has integration coverage in `tests/SelectFixtureRewriter.test.ts`.
- Run:
```
pnpm --filter @rawsql-ts/testkit-core lint
pnpm --filter @rawsql-ts/testkit-core test
pnpm --filter @rawsql-ts/testkit-core build
```
  before publishing or handing off work.

## Logging & Diagnostics
- Use `createLogger` hooks to emit debug traces when analyzers fail and the fallback path activates.
- Guard `logger.debug` / `logger.warn` calls to avoid crashing when the consumer passes a partial logger.

## Ready Checklist
1. New features documented in README snippets (usage + limitations).
2. Tests cover both AST success paths and fallback logic.
3. No raw regex parsing exists unless it is clearly marked as a temporary workaround.
