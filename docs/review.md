<!-- generated-by: transfer-docs -->

# Transfer Review Report

This page is the product-level review report for `@rawsql-ts/transfer`.
It collects machine-check review signals first, then leaves semantic Concept / Process / DDL review to human and AI review workflows.

## Review Sections

- [DDL / Column Mechanical Review](#ddl-column-mechanical-review)
- [Review Harness Summary](#review-harness-summary)
- [AI Semantic Review](#ai-semantic-review)
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
- Review-plan source artifacts: 28
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

## AI Semantic Review

Source: `packages/transfer/docs/review/ai-review.json`
Human-facing language: `ja`
Status: `needs-review`
Total findings: 3
Open findings: 2
Resolved findings: 1
Accepted findings: 0

This section displays an existing AI review JSON artifact.
The CLI does not generate, refresh, infer, translate, or mutate this JSON.

### transfer-work-item-lineage-candidate

- Status: `open`
- Severity: `medium`
- Category: `relationship-clarity`

**転送作業対象から Lineage への candidate 関係が判断材料とずれている**

concept relationship では転送作業対象が Lineage に依存する可能性があるが、転送作業対象の判断材料は transfer model、転送元現在値、Active Black、重複判定として説明されている。Lineage を判断材料にするのか、Active Black や Dirty Key Processing 経由で十分なのかが未確定に見える。

Evidence:

- `packages/transfer/docs/concepts/concept-relationship.json:441` - 転送作業対象 -> Lineage が human-provided-candidate として記録されている。
- `packages/transfer/docs/concepts/work-item/concept.json:103` - 転送作業対象の判断材料は transfer model、転送元現在値の有無、Active Black の有無、重複判定として説明されている。

Recommendation:

Lineage を転送作業対象の判断材料にするなら、Work Item Spec と Process Map input に上げる。そうでないなら candidate 関係を削除するか、Active Black / Dirty Key Processing 側の責務として整理する。

### transfer-mutable-traceability-gap

- Status: `open`
- Severity: `low`
- Category: `coverage-gap`

**mutable transfer model の追跡・監査が別概念として未確定**

Lineage は immutable transfer model に限定され、mutable transfer model の追跡は処理ログ、監査ログ、または別の追跡概念として扱うと説明されている。一方で Transfer Execution は mutable の更新・削除を扱うため、mutable の追跡を将来扱うなら候補概念か明示的な out-of-scope が必要になる。

Evidence:

- `packages/transfer/docs/processes/lineage-trace-process.md:13` - Lineage trace is limited to immutable transfer model rows.
- `packages/transfer/docs/concepts/lineage/concept.json:122` - mutable transfer model is treated as not having Lineage.
- `packages/transfer/docs/concepts/transfer-execution/concept.json:73` - Transfer Execution handles Black Update Transfer and Physical Delete Transfer for mutable transfer model.

Recommendation:

mutable の追跡をこの package の責務に含めるなら、候補 Concept または Process Map を追加する。含めないなら、Scope または Lineage/Transfer Execution 側で out-of-scope として明示する。

### transfer-duplicate-control-candidate

- Status: `resolved`
- Severity: `medium`
- Category: `concept-boundary`

**重複制御を Draft Concept として昇格済み**

重複制御は候補概念から Draft Concept に昇格した。Draft では、Dirty Key を転送作業対象にするか、転送不要として扱うかを分ける判断境界として整理し、Active Black と Dirty Key Processing の責務差も明示した。

Evidence:

- `packages/transfer/docs/concepts/concept-relationship.json:63` - duplicate-control is registered as draft.
- `packages/transfer/docs/concepts/duplicate-control/concept.json:1` - 重複制御 Draft を追加した。
- `packages/transfer/docs/concepts/work-item/concept.json:20` - 転送作業対象は Transfer Setting、Destination Link、source key の文脈で重複 Dirty Key を判定できる必要がある。
- `packages/transfer/docs/concepts/work-item/concept.json:54` - 転送作業対象は、同じ転送判断として既に扱われた重複 Dirty Key を無視できる。
- `packages/transfer/docs/concepts/dirty-key-processing/concept.json:41` - Dirty Key Processing provides material for preventing duplicate transfer.

Recommendation:

Draft を人間がレビューし、独立 Concept Spec に昇格するか、転送作業対象、Active Black、Dirty Key Processing の責務として閉じるかを決める。
