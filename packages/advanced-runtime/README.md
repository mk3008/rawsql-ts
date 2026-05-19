# @rawsql-ts/advanced-runtime

Opt-in advanced runtime SQL helpers for projects that intentionally need dynamic SQL behavior outside the standard `ztd-cli` runtime-free generated path.

Initial extraction targets:

- SSSQL optional-branch pruning and omitted-parameter compression
- pipeline execution
- scalar runtime helpers
- named parameter binding that cannot be resolved during generation
- compatibility helpers for legacy runtime users

Standard `ztd-cli` scaffolds should not import this package by default.
