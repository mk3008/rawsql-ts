# Repository Dev Notes

## Commands
- `pnpm format`
- `pnpm lint:fix`
- `pnpm lint`
- `pnpm test` or `pnpm --filter <pkg> test`
- `pnpm build`
- `pnpm --filter rawsql-ts build`

## Troubleshooting
- Observe first: capture `git status`, `git diff`, recent log, and failing test/lint/build outputs before changing files.
- Re-run failed commands after each minimal fix.
- Re-run `pnpm --filter rawsql-ts build` when CLI tests report stale dist artifacts.

## Docs and Demo Operations
- Rebuild browser bundle for parser/formatter behavior updates.
- Re-bundle docs demo and update bundled assets.
