# rawsql-ts Workspace

## Scope
- Monorepo that houses the rawsql-ts parser plus supporting packages (`packages/core`, `packages/testkit-core`, `packages/drivers/sqlite-testkit`, `packages/rawsql-ts-cli`).
- Use this file for repo-wide rules; each package with extra constraints has its own `AGENTS.md` nearby.

## Working Agreements
- Use `pnpm` for workspace tasks; prefer `pnpm --filter <package> <command>` for targeted work.
- Docs, code comments, and identifiers stay in English even if discussions happen in other languages.
- Place throwaway assets under `./tmp` and delete them when you are done.
- Keep console debugging local-remove `console.log`/`Debugger` statements before sending patches.

## SQL Parsing Policy (AST First)
- Any package that touches SQL (core parser, testkit-core, driver adapters, CLI) must rely on `rawsql-ts` AST utilities (`SelectQueryParser`, `SelectAnalyzer`, `splitQueries`, etc.).
- Regex-based rewrites are acceptable only as guarded fallbacks; include comments that explain why AST analysis could not be used and open an issue when the fallback becomes persistent.
- When reviewing contributions, block changes that introduce new regex parsing paths if an AST-driven alternative exists or can be added.

## Validation Checklist
1. `pnpm lint` - formatting + ESLint across the workspace.
2. `pnpm test` - fast regression sweep; use `pnpm --filter <pkg> test` for focused runs.
3. `pnpm build` - ensures TS project references compile before publishing.
4. Large changes touching SQL rewriting should also run `pnpm benchmark` or targeted demos when applicable (see package-level AGENTS).

## Collaboration Tips
- Follow the TDD loop (Red -> Compile -> Green -> Refactor) to keep fixtures and AST updates safe.
- Prefer incremental commits scoped to one package; cross-package changes should note dependency order in the commit message.
- Before editing a sub-package, read its local `AGENTS.md` for package-specific workflows (fixture schema rules, driver setup, etc.).

## Updating the Docs Demos
- When you ship parser/formatter features that should appear in the hosted demos, rebuild the browser bundle used under `docs/public/demo/vendor/rawsql.browser.js`.
- Run `pnpm --filter rawsql-ts build:browser` inside the workspace to refresh `packages/core/dist` (includes the browser config that rewrites relative imports) and keep `dist/esm/src/index.js` up to date.
- Re-bundle the demo artifact with `pnpm --filter rawsql-ts exec esbuild src/index.ts --bundle --platform=browser --format=esm --target=es2022 --minify-syntax --minify-whitespace --outfile=../../docs/public/demo/vendor/rawsql.browser.js`. This produces a compressed `rawsql.browser.js` that the cud-demo, migration-demo, and other docs frontends import.
- After the rebuild, inspect `git status` for `docs/public/demo/vendor/rawsql.browser.js` and include the updated bundle in the same change so the demos immediately reflect the latest code.

## Public API Documentation
- In `src/` code, any class, interface, or type that the package exposes to the outside (i.e., re-exported through `index.ts` or otherwise part of the published entry points) must carry a clear English JSDoc comment explaining its intent and usage. This keeps the public surface well documented for downstream consumers.
