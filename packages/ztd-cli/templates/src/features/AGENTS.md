# Feature Guidance

- Feature folders are the default teaching and change surface.
- Keep `domain`, `application`, `persistence`, and `tests` close to the feature that owns them.
- Keep handwritten SQL, `spec.ts`, and tests feature-local unless the project already chose a shared compatibility layout.
- Use `spec.ts` as the single boundary file for each boundary folder.
- Prefer `queries/` as the default container folder for query boundaries, with each query folder owning exactly one `spec.ts`.
- Keep `entryspec` tests at `src/features/<feature>/tests/<feature>.entryspec.test.ts`.
- Keep queryspec ZTD assets colocated with each query directory under `src/features/<feature>/queries/<query>/tests/`.
- Treat `smoke` as the removable starter sample when it exists.
- `users` is the normal first feature after `smoke`.
- `tests/generated/` is refreshable and CLI-owned; `tests/cases/` is persistent and owned by humans or AI.
- `ztd feature tests scaffold` should refresh generated analysis, create the thin `tests/<query>.queryspec.ztd.test.ts` Vitest entrypoint when missing, and not rewrite persistent case files.

If a request would move code out of the feature folder, explain the tradeoff before doing it.
