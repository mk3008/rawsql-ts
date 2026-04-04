# Feature Guidance

- Feature folders are the default teaching and change surface.
- Keep `domain`, `application`, `persistence`, and `tests` close to the feature that owns them.
- Keep handwritten SQL, specs, and tests feature-local unless the project already chose a shared compatibility layout.
- Keep `entryspec` tests at `src/features/<feature>/tests/<feature>.entryspec.test.ts`.
- Keep queryspec ZTD assets colocated with each query directory under `src/features/<feature>/<query>/tests/`.
- Treat `smoke` as the removable starter sample when it exists.
- `users` is the normal first feature after `smoke`.
- `tests/generated/` is refreshable and CLI-owned; `tests/cases/` is persistent and owned by humans or AI.
- `ztd feature tests scaffold` should refresh generated analysis, create the thin `tests/<query>.queryspec.ztd.test.ts` Vitest entrypoint when missing, and not rewrite persistent case files.

If a request would move code out of the feature folder, explain the tradeoff before doing it.
