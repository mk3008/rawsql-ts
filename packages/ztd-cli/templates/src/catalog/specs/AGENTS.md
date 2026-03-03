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

Use `npx ztd model-gen <sql-file> --out src/catalog/specs/<spec-file>.ts` to derive the first QuerySpec scaffold from a live database.

- SQL assets are expected to use named parameters (`:name`).
- `ztd model-gen` is names-first and derives `sqlFile` / `spec id` from the SQL path under `src/sql` by default.
- Positional placeholders are legacy and should be rewritten whenever possible.
- Use `--allow-positional` only when a legacy SQL asset cannot be rewritten immediately.
- Review the generated file before commit: confirm nullability, cardinality, rowMapping key, runtime normalization, and example values.

# Hygiene
- Keep contract definitions isolated from runtime wiring and SQL implementation logic.

# References
- Parent catalog policy: [../AGENTS.md](../AGENTS.md)
