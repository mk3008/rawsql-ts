# Persistence Infrastructure

This is the primary ZTD-aware layer.

- Store SQL assets in `src/sql`.
- Place QuerySpecs in `src/catalog/specs`.
- Maintain runtime mapping helpers in `src/catalog/runtime`.
- Keep DDL in `ztd/ddl`.
- Start the first repository test from `tests/queryspec.example.test.ts` so the SQL, QuerySpec, and test shape stay aligned.
