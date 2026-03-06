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
## Local Publish
- Create a changeset with `pnpm changeset`.
- Apply versioning with `pnpm changesets:version`.
- Build every publishable workspace package with `pnpm build:publish`.
- Before committing changes under `packages/ddl-docs-cli`, run:
  `pnpm --filter @rawsql-ts/ddl-docs-cli lint`
  `pnpm --filter @rawsql-ts/ddl-docs-cli test`
  `pnpm --filter @rawsql-ts/ddl-docs-cli build`
- Validate the changed packages with `pnpm --filter <package> pack --dry-run` before publishing.
- Publish from a local machine with `pnpm changeset publish` only after npm auth and OTP are ready.
- If publish fails in `prepack`, inspect the package `main`/`bin` paths against the actual `dist/` output before retrying.



