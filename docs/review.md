<!-- generated-by: transfer-docs -->

# Transfer Review Report

This page is the product-level review report for `@rawsql-ts/transfer`.
It collects machine-check review signals first, then leaves semantic Concept / Process / DDL review to human and AI review workflows.

## Review Sections

- [DDL / Column Mechanical Review](#ddl-column-mechanical-review)
- [Review Harness Summary](#review-harness-summary)
- [Table Definitions](./rawsql-transfer/)
- [Column Index](./rawsql-transfer/columns/)

## DDL / Column Mechanical Review

This page contains mechanical review signals generated from DDL parsing and column analysis.
It is the machine-check layer of review. Use it together with human / AI semantic review against Concept Specs, Process Maps, and DFDs.

### Summary

- Parser warnings: 0
- Column findings: 0

### Parser Warnings

- None

### Column Findings

- None

### Semantic Review Layer

Mechanical checks do not prove that the design is conceptually correct.
For semantic review, check whether each table, column, index, and constraint is justified by Concept Specs, DFDs, Process Maps, and use cases.
The DDL Concept / Process review skill should be used for that inference layer.

## Review Harness Summary

This section aggregates the package-level review harness inputs used before semantic review.

- Metadata check errors: 0
- Metadata check warnings: 0
- Review-plan source artifacts: 42
- Unmapped business artifacts: 0
- Review-plan diagnostics: 0
- Mandatory scope rules: `db-centered-transfer`, `human-owned-logical-model`, `generated-docs-not-source`
- Mandatory verification policies: `db-backed-contract-verification`, `no-hot-path-runtime-validation`
- Mandatory authority rules: `human-owned-requirements`, `ai-owned-review-management`, `cli-owned-review-views`
- Mandatory technology rules: `postgres-primary-db`, `sql-first-ztd-cli`, `no-standard-orm-path`, `cli-front-facing-surface`

### Review-plan Diagnostics

- None

### Unmapped Business Artifacts

- None

### Source Inputs

- Package scope: `packages/transfer/docs/scope/SYSTEM_SCOPE.md`
- Scope rules: `packages/transfer/docs/scope/scope-rules.json`
- Test policy: `packages/transfer/docs/testing/TEST_POLICY.md`
- Test rules: `packages/transfer/docs/testing/test-rules.json`
- Authority model: `packages/transfer/docs/review/AUTHORITY_MODEL.md`
- Authority rules: `packages/transfer/docs/review/authority-rules.json`
- Technology policy: `packages/transfer/docs/technology/TECHNOLOGY_POLICY.md`
- Technology rules: `packages/transfer/docs/technology/tech-rules.json`
- Review plan snapshot: `tmp/transfer-review-plan.json`
