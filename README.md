# rawsql-ts

![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)

A monorepo for **rawsql-ts**: a SQL-first toolkit for parsing, testing, inspecting, and evolving database applications while keeping raw SQL as a first-class asset.

By parsing SQL into abstract syntax trees, rawsql-ts enables type-safe query building, static validation, fixture-backed testing, and transparent result mapping while preserving the expressiveness and control of handwritten SQL. AST-based rewriting also powers Zero Table Dependency (ZTD) testkits, which transform application queries to run against in-memory fixtures instead of physical tables.

The former `@rawsql-ts/ztd-cli` package has moved to the Ashiba project as `@ashiba-ts/cli`. Use [mk3008/ashiba](https://github.com/mk3008/ashiba) for SQL-first scaffolding, command-line inspection, optional-condition maintenance, and project lifecycle workflows.

> [!Note]
> This project is currently in beta. APIs may change until the v1.0 release.

## Capability Index

Use this section as the shortest repo-level map. It is intentionally brief: package details live under each package README, while repo-level workflows point to the CLI or guide that owns them.

### Packaged Capabilities

| Capability | Primary surface | Start here |
|------------|-----------------|------------|
| SQL parsing and AST rewriting | `rawsql-ts` | [packages/core](./packages/core) |
| SQL impact analysis / grep | `@rawsql-ts/sql-grep-core` | [packages/sql-grep-core](./packages/sql-grep-core) |
| Execution helpers | `@rawsql-ts/executor` | [packages/executor](./packages/executor) |
| Production SQL driver adapter primitives | `@rawsql-ts/driver-adapter-core` | [packages/drivers/driver-adapter-core](./packages/drivers/driver-adapter-core) |
| ZTD fixture rewriting and testkits | `@rawsql-ts/testkit-*` | [packages/testkit-core](./packages/testkit-core) |
| Test evidence storage and rendering | `@rawsql-ts/test-evidence-*` | [packages/test-evidence-core](./packages/test-evidence-core) |
| Schema documentation generation | `@rawsql-ts/ddl-docs-*` | [packages/ddl-docs-cli](./packages/ddl-docs-cli) |
| Ashiba CLI workflows | `@ashiba-ts/cli` | [mk3008/ashiba](https://github.com/mk3008/ashiba) |

### Workflow Surfaces

These workflows are now owned by Ashiba. rawsql-ts keeps the reusable parser, formatter, testkit, binder, SQL grep, and documentation packages that Ashiba can consume.

| Workflow | Entry point | Why it matters |
|----------|-------------|----------------|
| SQL impact analysis before schema changes | `@rawsql-ts/sql-grep-core` / Ashiba query commands | Supports rename/type-change investigations using AST-based usage analysis. |
| SQL-first optional filter authoring | `rawsql-ts` SSSQL APIs / Ashiba query commands | Keeps optional filters visible in SQL while runtime pruning stays explicit. Runtime no longer injects new filter predicates. |
| Fixture-backed SQL unit testing | `@rawsql-ts/testkit-*` | Runs SQL against deterministic fixtures without a production database dependency. |
| Schema documentation generation | `@rawsql-ts/ddl-docs-*` | Generates reviewable Markdown schema documentation from DDL assets. |

## Packages

### Core

| Package | Version | Description |
|---------|---------|-------------|
| [rawsql-ts](./packages/core) | ![npm](https://img.shields.io/npm/v/rawsql-ts) | SQL parser and AST transformer. Zero dependencies, browser-ready. |
| [@rawsql-ts/sql-grep-core](./packages/sql-grep-core) | ![npm](https://img.shields.io/npm/v/@rawsql-ts/sql-grep-core) | Low-dependency SQL usage analysis engine for AST-based schema impact checks. |

### Production Driver Adapters

| Package | Version | Description |
|---------|---------|-------------|
| [@rawsql-ts/driver-adapter-core](./packages/drivers/driver-adapter-core) | ![npm](https://img.shields.io/npm/v/@rawsql-ts/driver-adapter-core) | Driver-neutral SQL client contract and named-parameter compilation helpers. |

### Execution

| Package | Version | Description |
|---------|---------|-------------|
| [@rawsql-ts/executor](./packages/executor) | ![npm](https://img.shields.io/npm/v/@rawsql-ts/executor) | Optional helper for connection lifecycle and transaction scope when you want less boilerplate while keeping execution ownership in the caller. |

### Testing

| Package | Version | Description |
|---------|---------|-------------|
| [@rawsql-ts/testkit-core](./packages/testkit-core) | ![npm](https://img.shields.io/npm/v/@rawsql-ts/testkit-core) | Fixture-backed CTE rewriting and schema validation engine. Driver-agnostic ZTD foundation. |
| [@rawsql-ts/testkit-postgres](./packages/testkit-postgres) | ![npm](https://img.shields.io/npm/v/@rawsql-ts/testkit-postgres) | Postgres-specific CTE rewriting and fixture validation. Works with any executor. |
| [@rawsql-ts/adapter-node-pg](./packages/adapters/adapter-node-pg) | ![npm](https://img.shields.io/npm/v/@rawsql-ts/adapter-node-pg) | Testkit adapter connecting `pg` (node-postgres) to `@rawsql-ts/testkit-postgres`; retained under its legacy name until a non-breaking `testkit-adapter-*` alias exists. |
| [@rawsql-ts/testkit-sqlite](./packages/testkit-sqlite) | ![npm](https://img.shields.io/npm/v/@rawsql-ts/testkit-sqlite) | SQLite-specific CTE rewriting and fixture validation. In-memory testing with `better-sqlite3`. |

### Adapter Package Spaces

`driver-adapter-*` packages are production runtime driver adapters.
They handle driver mechanics such as named-parameter compilation, placeholder conversion, and row-result normalization without owning ORM behavior or fixture rewriting.

`testkit-adapter-*` packages are test-only adapters that connect concrete drivers to ZTD/testkit fixture rewriting.
`@rawsql-ts/adapter-node-pg` currently belongs to that testkit adapter role despite its legacy name.
The planned rename path is to add a non-breaking alias such as `@rawsql-ts/testkit-adapter-node-postgres`, then document `@rawsql-ts/adapter-node-pg` as the legacy compatibility surface.

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

## Architecture

```text
rawsql-ts (core)
├─ @rawsql-ts/sql-grep-core
├─ @rawsql-ts/executor
├─ @rawsql-ts/driver-adapter-core
├─ @rawsql-ts/testkit-core
│  ├─ @rawsql-ts/testkit-postgres
│  │  └─ @rawsql-ts/adapter-node-pg
│  └─ @rawsql-ts/testkit-sqlite
├─ @rawsql-ts/ddl-docs-cli
│  └─ @rawsql-ts/ddl-docs-vitepress
└─ consumed by Ashiba for CLI workflows
```

## Quick Start

```bash
npm install rawsql-ts
```

See the [Core Package Documentation](./packages/core/README.md) for usage examples and API reference. For reusable AST-based impact analysis, see [@rawsql-ts/sql-grep-core](./packages/sql-grep-core). For CLI scaffolding and SQL lifecycle workflows, use [Ashiba](https://github.com/mk3008/ashiba).

## Intent and Procedure

Treat each query as one unit: 1 SQL file / 1 QuerySpec / 1 repository entrypoint / 1 DTO.

Keep handwritten SQL assets close to each feature in `src/features/<feature>/queries/<query>/` so the SQL, boundary contract, and query-local tests stay in one place.

Use this repo by treating DDL and SQL as source assets, and generated specs, repositories, and tests as downstream artifacts that must stay in sync.

Procedure: `DDL -> SQL -> generate -> wire -> test`.

For a step-by-step example, see the SQL-first tutorial above.

## Getting Started with AI

If you are using an AI coding agent, start with a short prompt that sets only the minimum project shape and domain language. You do **not** need to explain package-manager setup in that prompt.

Optional Docker helper:

If you want a local PostgreSQL 18 instance for ZTD tests, use a tiny compose file like this:

```yaml
services:
  postgres:
    image: postgres:18
    environment:
      POSTGRES_USER: ztd
      POSTGRES_PASSWORD: ztd
      POSTGRES_DB: ztd
    ports:
      - "5432:5432"
    volumes:
      - ztd-postgres-data:/var/lib/postgresql/data

volumes:
  ztd-postgres-data:
```

Then run `docker compose up -d` and point `ZTD_DB_URL` at that database for the fixture-backed rewrite path.

## Online Demo

[Try rawsql-ts in your browser](https://mk3008.github.io/rawsql-ts/)

## License

MIT
