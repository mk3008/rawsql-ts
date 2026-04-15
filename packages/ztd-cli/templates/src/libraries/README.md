# Libraries

Shared runtime contracts and reusable helpers live here.

- Keep driver-neutral contracts under `src/libraries/sql/` and `src/libraries/telemetry/`.
- Prefer `src/features/<feature>/` first when a helper is still owned by one feature.
- Move code here only when it is no longer feature-owned and does not depend on a specific external technology.
