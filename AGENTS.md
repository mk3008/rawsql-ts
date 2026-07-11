# Repository Guidance

Apply this policy repository-wide. A nested `AGENTS.md` may add stricter,
directory-specific rules.

## Always

- Preserve alignment between source assets and generated artifacts, fixtures,
  scaffold code, docs, and published-package checks.
- Do not weaken completion criteria or required verification.
- Use `pnpm` and prefer scoped package commands.
- Write repository artifacts in English; communicate with the user in Japanese.
- Keep README content reader-facing. Preserve accurate commands, contracts, and
  navigation; move detail to linked documentation instead of silently dropping it.

## Routing

- For a new issue, feature, refactor, investigation, CI failure, migration, or
  review, use `.agents/skills/rawsql-task-orchestrator/SKILL.md` before acting.
- Use the repository's specialist skills only when their documented trigger
  matches; do not duplicate their procedures here.
- For delegated, recoverable, or multi-worker work, read
  `docs/codex-orchestration.md` and use `$minimal-orchestration` for lifecycle
  control.

Keep detailed planning, verification, review, reporting, package policy, and
documentation-mode procedures in their routed guidance or skills, not here.
