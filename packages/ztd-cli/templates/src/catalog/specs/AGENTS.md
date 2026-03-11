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

Use `npx ztd model-gen <sql-file> --probe-mode ztd --out src/catalog/specs/<spec-file>.ts` to derive the first QuerySpec scaffold from the local DDL snapshot.

- SQL assets are expected to use named parameters (`:name`).
- `ztd model-gen` is names-first and derives `sqlFile` / `spec id` from the SQL path under `src/sql` by default.
- `ztd model-gen --probe-mode ztd` is the recommended fast-loop path when the referenced schema already exists in `ztd/ddl/*.sql`.
- In `--probe-mode ztd`, unqualified table references follow the configured `defaultSchema` / `searchPath` priority from `ztd.config.json`.
- The CLI default remains `--probe-mode live` for backward compatibility, but project guidance should treat `--probe-mode ztd` as the preferred inner-loop mode.
- `ztd model-gen --probe-mode live` requires the referenced schema objects to exist in the connected database.
- `ztd model-gen --probe-mode live` is optional and should be reserved for objects that are intentionally missing from local DDL or for checking currently deployed metadata.
- Positional placeholders are legacy and should be rewritten whenever possible.
- Use `--allow-positional` only when a legacy SQL asset cannot be rewritten immediately.
- Review the generated file before commit: confirm imports, nullability, cardinality, rowMapping key, runtime normalization, and example values.

# Hygiene
- Keep contract definitions isolated from runtime wiring and SQL implementation logic.

# References
- Parent catalog policy: [../AGENTS.md](../AGENTS.md)
