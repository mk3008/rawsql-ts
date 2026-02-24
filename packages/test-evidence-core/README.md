# @rawsql-ts/test-evidence-core

Shared semantic core for test evidence.

## Scope

- Pure model and transform functions only
- No filesystem access
- No markdown rendering

## Schema Versions

- `PREVIEW_SCHEMA_VERSION`: supported major version for `PreviewJson`
- `DIFF_SCHEMA_VERSION`: major version emitted for `DiffJson`

Both are major integers. Unsupported major versions fail with deterministic typed errors.

## Compatibility Policy

- Pre-release (`0.x`): breaking changes are allowed while boundaries are being finalized
- Post-release: breaking schema changes require a major version bump

## Deterministic Error Contract

`DiffCoreErrorCode`:

- `INVALID_INPUT`
- `UNSUPPORTED_SCHEMA_VERSION`

Validation failures are deterministic, including stable error shape fields (`code`, `path`, `schemaVersion`, `details`).

## Pure Intermediate Model

`buildSpecificationModel(previewJson)` returns a pure intermediate model.

- Returns structured data only
- No markdown strings
- No IO
- No side effects

### Function Case Contract

Function test cases in `PreviewJson.testCaseCatalogs[].cases[]` use explicit outcomes:

- `expected: "success" | "throws" | "errorResult"`
- `expected: "throws"` requires `error: { name, message, match }`
- non-throw outcomes require `output`
- optional metadata: `tags: string[]`, `focus: string`
