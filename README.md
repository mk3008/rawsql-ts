# rawsql-ts

![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)

A monorepo for **rawsql-ts**: a SQL-first toolkit for parsing, testing, inspecting, and evolving database applications while keeping raw SQL as a first-class asset.

By parsing SQL into abstract syntax trees, rawsql-ts enables type-safe query building, static validation, and transparent result mapping — all while preserving the expressiveness and control of handwritten SQL. AST-based rewriting also powers Zero Table Dependency (ZTD) testing, which transforms application queries to run against in-memory fixtures instead of physical tables, enabling deterministic unit tests without database setup overhead. The repo additionally covers AST-based impact analysis, deterministic test evidence, schema documentation, and `ztd-cli` workflows for inspection and SQL artifact generation.

> [!Note]
> This project is currently in beta. APIs may change until the v1.0 release.

## Capability Index

Use this section as the shortest repo-level map. It is intentionally brief: package details live under each package README, while repo-level workflows point to the CLI or guide that owns them.

### Packaged Capabilities

| Capability | Primary surface | Start here |
|------------|-----------------|------------|
| SQL parsing and AST rewriting | `rawsql-ts` | [packages/core](./packages/core) |
| SQL impact analysis / grep | `@rawsql-ts/sql-grep-core` | [packages/sql-grep-core](./packages/sql-grep-core) |
| Type-safe result mapping | `@rawsql-ts/sql-contract` | [packages/sql-contract](./packages/sql-contract) |
| Execution helpers | `@rawsql-ts/executor` | [packages/executor](./packages/executor) |
| ZTD fixture rewriting and testkits | `@rawsql-ts/testkit-*` | [packages/testkit-core](./packages/testkit-core) |
| Test evidence storage and rendering | `@rawsql-ts/test-evidence-*` | [packages/test-evidence-core](./packages/test-evidence-core) |
| Schema documentation generation | `@rawsql-ts/ddl-docs-*` | [packages/ddl-docs-cli](./packages/ddl-docs-cli) |
| ZTD project scaffolding and SQL lifecycle tooling | `@rawsql-ts/ztd-cli` | [packages/ztd-cli/README.md](./packages/ztd-cli/README.md) |

### Workflow Surfaces

These capabilities are important at the repo level even though they are mostly exposed through `ztd-cli` commands rather than standalone packages.

| Workflow | Entry point | Why it matters |
|----------|-------------|----------------|
| SQL pipeline planning and dry-run optimization analysis | `ztd query plan`, `ztd perf run --dry-run` | Explains how SQL may be decomposed into stages before execution. |
| SQL impact analysis before schema changes | `ztd query uses` | Supports rename/type-change investigations using AST-based usage analysis. |
| SQL debug and recovery for long CTE queries | `ztd query outline`, `ztd query lint`, `ztd query slice`, `ztd query patch apply` | Helps isolate and repair problematic query shapes; `ztd query lint --rules join-direction` adds a FK-aware JOIN readability guard. |
| Explicit-target schema inspection and migration-prep workflow | `ztd ddl diff`, `ztd ddl pull` | Supports safe inspection against explicit target databases and generation of diff / patch SQL artifacts. Applying generated SQL is intentionally out of scope. |
| Machine-readable CLI automation and telemetry | `ztd --output json`, `ztd describe`, telemetry export modes | Supports AI/tooling integration and timing investigation. |

## Packages

### Core

| Package | Version | Description |
|---------|---------|-------------|
| [rawsql-ts](./packages/core) | ![npm](https://img.shields.io/npm/v/rawsql-ts) | SQL parser and AST transformer. Zero dependencies, browser-ready. |
| [@rawsql-ts/sql-grep-core](./packages/sql-grep-core) | ![npm](https://img.shields.io/npm/v/@rawsql-ts/sql-grep-core) | Low-dependency SQL usage analysis engine for AST-based schema impact checks. |

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

### Evidence

| Package | Version | Description |
|---------|---------|-------------|
| [@rawsql-ts/test-evidence-core](./packages/test-evidence-core) | ![npm](https://img.shields.io/npm/v/@rawsql-ts/test-evidence-core) | Core schema and storage model for deterministic test evidence. |
| [@rawsql-ts/test-evidence-renderer-md](./packages/test-evidence-renderer-md) | ![npm](https://img.shields.io/npm/v/@rawsql-ts/test-evidence-renderer-md) | Markdown renderer for saved test evidence reports. |

### Documentation

| Package | Version | Description |
|---------|---------|-------------|
| [@rawsql-ts/ddl-docs-cli](./packages/ddl-docs-cli) | ![npm](https://img.shields.io/npm/v/@rawsql-ts/ddl-docs-cli) | CLI that generates Markdown table definition docs from DDL files. |
| [@rawsql-ts/ddl-docs-vitepress](./packages/ddl-docs-vitepress) | ![npm](https://img.shields.io/npm/v/@rawsql-ts/ddl-docs-vitepress) | Scaffold generator for VitePress-based database schema documentation sites. |

### CLI

| Package | Version | Description |
|---------|---------|-------------|
| [@rawsql-ts/ztd-cli](./packages/ztd-cli) | ![npm](https://img.shields.io/npm/v/@rawsql-ts/ztd-cli) | SQL-first CLI for ZTD workflows, schema inspection, and migration SQL artifact generation. |

For the machine-readable CLI surface, see [ztd-cli Agent Interface](./docs/guide/ztd-cli-agent-interface.md) and [ztd-cli Describe Schema](./docs/guide/ztd-cli-describe-schema.md).

## Architecture

```text
rawsql-ts (core)
├─ @rawsql-ts/sql-grep-core
├─ @rawsql-ts/sql-contract
├─ @rawsql-ts/executor
├─ @rawsql-ts/testkit-core
│  ├─ @rawsql-ts/testkit-postgres
│  │  └─ @rawsql-ts/adapter-node-pg
│  └─ @rawsql-ts/testkit-sqlite
├─ @rawsql-ts/ddl-docs-cli
│  └─ @rawsql-ts/ddl-docs-vitepress
└─ @rawsql-ts/ztd-cli
   └─ uses @rawsql-ts/sql-grep-core for `query uses`
```

## Quick Start

```bash
npm install rawsql-ts
```

See the [Core Package Documentation](./packages/core/README.md) for usage examples and API reference. For reusable AST-based impact analysis, see [@rawsql-ts/sql-grep-core](./packages/sql-grep-core). For repo-level SQL lifecycle workflows, inspection commands, and ZTD project guidance, see [@rawsql-ts/ztd-cli](./packages/ztd-cli/README.md). Deterministic dogfooding spec: [docs/dogfooding/DOGFOODING.md](./docs/dogfooding/DOGFOODING.md).

## Tutorials

- [SQL-first End-to-End Tutorial](./docs/guide/sql-first-end-to-end-tutorial.md) - Walk from DDL to `ztd-config`, `model-gen`, repository wiring, and the first passing smoke test in one focused path.

## Intent and Procedure

Treat each query as one unit: 1 SQL file / 1 QuerySpec / 1 repository entrypoint / 1 DTO.

Keep handwritten SQL assets in `src/sql/` as the single human-owned source location for query logic.

Use this repo by treating DDL and SQL as source assets, and generated specs, repositories, and tests as downstream artifacts that must stay in sync.

Procedure: `DDL -> SQL -> generate -> wire -> test`.

For a step-by-step example, see the SQL-first tutorial above.

## CLI Tool Routing Happy Paths

- SQL pipeline / debug → `ztd query plan <sql-file>`
- Impact analysis → `ztd query uses <target>`
- Schema inspection → `ztd ddl diff --url <target>`

For the full routing guide and decision table, see [SQL Tool Happy Paths](./docs/guide/sql-tool-happy-paths.md).

## Database Boundary at a Glance

For repo-level workflows, keep this boundary in mind:

* `ZTD_TEST_DATABASE_URL` is the only implicit database input used by `ztd-cli`
* `DATABASE_URL` is typically an application/runtime/deployment concern and is not read automatically by `ztd-cli`
* any non-ZTD database target must be supplied explicitly via `--url` or `--db-*`
* migration SQL artifacts may be generated by `ztd-cli`, but apply / deployment execution remains outside its ownership

This boundary exists for both AI-driven and human-driven workflows. It keeps test, inspection, and deployment concerns from silently collapsing into a single default database model.

## Online Demo

[Try rawsql-ts in your browser](https://mk3008.github.io/rawsql-ts/)

## License

MIT
