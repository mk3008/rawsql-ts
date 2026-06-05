# @rawsql-ts/sql-grep-core

![npm version](https://img.shields.io/npm/v/@rawsql-ts/sql-grep-core)
![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)

Low-dependency SQL usage analysis engine extracted from the former `@rawsql-ts/ztd-cli`.

`@rawsql-ts/sql-grep-core` powers reusable AST-based schema impact analysis. It scans SQL catalog specs, resolves their SQL files, parses statements with `rawsql-ts`, and reports table or column usage with deterministic machine-readable output.
Ashiba uses the same core capability for query usage and observed SQL lookup commands.

## What it provides

- Strict-first query target parsing
- SQL catalog spec discovery and lightweight spec loading
- Statement fingerprint generation for stable machine output
- Table and column usage analysis over `rawsql-ts` ASTs
- Observed SQL ranking for source-asset reverse lookup
- Impact and detail report formatting
- Optional span injection for host applications that want telemetry

## Runtime dependencies

- `rawsql-ts`

No CLI framework, watcher, diffing helper, or renderer is required at runtime.

## Typical use case

Use this package when you want the query usage engine without taking a dependency on a CLI package.

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

## Relationship to Ashiba

- `@ashiba-ts/cli` is the user-facing CLI surface for SQL lifecycle workflows.
- Ashiba query commands can delegate reusable analysis to `@rawsql-ts/sql-grep-core`.
- Telemetry and command-line UX stay in Ashiba; reusable analysis lives here.

## License

MIT
