# Catalog Spec Pattern

This folder is the explicit specification source for test evidence projection.

- `tests/specs/testCaseCatalogs.ts`: Test Case Catalog specs.
- `tests/specs/sql/*.ts`: SQL Catalog case specs.
- `tests/specs/index.ts`: explicit export barrel consumed by evidence mode.

Rules:

- Spec files export catalog objects only.
- Do not declare `describe`/`it` inside spec files.
- Runner tests execute specs.
- Evidence tests validate deterministic projections.
- Evidence discovery is explicit (`tests/specs/index`), never glob/source parsing.
- Canonical SQL catalog API names:
  - `defineSqlCatalog(...)`
  - `runSqlCatalog(...)`
  - `exportSqlCatalogEvidence(...)`

Evidence fixed points:

- SQL evidence fixture summary includes only:
  - `tableName`
  - `schema.columns`
  - `rowsCount`
- Evidence must be deterministic:
  - sorted IDs and stable key ordering
  - no timestamps
  - no environment-specific fields
- Full fixture rows are not included by default; add them only via explicit, stable requirements.
