---
title: Feature Index
---

# Feature Index

An at-a-glance index of easy-to-miss but important capabilities across the rawsql-ts ecosystem. Each entry tells you **what it is**, **where to find it**, and **when to use it**.

## CLI (`ztd`)

| Feature | Command / Location | When to use |
|---------|-------------------|-------------|
| Non-interactive init | `ztd init --yes --workflow demo --validator zod` | CI/CD pipelines, agent-driven scaffolding |
| DDL pull from live DB | `ztd ddl pull` | Bootstrap DDL from an existing Postgres database |
| DDL diff | `ztd ddl diff` | Compare local DDL against a live database after changes |
| Watch mode | `ztd ztd-config --watch` | Continuous type regeneration while editing DDL |
| Quiet mode | `ztd ztd-config --quiet` | Suppress next-step hints in scripts |
| SQL linting | `ztd lint <path>` | Validate SQL files against the schema |
| Contract check | `ztd check-contract` | Verify catalog contract integrity |
| Test evidence export | `ztd evidence --mode specification` | Generate specification reports from tests |
| Entity generation | `ztd ddl gen-entities` | Create `entities.ts` for ad-hoc schema inspection |

## sql-contract

| Feature | Location | When to use |
|---------|----------|-------------|
| Auto snake_case → camelCase | `createReader(executor)` default | When column names follow SQL conventions |
| Safe mode (no transform) | `createReader(executor, mapperPresets.safe())` | When you want raw column names |
| Row mapping | `rowMapping({ name, key, columnMap })` | Explicit column-to-property mapping |
| Multi-model mapping | `rowMapping(...).belongsTo(name, mapping, fk)` | Nested objects from JOINed results |
| Composite keys | `key: ['col_a', 'col_b']` or `key: (row) => [...]` | Tables with multi-column primary keys |
| Validator chaining | `.validator(v1).validator(v2)` | Multiple validation stages |
| Scalar queries | `reader.scalar(sql, params)` | COUNT, aggregate values, RETURNING id |
| Catalog executor | `createCatalogExecutor({ loader, executor })` | File-backed SQL with observability |
| Observability sink | `observabilitySink: { emit(event) {} }` | Query lifecycle logging |
| Runtime coercions | `timestampFromDriver` | Normalize driver-dependent timestamp types |

## Templates & Project Structure

| Feature | Location | When to use |
|---------|----------|-------------|
| SqlClient interface | `src/db/sql-client.ts` | Define the app ↔ driver boundary |
| SqlClient adapter (pg) | `src/db/sql-client-adapters.ts` | Convert `pg` Client/Pool to SqlClient |
| Runtime coercions | `src/catalog/runtime/_coercions.ts` | Driver-type normalization before validation |
| AGENTS.md guidance | Every directory | AI-assisted development context |
| Spec files | `src/catalog/specs/` | Define catalog contracts with validators |
| Global test setup | `tests/support/global-setup.ts` | Test-runner initialization hooks |

## Documentation

| Guide | Path | When to read |
|-------|------|-------------|
| Happy Path Quickstart | [ztd-cli README](../../packages/ztd-cli/README.md#happy-path-quickstart) | First-time setup |
| After DDL Changes | [ztd-cli README](../../packages/ztd-cli/README.md#after-ddlschema-changes) | Schema evolution workflow |
| Mapping vs Validation pipeline | [recipes/mapping-vs-validation](../recipes/mapping-vs-validation.md) | Avoid coerce/validator conflicts |
| Postgres Pitfalls | [guide/postgres-pitfalls](./postgres-pitfalls.md) | Postgres-specific quirks |
| Spec-Change Scenarios | [guide/spec-change-scenarios](./spec-change-scenarios.md) | Quick reference for common changes |
| Query Uses Overview | [guide/query-uses-overview](./query-uses-overview.md) | Why static analysis beats grep, human vs machine output |
| Query Uses Impact Checks | [guide/query-uses-impact-checks](./query-uses-impact-checks.md) | Full option reference, scenario playbook, troubleshooting |
| ztd-cli Agent Interface | [guide/ztd-cli-agent-interface](./ztd-cli-agent-interface.md) | Machine-readable CLI usage for automation and AI agents |
| ztd describe schema | [guide/ztd-cli-describe-schema](./ztd-cli-describe-schema.md) | Contract details for `ztd describe` JSON payloads |
| Validation (Zod) | [recipes/validation-zod](../recipes/validation-zod.md) | Wire Zod schemas |
| Validation (ArkType) | [recipes/validation-arktype](../recipes/validation-arktype.md) | Wire ArkType schemas |
| SQL catalog recipe | [recipes/sql-contract](../recipes/sql-contract.md) | Catalog executor patterns |
| Execution scope | [guide/execution-scope](./execution-scope.md) | Transaction and connection control |
| ZTD Theory | [guide/ztd-theory](./ztd-theory.md) | Conceptual foundation |
