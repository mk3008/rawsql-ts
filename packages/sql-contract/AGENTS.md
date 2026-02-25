# Package Scope
- Applies to `packages/sql-contract`.
- Provides mapping and writer helpers between raw SQL results and typed application shapes.
- Maintains a non-ORM boundary for explicit SQL contracts.

# Policy
## REQUIRED
- Mapping and writer behavior MUST stay schema-agnostic.
- Mapper behavior MUST use explicit caller-provided mapping controls.
- Writer outputs MUST expose visible SQL text and ordered params.
- Identifier validation MUST enforce safe identifier rules unless explicit unsafe mode is enabled.
- Ambiguous mappings or unsafe key conditions MUST fail fast.

## ALLOWED
- Caller-supplied DBMS-specific coercion MAY be provided through explicit options.
- Unsafe identifier mode MAY be enabled only through explicit opt-in.

## PROHIBITED
- Adding ORM/query-builder inference behavior.
- Inferring schema metadata, DDL metadata, or relationships from database introspection.
- Hiding SQL generation behind implicit writer behavior.

# Mandatory Workflow
- Before committing changes under `packages/sql-contract`, these commands MUST pass:
  - `pnpm --filter @rawsql-ts/sql-contract lint`
  - `pnpm --filter @rawsql-ts/sql-contract test`
  - `pnpm --filter @rawsql-ts/sql-contract build`

# Hygiene
- Debug logging and temporary artifacts MUST be removed before commit.

# References
- Rationale: [DESIGN.md](./DESIGN.md)
- Operational notes: [DEV_NOTES.md](./DEV_NOTES.md)
