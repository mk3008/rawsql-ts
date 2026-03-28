# Runtime Guidance

- Runtime code MUST remain independent from ZTD internals.
- Applies to `packages/ztd-cli/templates/src/**/*.{ts,tsx,js,jsx}`.
- Keep runtime code independent from `tests/` and `tests/generated/`.
- Keep SQL ownership inside the feature that owns the workflow.
- Prefer small feature-local edits over broad shared extraction.
- If you need a shared runtime helper, explain why the feature folder is no longer the right home first.

When `src/features/<feature>` exists, start there before creating new top-level runtime folders.
