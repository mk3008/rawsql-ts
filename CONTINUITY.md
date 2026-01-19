Goal (including success criteria):
- Reduce empty "Updated dependencies" releases in issue #409 by defaulting publishable internal dependencies to `workspace:^`, keeping independent Changesets, documenting the policy, and ensuring the workspace builds/tests cleanly after the spec change.

Constraints / Assumptions:
- Continue obeying AGENTS policies (Japanese answers, English docstrings/comments, ./tmp for throwaways, no extra branches, etc.).
- `.changeset/config.json` must stay in independent mode (no fixed/linked groups) with `updateInternalDependencies: "patch"` and the playground ignored, so only dependency specifiers change.
- Avoid bumping package versions manually and let Changesets handle changelog/version updates.

Key decisions:
- Convert internal publishable dependencies from `workspace:*` to `workspace:^` so dependency-only updates no longer trigger releases unless a dependent package is touched.
- Add a short README note clarifying the internal dependency policy (workspace:^ by default, workspace:* only when strict lockstep is required).
- Run `pnpm install`, `pnpm lint`, and the `pnpm --filter` test suites for each touched publishable package to ensure CI compliance.

- `packages/{testkit-core,testkit-postgres,adapters/adapter-node-pg,drivers/sqlite-testkit,ztd-cli}` now use `workspace:^` for internal dependencies, `README.md` documents the release-PR workflow plus the `workspace:^` policy, `packages/sql-contract/package.json` reverted to `0.0.0` so versions stay Changeset-driven, and `pnpm-lock.yaml` reflects the spec changes after `pnpm install`.
- Verification consists of a successful `pnpm lint` plus targeted `pnpm --filter` `vitest` runs for the affected packages.

Done:
- Updated the relevant package manifests, README note, and lockfile, and ran the requested install/lint/test commands.

Now:
- Keep the staged set limited to these manifest changes so a concise `review_request.md` can be generated if needed.

Next:
- Monitor future release PRs to confirm fewer dependency-only bumps and follow the documented policy for new internal dependencies.

Open questions (mark as UNCONFIRMED if needed):
- None at this time.

Working set (files, ids, commands):
- packages/adapters/adapter-node-pg/package.json
- packages/drivers/sqlite-testkit/package.json
- packages/testkit-core/package.json
- packages/testkit-postgres/package.json
- packages/ztd-cli/package.json
- README.md
- pnpm-lock.yaml
