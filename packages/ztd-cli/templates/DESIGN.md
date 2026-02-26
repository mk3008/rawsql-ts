# ZTD Template Design Notes

## Role and Boundaries
- Defines template-level design intent for ownership and runtime/test split.
- Clarifies where human-owned contracts stop and implementation wiring begins.

## Non-Goals
- Replacing directory-local AGENTS contracts.
- Embedding operational command playbooks.

## Ownership Model
- Human-owned directories preserve domain contracts and SQL intent.
- AI-assisted directories implement runtime wiring and verification logic.

## Runtime Split
- `src/` contains runtime assets.
- `tests/` and `ztd/` contain verification and generation inputs.
