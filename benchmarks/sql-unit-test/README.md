# SQL unit test benchmark helpers

This directory holds the tooling that lets benchmark authors invoke the local `ztd-cli` while working on the SQL unit tests.

## Preparing the workspace

1. Run `pnpm --filter @rawsql-ts/ztd-cli build` at the repository root to keep `packages/ztd-cli/dist/index.js` up to date with the source.
2. Change into this folder and run `pnpm install` so that `node_modules/.bin/ztd` is linked to the local `@rawsql-ts/ztd-cli` package via `link:../../packages/ztd-cli`.

Because the dependency uses `link:../../packages/ztd-cli`, the command does not pull from the npm registry and always executes the local source tree.

## Running the local CLI from here

Use `npx ztd <command>` or `pnpm run ztd -- <command>` to execute the `ztd` binary. Both invocations resolve to `node_modules/.bin/ztd`, which runs the locally linked CLI that mirrors `packages/ztd-cli`.

If you change CLI code, rebuild it via `pnpm --filter @rawsql-ts/ztd-cli build` before rerunning these commands.
