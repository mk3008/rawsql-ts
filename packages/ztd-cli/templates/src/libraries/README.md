# Libraries

Shared runtime contracts and reusable helpers live here.

- Keep driver-neutral contracts under `src/libraries/sql/` and `src/libraries/telemetry/`.
- Prefer `src/features/<feature>/` first when a helper is still owned by one feature.
- Move code here only when it is driver-neutral and reusable enough to stand as an external package.
- Do not move feature-specific validation, mapping, or orchestration helpers here; keep them inside the owning feature boundary.
