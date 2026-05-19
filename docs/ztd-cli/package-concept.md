---
title: ztd-cli Package Concept Draft
outline: deep
---

# ztd-cli Package Concept Draft

<div class="concept-definition-summary">Runtime-free SQL-first code generation CLI for DDL-driven application boundaries, DAO access, AOT mappers, and ZTD-backed tests.</div>

<div class="concept-review-summary dense">
  <div class="concept-summary-top">
    <div class="concept-header-meta">
      <span>id <code>ztd-cli-package-concept</code></span>
      <span>format <code>draft markdown</code></span>
    </div>
    <span class="concept-status warn">draft</span>
  </div>
  <div class="concept-primary-statuses">
    <span class="concept-status warn">validation: draft</span>
    <span class="concept-status warn">coverage: partial</span>
    <span class="concept-status warn">open questions present</span>
  </div>
  <div class="concept-summary-row concept-checks">
    <span class="concept-status ok">meaning: present</span>
    <span class="concept-status ok">responsibilities: present</span>
    <span class="concept-status ok">boundaries: present</span>
    <span class="concept-status ok">invariants: present</span>
    <span class="concept-status ok">rationale: present</span>
    <span class="concept-status neutral">evidence: draft only</span>
    <span class="concept-status neutral">linked concepts: not registered</span>
  </div>
  <div class="concept-related-concepts">
    <a href="./testing-policy">Testing Policy</a>
    <a href="./review-authority-model">Review Authority Model</a>
    <a href="./technology-policy">Technology Policy</a>
  </div>
</div>

This page is a Concept Spec draft for the target direction of `@rawsql-ts/ztd-cli`.
It describes the intended package concept, not the current implementation state.

## Message

<div class="concept-message">
  <p><strong>From DDL to tested SQL.</strong></p>
  <p>Generate editable feature scaffolds, mappers, unit tests, and SQL impact reports for runtime-free TypeScript apps.</p>
</div>

This message is the package positioning statement.
It is not a complete summary of responsibilities; it is the short promise the package should make before readers inspect the detailed concept boundary.

## Definition

`ztd-cli` is a runtime-free code generation CLI for SQL-first backend development.

It treats DDL as the single source of truth for data structure, uses `rawsql-ts`
SQL AST analysis at generation time, and generates SQL execution boundaries,
DAO-style access code, AOT row mappers, and ZTD-backed unit-test scaffolds.

The standard generated runtime path does not require `ztd-cli`, `rawsql-ts`,
runtime mapper libraries, or runtime validator libraries. It may use a thin
driver adapter so reviewable SQL files can keep named parameters while the
selected database driver receives its required placeholder format.

## Responsibilities

- Use DDL as the source of truth for table, column, constraint, and database type information.
- Use `rawsql-ts` SQL AST analysis during code generation, inspection, scaffolding, and checks.
- Generate reviewable SQL assets and application-side SQL execution boundaries.
- Generate DAO-style access code that calls explicit SQL resources and generated mappers.
- Generate AOT row mappers instead of relying on runtime mapping descriptors.
- Generate ZTD-backed query-boundary tests that exercise SQL execution and mapper behavior.
- Provide generated mapper drift checks so SQL, boundary contracts, and generated mapper artifacts stay aligned.
- Keep SQL files readable by allowing named parameters and delegating driver placeholder conversion to a thin adapter boundary.
- Support PostgreSQL as the current standard database target.

## Non-Responsibilities

- `ztd-cli` is not a runtime ORM.
- `ztd-cli` is not a runtime fluent SQL builder.
- `ztd-cli` does not participate in production runtime behavior.
- `ztd-cli` should be needed only as a development-time code generation, inspection, and verification dependency.
- `ztd-cli` affects application code only through generated artifacts and mechanical checks.
- `ztd-cli` is not the standard production runtime for SQL AST rewriting.
- `ztd-cli` does not make runtime DB row validation with Zod, ArkType, or similar validators part of the standard mapper path.
- `ztd-cli` does not use SQL-side JSON shaping or SQL JSON result construction as a generated result-mapping strategy.
- `ztd-cli` does not hide business SQL shape behind runtime SQL rewriting in the standard path.
- `ztd-cli` is not a database driver and does not own connection pooling, transactions, or driver lifecycle.
- Advanced runtime SQL processing, such as pipeline execution, scalar helpers, SSSQL optional-branch pruning, and parameter compression, belongs outside the core standard generated runtime path.

## Invariants

- Generated standard runtime code must execute without depending on `ztd-cli` or SQL AST transformation libraries.
- SQL remains a reviewable source artifact; runtime behavior must not depend on hidden SQL shape changes in the standard path.
- Driver adapter behavior must be limited to driver-facing mechanics such as named-parameter compilation and row-result normalization. It must not become ORM behavior, runtime result validation, SQL result shaping, or hidden business SQL rewriting.
- DDL is the source of truth for database structure, but it is not the source of truth for business concepts, process decisions, or feature intent.
- Runtime DB row validation is not required on the hot mapper path when the SQL contract and mapper are covered by generated mapper drift checks and ZTD-backed tests.
- A DAO generated by `ztd-cli` can be treated as type-safe when its SQL contract, generated mapper, and ZTD mapper tests are aligned and passing.
- AOT mapper generation must be reproducible from source artifacts.
- Mapper drift must fail through a mechanical check rather than relying on humans to notice stale generated code.
- Generated code must keep the boundary between generated artifacts and human-owned SQL, query contracts, and test cases visible.

## Rationale

Database result rows are a narrower trust boundary than external requests.
The database already enforces strong structure through types, `NOT NULL`,
constraints, and query semantics.

For the standard `ztd-cli` path, mapper correctness should therefore be shifted
left into DDL review, SQL review, query-boundary contracts, generated mapper
drift checks, and ZTD-backed mapper tests.

This keeps production runtime code small and direct while preserving a strong
review and verification story.

## Target Runtime Shape

The target standard runtime shape is:

```text
SQL file with :name parameters
  + thin driver adapter
  + generated DAO
  + generated AOT mapper
```

The target verification shape is:

```text
DDL + query contract + generated mapper drift check + ZTD-backed mapper test
```

This means the runtime path should be close to direct SQL execution plus direct
assignment into DTOs.

## Out Of Scope For This Draft

- Exact package split for advanced runtime SQL processing.
- Migration plan for legacy runtime mapper, catalog, and writer APIs.
- Deprecation schedule for JSON result construction helpers.
- Generated file layout details.
- CLI command names and command-line option design.
- Non-PostgreSQL support policy.

## Open Questions

- Which advanced runtime SQL processing features should move into a separate package first?
- Should the separated advanced runtime package be positioned as optional infrastructure or as a compatibility layer?
- Which driver-specific adapter packages should be added after the core driver adapter boundary?
- Which current scaffold outputs must change before the `ztd-cli` concept can move from draft to defined?
- What minimum generated project smoke test proves the runtime-free standard path?
- How should legacy runtime API users be guided through the transition without hiding the new concept boundary?
