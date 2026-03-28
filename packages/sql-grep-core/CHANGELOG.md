# @rawsql-ts/sql-grep-core

## 0.1.6

### Patch Changes

- [#682](https://github.com/mk3008/rawsql-ts/pull/682) [`07eb7fd`](https://github.com/mk3008/rawsql-ts/commit/07eb7fdda0b932f3f6bc13d58767e57927d6707e) Thanks [@mk3008](https://github.com/mk3008)! - The starter README now stays focused on entry points, while the repository telemetry setup and observed SQL investigation flows are documented in separate guides.

  You can now follow step-by-step instructions for editing the generated telemetry scaffold, emitting safe structured logs, reviewing queryId-based incidents, and running `ztd query match-observed` when `queryId` is missing.

- Updated dependencies [[`be9b689`](https://github.com/mk3008/rawsql-ts/commit/be9b6893ff42f783f9cb52f1b8cd9cdc6c120e23)]:
  - rawsql-ts@0.18.0

## 0.1.5

### Patch Changes

- [#653](https://github.com/mk3008/rawsql-ts/pull/653) [`4540a22`](https://github.com/mk3008/rawsql-ts/commit/4540a22a57c600cbd4f4dbe2fe160cd8da1fb12e) Thanks [@mk3008](https://github.com/mk3008)! - Improve `query uses` for feature-local VSA projects by discovering QuerySpec files from the project tree, preferring spec-relative SQL resolution, and clarifying the VSA-first impact-analysis contract in docs and CLI help.

## 0.1.4

### Patch Changes

- [#628](https://github.com/mk3008/rawsql-ts/pull/628) [`5d15113`](https://github.com/mk3008/rawsql-ts/commit/5d151130b492b0bfbb787a1410ceb1eeee0683e6) Thanks [@mk3008](https://github.com/mk3008)! - Replace workspace-only dependency ranges in published package manifests with publishable semver ranges so standalone consumers can install these packages without workspace resolution errors.

## 0.1.3

### Patch Changes

- [#583](https://github.com/mk3008/rawsql-ts/pull/583) [`214bb0a`](https://github.com/mk3008/rawsql-ts/commit/214bb0a8d6ceffb193e78d7531d78d6d2182b34a) Thanks [@mk3008](https://github.com/mk3008)! - Fix `@rawsql-ts/sql-grep-core` so its publish artifact build no longer fails on parser result typing and `rawsql-ts` import resolution during pack.

## 0.1.2

### Patch Changes

- [#571](https://github.com/mk3008/rawsql-ts/pull/571) [`6fd0afa`](https://github.com/mk3008/rawsql-ts/commit/6fd0afa9b3faef0e41ba6a56e3d40fc507a9172a) Thanks [@mk3008](https://github.com/mk3008)! - Fix published package manifests so npm consumers do not receive `workspace:` dependency ranges when installing `@rawsql-ts/ztd-cli` and its internal runtime dependencies.

## 0.1.1

### Patch Changes

- Updated dependencies [[`b56a3fa`](https://github.com/mk3008/rawsql-ts/commit/b56a3fa82763c4120f73b2cec9f295c55c951609)]:
  - rawsql-ts@0.17.0
