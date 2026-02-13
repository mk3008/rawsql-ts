# rawsql-ts

![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)

A monorepo for **rawsql-ts** — a toolkit that treats raw SQL as a first-class citizen, enhancing maintainability and reusability through high-performance AST parsing and programmatic manipulation.

By parsing SQL into abstract syntax trees, rawsql-ts enables type-safe query building, static validation, and transparent result mapping — all while preserving the expressiveness and control of handwritten SQL. AST-based rewriting also powers Zero Table Dependency (ZTD) testing, which transforms application queries to run against in-memory fixtures instead of physical tables, enabling deterministic unit tests without database setup overhead.

Designed to complement — not replace — your SQL expertise.

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

### Testing

| Package | Version | Description |
|---------|---------|-------------|
| [@rawsql-ts/testkit-core](./packages/testkit-core) | ![npm](https://img.shields.io/npm/v/@rawsql-ts/testkit-core) | Fixture-backed CTE rewriting and schema validation engine. Driver-agnostic ZTD foundation. |
| [@rawsql-ts/testkit-postgres](./packages/testkit-postgres) | ![npm](https://img.shields.io/npm/v/@rawsql-ts/testkit-postgres) | Postgres-specific CTE rewriting and fixture validation. Works with any executor. |
| [@rawsql-ts/adapter-node-pg](./packages/adapters/adapter-node-pg) | ![npm](https://img.shields.io/npm/v/@rawsql-ts/adapter-node-pg) | Adapter connecting `pg` (node-postgres) to testkit-postgres. |
| [@rawsql-ts/sqlite-testkit](./packages/drivers/sqlite-testkit) | ![npm](https://img.shields.io/npm/v/@rawsql-ts/sqlite-testkit) | SQLite-specific CTE rewriting and fixture validation. In-memory testing with `better-sqlite3`. |

### CLI

| Package | Version | Description |
|---------|---------|-------------|
| [@rawsql-ts/ztd-cli](./packages/ztd-cli) | ![npm](https://img.shields.io/npm/v/@rawsql-ts/ztd-cli) | DB-agnostic scaffolding and DDL helpers for Zero Table Dependency projects. |

## Architecture

```
rawsql-ts (core)
├── @rawsql-ts/sql-contract
├── @rawsql-ts/testkit-core
│   ├── @rawsql-ts/testkit-postgres
│   │   └── @rawsql-ts/adapter-node-pg
│   └── @rawsql-ts/sqlite-testkit
└── @rawsql-ts/ztd-cli
```

## Quick Start

```bash
npm install rawsql-ts
```

See the [Core Package Documentation](./packages/core/README.md) for usage examples and API reference.

## Online Demo

[Try rawsql-ts in your browser](https://mk3008.github.io/rawsql-ts/)

## License

MIT
