---
"@rawsql-ts/ztd-cli": minor
---

Add `--test-kind ztd|traditional` to `ztd feature tests scaffold` and keep `ztd` as the default.

This update enables side-by-side lane scaffolding for query tests without breaking existing ZTD-only workflows:

- `ztd` lane keeps generating the current files (`<query>.boundary.ztd.test.ts`, `generated/TEST_PLAN.md`, `generated/analysis.json`).
- `traditional` lane generates lane-specific scaffold files (`<query>.boundary.traditional.test.ts`, `boundary-traditional-types.ts`, `generated/TEST_PLAN.traditional.md`, `generated/analysis.traditional.json`, and `cases/basic.traditional.case.ts`).

The new lane scaffold is intentionally thin and keeps mode execution responsibility in the library layer.
