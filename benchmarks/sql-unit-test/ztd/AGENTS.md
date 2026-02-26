# Package Scope
- Applies to `benchmarks/sql-unit-test/ztd`.
- Governs ZTD benchmark definitions, generated artifacts, DDL/domain specs, and enums used by benchmark scenarios.

# Policy
## REQUIRED
- `tests/generated/` artifacts MUST be regenerated via `npx ztd ztd-config` when missing or stale.
- Files under `ztd/ddl` MUST preserve human-authored structure and statement ordering unless explicitly instructed.
- DDL statements MUST remain semicolon-terminated valid PostgreSQL syntax.
- Domain spec files MUST keep one executable top-level SELECT block per file.
- Enum files MUST remain the authoritative source for enum key/value mappings.

## ALLOWED
- Proposing DDL/spec/enum edits MAY be done when explicitly requested.

## PROHIBITED
- Modifying `ztd/ddl` semantics without explicit human instruction.
- Reordering SQL/spec logic without explicit instruction.
- Inventing enum values not defined in enum sources.

# Mandatory Workflow
- If generated modules are missing or stale, run: `npx ztd ztd-config`.

# Hygiene
- Keep generated artifacts out of commits unless explicitly required by repository policy.

# References
- Parent benchmark contract: [../AGENTS.md](../AGENTS.md)
