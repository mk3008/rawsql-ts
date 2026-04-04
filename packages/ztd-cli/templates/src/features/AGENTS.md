# Feature Guidance

- Feature folders are the default teaching and change surface.
- Keep `domain`, `application`, `persistence`, and `tests` close to the feature that owns them.
- Keep handwritten SQL, specs, and tests feature-local unless the project already chose a shared compatibility layout.
- Treat `smoke` as the removable starter sample when it exists.
- `users` is the normal first feature after `smoke`.
- `tests/ztd/generated/` is refreshable and CLI-owned; `tests/ztd/cases/` is persistent and owned by humans or AI.
- `ztd feature tests scaffold` should refresh generated analysis, not rewrite persistent case files.

If a request would move code out of the feature folder, explain the tradeoff before doing it.
