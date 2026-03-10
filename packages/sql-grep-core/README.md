# @rawsql-ts/sql-grep-core

![npm version](https://img.shields.io/npm/v/@rawsql-ts/sql-grep-core)
![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)

Low-dependency SQL usage analysis engine extracted from `@rawsql-ts/ztd-cli`.

`@rawsql-ts/sql-grep-core` powers `ztd query uses` and exposes the reusable AST-based schema impact analysis primitives behind that command. It scans SQL catalog specs, resolves their SQL files, parses statements with `rawsql-ts`, and reports table or column usage with deterministic machine-readable output.

## What it provides

- Strict-first query target parsing
- SQL catalog spec discovery and lightweight spec loading
- Statement fingerprint generation for stable machine output
- Table and column usage analysis over `rawsql-ts` ASTs
- Impact and detail report formatting
- Optional span injection for host applications that want telemetry

## Runtime dependencies

- `rawsql-ts`

No CLI framework, watcher, diffing helper, or renderer is required at runtime.

## Typical use case

Use this package when you want the `ztd query uses` engine without taking a dependency on the rest of `ztd-cli`.

```ts
import { buildQueryUsageReport, formatQueryUsageReport } from '@rawsql-ts/sql-grep-core';

const report = buildQueryUsageReport({
  kind: 'table',
  rawTarget: 'public.users',
  rootDir: process.cwd(),
  view: 'impact',
});

console.log(formatQueryUsageReport(report, 'text'));
```

## Relationship to ztd-cli

- `@rawsql-ts/ztd-cli` remains the user-facing CLI surface.
- `ztd query uses` now delegates its analysis engine to `@rawsql-ts/sql-grep-core`.
- Telemetry and command-line UX stay in `ztd-cli`; reusable analysis lives here.

## License

MIT
