---
'@rawsql-ts/test-evidence-core': minor
'@rawsql-ts/ztd-cli': minor
---

Extract deterministic test-evidence PreviewJson->DiffJson logic into a dedicated @rawsql-ts/test-evidence-core package with schemaVersion validation and typed deterministic errors.

Update @rawsql-ts/ztd-cli to consume the new diff core while keeping Markdown rendering outside the core boundary.
