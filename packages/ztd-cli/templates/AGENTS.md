# Package Scope
- Applies to `packages/ztd-cli/templates`.
- Defines repository-wide guardrails for generated project templates.

# Policy
## REQUIRED
- The nearest nested `AGENTS.md` MUST win for edited files.
- Generated artifacts MUST remain unedited unless explicit instruction exists.
- Feature-first boundaries MUST stay explicit when `src/features/<feature>` exists.
- Human-owned contract directories (`ztd/ddl`, `src/catalog/specs`, `src/sql`) MUST NOT be semantically changed without explicit instruction.
- Template output MUST keep a runnable `pnpm test` path at initialization.

## PROHIBITED
- Manual edits under `tests/generated`.
- Treating ZTD-specific workflow rules as repository-global rules.

# Hygiene
- Keep child `AGENTS.md` files short and path-specific.
