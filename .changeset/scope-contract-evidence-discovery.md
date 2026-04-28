---
"@rawsql-ts/ztd-cli": minor
---

Align `ztd check contract` and `ztd evidence` with RFBA feature-local QuerySpec discovery. Both commands now scan project QuerySpec-like assets by default, support `--scope-dir` for feature or subtree reviews, and keep `--specs-dir` as the legacy fixed catalog-spec override.
