# Feature Guidance

- Feature folders are the default teaching and change surface.
- Treat each feature folder as a boundary that may contain child boundaries.
- Keep handwritten SQL, `boundary.ts`, and tests feature-local unless the project already chose a shared compatibility layout.
- Use `boundary.ts` as the single public surface file for each boundary folder.
- Prefer `queries/` as the default container folder for query boundaries, with each query folder owning exactly one `boundary.ts`.
- Keep feature-boundary tests at `src/features/<feature>/tests/<feature>.boundary.test.ts`.
- Keep query-boundary ZTD assets colocated with each query directory under `src/features/<feature>/queries/<query>/tests/`.
- Keep shared feature-facing seams under `src/features/_shared/*`.
- Put driver or sink bindings under `src/adapters/<tech>/*` and shared driver-neutral contracts under `src/libraries/*`.
- Do not place runtime clients or adapters under `db/`.
- Treat `smoke` as the removable starter sample when it exists.
- `users` is the normal first feature after `smoke`.
- Query-local `tests/generated/` is refreshable and CLI-owned; query-local `tests/cases/` is persistent and owned by humans or AI.
- `ztd feature tests scaffold` should refresh query-local generated analysis, create the thin `src/features/<feature>/queries/<query>/tests/<query>.boundary.ztd.test.ts` Vitest entrypoint when missing, and not rewrite persistent case files.

If a request would move code out of the feature folder, explain the tradeoff before doing it.
