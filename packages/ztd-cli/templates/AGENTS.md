# Package Scope
- Applies to `packages/ztd-cli/templates`.
- Defines repository-wide guardrails for generated project templates.
- Provides parent rules for runtime (`src`), tests (`tests`), and metadata (`ztd`) without forcing one application style on every subtree.

# Policy
## REQUIRED
- The nearest nested `AGENTS.md` MUST be treated as highest-priority policy for edited files.
- Unknown facts during template work MUST be reported as `Not observed` with the next check.
- Generated artifacts MUST remain unedited unless explicit instruction exists.
- Preserve layer boundaries: transport, application, domain, and infrastructure concerns MUST remain explicit when those directories exist.
- Human-owned contract directories (`ztd/ddl`, `src/catalog/specs`, `src/sql`) MUST NOT be semantically changed without explicit instruction.
- Template output MUST include runnable test configuration at initialization.

## ALLOWED
- AI-assisted implementation MAY occur in infrastructure adapters, catalog runtime, and tests excluding `tests/generated`.

## PROHIBITED
- Manual edits under `tests/generated`.
- Treating ZTD-specific workflow rules as repository-global rules.

# Mandatory Workflow
- Template changes MUST preserve an executable `pnpm test` path for initialized projects.

# Hygiene
- Keep directory-local deltas in child `AGENTS.md`; avoid restating parent rules in child files.

# References
- Rationale: [DESIGN.md](./DESIGN.md)
- Operational notes: [DEV_NOTES.md](./DEV_NOTES.md)
