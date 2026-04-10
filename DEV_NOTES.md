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
- For SQL-backed test failures, first confirm whether the SQL is shadowing the intended path or accidentally touching a physical table directly.
- If shadowing is wrong, check in this order: DDL and fixture sync, fixture selection or specification, repository bug or rewriter bug.
- Do not use DDL execution as a repair path for ZTD validation failures.
- If the database is reachable, treat relation or missing-table errors as a shadowing, fixture, or repository problem before considering schema changes.

## Branch Session Guard
- After switching to the intended branch for this local worktree, record it with `pnpm guard:branch-session expect-current`.
- If you need to record a named branch explicitly, use `pnpm guard:branch-session expect --branch <branch-name>`.
- `pre-push` blocks when no expected branch is recorded, when the current branch differs from the recorded branch, or when the worktree is in detached HEAD state.
- The guard proves only that this local worktree is still on the branch declared for the session; it does not prove task correctness or prevent bypass outside the local hook path.

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



