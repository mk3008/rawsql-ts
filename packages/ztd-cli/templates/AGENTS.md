# Package Scope
- Applies to `packages/ztd-cli/templates`.
- Defines repository-wide guardrails for generated project templates.

# Policy
## REQUIRED
- Generated artifacts MUST remain unedited unless explicit instruction exists.
- Feature-first boundaries MUST stay explicit when `src/features/<feature>` exists.
- Human-owned contract directories (`ztd/ddl`, `src/catalog/specs`, `src/sql`) MUST NOT be semantically changed without explicit instruction.
- Template output MUST keep a runnable `pnpm test` path at initialization.
- The repository-root `AGENTS.md` SHOULD define stable, high-level boundaries such as the repository root, `src/features`, `tests`, and `ztd`.
- When a nested `AGENTS.md` exists near the edited files, treat it as the closest path-specific override and keep it short, focused, and easy to maintain.
- Feature-local intent and starter explanations SHOULD live primarily in `README.md`, sample code, and tests rather than relying on deep per-folder `AGENTS.md`.

## PROHIBITED
- Manual edits under `tests/generated`.
- Treating ZTD-specific workflow rules as repository-global rules.
- Assuming every future feature or subfolder will be generated through the CLI.

# Hygiene
- Keep `AGENTS.md` files few, stable, and easy to maintain.
