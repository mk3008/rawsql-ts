# Package Scope
- Applies to `packages/ztd-cli/templates/src/catalog/specs`.
- Defines human-owned query/command contracts for params, DTOs, and semantics.

# Policy
## REQUIRED
- Specs MUST define public input and output validators.
- Specs MUST preserve declared parameter shape, DTO shape, nullability, cardinality, and semantics.
- Driver-dependent normalization behavior MUST be specified for runtime handling, not SQL workaround encoding.

## ALLOWED
- Specs MAY acknowledge driver representation variance when runtime normalization is defined.

## PROHIBITED
- Inferring or modifying contract shape without explicit instruction.
- Adding executors, DB connections, or ZTD internal dependencies.

# Mandatory Workflow
- Contract changes MUST run tests that validate success and failure paths.

## Generating initial output types

Use `npx ztd model-gen <sql-file> --probe-mode ztd --out <spec-file>.ts` to derive the first QuerySpec scaffold from the local DDL snapshot.

- SQL assets are expected to use named parameters (`:name`).
- `ztd model-gen` is names-first and treats the SQL file location as the primary contract source in feature-local layouts.
- In VSA layouts, prefer keeping the generated spec next to the SQL asset so the scaffold emits a local `./query.sql` contract naturally.
- Use `--sql-root` only when the project intentionally keeps SQL under a shared root and you need compatibility with that older layout.
- `ztd model-gen --probe-mode ztd` is the recommended fast-loop path when the referenced schema already exists in `db/ddl/*.sql`.
- In `--probe-mode ztd`, unqualified table references follow the configured `defaultSchema` / `searchPath` priority from `ztd.config.json`.
- The CLI default remains `--probe-mode live` for backward compatibility, but project guidance should treat `--probe-mode ztd` as the preferred inner-loop mode.
- `ztd model-gen --probe-mode ztd` uses the ZTD-owned test database from `ZTD_DB_URL`.
- `ztd model-gen --probe-mode live` is an explicit target inspection path and MUST be used with `--url` or a complete `--db-*` flag set.
- `DATABASE_URL` is a runtime concern and is not read implicitly by `ztd-cli`.
- Positional placeholders are legacy and should be rewritten whenever possible.
- Use `--allow-positional` only when a legacy SQL asset cannot be rewritten immediately.
- Review the generated file before commit: confirm imports, nullability, cardinality, rowMapping key, runtime normalization, and example values.

# Hygiene
- Keep contract definitions isolated from runtime wiring and SQL implementation logic.

# References
- Parent catalog policy: [../AGENTS.md](../AGENTS.md)
