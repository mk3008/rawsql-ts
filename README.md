# rawsql-ts

![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)

A monorepo for **rawsql-ts**: a toolkit that treats raw SQL as a first-class citizen, enhancing maintainability and reusability through high-performance AST parsing and programmatic manipulation.

By parsing SQL into abstract syntax trees, rawsql-ts enables type-safe query building, static validation, and transparent result mapping, all while preserving the expressiveness and control of handwritten SQL. AST-based rewriting also powers Zero Table Dependency (ZTD) testing, which transforms application queries to run against in-memory fixtures instead of physical tables, enabling deterministic unit tests without database setup overhead.

Designed to complement, not replace, your SQL expertise.

> [!Note]
> This project is currently in beta. APIs may change until the v1.0 release.

## Packages

### Core

| Package | Version | Description |
|---------|---------|-------------|
| [rawsql-ts](./packages/core) | ![npm](https://img.shields.io/npm/v/rawsql-ts) | SQL parser and AST transformer. Zero dependencies, browser-ready. |

### Contract

| Package | Version | Description |
|---------|---------|-------------|
| [@rawsql-ts/sql-contract](./packages/sql-contract) | ![npm](https://img.shields.io/npm/v/@rawsql-ts/sql-contract) | Type-safe result mapping for raw SQL queries. Driver and validator agnostic. |

### Execution

| Package | Version | Description |
|---------|---------|-------------|
| [@rawsql-ts/executor](./packages/executor) | ![npm](https://img.shields.io/npm/v/@rawsql-ts/executor) | Optional helper for connection lifecycle and transaction scope when you want less boilerplate while keeping execution ownership in the caller. |

### Testing

| Package | Version | Description |
|---------|---------|-------------|
| [@rawsql-ts/testkit-core](./packages/testkit-core) | ![npm](https://img.shields.io/npm/v/@rawsql-ts/testkit-core) | Fixture-backed CTE rewriting and schema validation engine. Driver-agnostic ZTD foundation. |
| [@rawsql-ts/testkit-postgres](./packages/testkit-postgres) | ![npm](https://img.shields.io/npm/v/@rawsql-ts/testkit-postgres) | Postgres-specific CTE rewriting and fixture validation. Works with any executor. |
| [@rawsql-ts/adapter-node-pg](./packages/adapters/adapter-node-pg) | ![npm](https://img.shields.io/npm/v/@rawsql-ts/adapter-node-pg) | Adapter connecting `pg` (node-postgres) to testkit-postgres. |
| [@rawsql-ts/testkit-sqlite](./packages/testkit-sqlite) | ![npm](https://img.shields.io/npm/v/@rawsql-ts/testkit-sqlite) | SQLite-specific CTE rewriting and fixture validation. In-memory testing with `better-sqlite3`. |

### Documentation

| Package | Version | Description |
|---------|---------|-------------|
| [@rawsql-ts/ddl-docs-cli](./packages/ddl-docs-cli) | ![npm](https://img.shields.io/npm/v/@rawsql-ts/ddl-docs-cli) | CLI that generates Markdown table definition docs from DDL files. |
| [@rawsql-ts/ddl-docs-vitepress](./packages/ddl-docs-vitepress) | ![npm](https://img.shields.io/npm/v/@rawsql-ts/ddl-docs-vitepress) | Scaffold generator for VitePress-based database schema documentation sites. |

### CLI

| Package | Version | Description |
|---------|---------|-------------|
| [@rawsql-ts/ztd-cli](./packages/ztd-cli) | ![npm](https://img.shields.io/npm/v/@rawsql-ts/ztd-cli) | DB-agnostic scaffolding and DDL helpers for Zero Table Dependency projects. |

For the machine-readable CLI surface, see [ztd-cli Agent Interface](./docs/guide/ztd-cli-agent-interface.md) and [ztd-cli Describe Schema](./docs/guide/ztd-cli-describe-schema.md).

## Architecture

```text
rawsql-ts (core)
├─ @rawsql-ts/sql-contract
├─ @rawsql-ts/executor
├─ @rawsql-ts/testkit-core
│  ├─ @rawsql-ts/testkit-postgres
│  │  └─ @rawsql-ts/adapter-node-pg
│  └─ @rawsql-ts/testkit-sqlite
├─ @rawsql-ts/ddl-docs-cli
│  └─ @rawsql-ts/ddl-docs-vitepress
└─ @rawsql-ts/ztd-cli
```

## Quick Start

```bash
npm install rawsql-ts
```

See the [Core Package Documentation](./packages/core/README.md) for usage examples and API reference. Deterministic dogfooding spec: [docs/dogfooding/DOGFOODING.md](./docs/dogfooding/DOGFOODING.md).

## CLI Tool Routing Happy Paths

When the question is "which CLI should I run first?", start from the problem shape instead of the full command catalog.

| Goal | First command | Follow-up | Why |
|------|---------------|-----------|-----|
| Understand how a SQL asset will be split into pipeline steps | `npx ztd query plan <sql-file>` | `npx ztd perf run --dry-run` | Plan shows the intended materialization / scalar filter binding order before you benchmark or execute anything. |
| Find optimizer-sensitive rewrite candidates in a real query | `npx ztd perf run --dry-run` | `npx ztd query plan <sql-file>` | Perf analysis highlights materialization and scalar-filter candidates so you can decide whether a pipeline rewrite is worth it. |
| Inspect where a table or column is used before refactoring | `npx ztd query uses <target>` | `npx ztd query lint <path>` | `query uses` is the impact-analysis path; it is not a performance debugging tool. |
| Debug generated SQL shape, rewritten predicates, or temp-table flow | `npx ztd query plan <sql-file>` | Scenario-specific SQL/debug workflow from [SQL Tool Happy Paths](./docs/guide/sql-tool-happy-paths.md) | Start with the structural plan, then move to command-specific debugging once you know which stage is suspicious. |
| Investigate command timings or export machine-readable traces | Telemetry guidance in [SQL Tool Happy Paths](./docs/guide/sql-tool-happy-paths.md) | [ztd-cli telemetry philosophy](./docs/guide/ztd-cli-telemetry-philosophy.md) | Telemetry is an opt-in investigation branch, not the default entry point. |

Recommended shortest loop for SQL pipeline dogfooding:

1. Run `npx ztd query plan <sql-file>` to confirm the proposed stages.
2. Run `npx ztd perf run --dry-run` to see whether the query exposes materialization or scalar-filter opportunities.
3. Run the focused SQL/debug or integration check for the suspected stage.
4. Use `npx ztd query uses <target>` only when the task is impact analysis or refactoring, not pipeline tuning.

For the full routing guide, see [SQL Tool Happy Paths](./docs/guide/sql-tool-happy-paths.md).

## Online Demo

[Try rawsql-ts in your browser](https://mk3008.github.io/rawsql-ts/)

## License

MIT
