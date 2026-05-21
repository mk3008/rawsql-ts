---
title: ztd-cli Technology Policy Draft
outline: deep
---

# ztd-cli Technology Policy Draft

<div class="concept-definition-summary">Draft technology constraints for ztd-cli as a PostgreSQL-first, runtime-free code generation CLI.</div>

<div class="concept-review-summary dense">
  <div class="concept-summary-top">
    <div class="concept-header-meta">
      <span>id <code>ztd-cli-technology-policy</code></span>
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
    <span class="concept-status ok">constraints: present</span>
    <span class="concept-status ok">non-standard paths: present</span>
    <span class="concept-status ok">exception policy: present</span>
    <span class="concept-status neutral">rules index: not registered</span>
  </div>
  <div class="concept-related-concepts">
    <a href="./package-concept">Package Concept</a>
    <a href="./testing-policy">Testing Policy</a>
    <a href="./review-authority-model">Review Authority Model</a>
  </div>
</div>

This document is a technology constraint harness for the target `ztd-cli` direction.
It is not the Package Concept itself.

## Purpose

`ztd-cli` should be reviewed as a runtime-free code generation CLI.

Code can show the current implementation, but code alone does not tell reviewers whether a dependency, runtime behavior, or generated shape is an intended constraint or historical accident.
This policy defines the standard technology path and the changes that should trigger review.

## Standard Technology Constraints

- Standard database target: PostgreSQL.
- Data access style: SQL-first.
- Structural source of truth: DDL for database structure.
- Code generation analysis tool: `rawsql-ts` SQL AST analysis at generation/check time.
- Standard mapper strategy: generated AOT direct assignment mapper.
- Standard generated runtime path: direct SQL resource execution through a thin driver adapter plus generated DAO and generated mapper.
- Standard verification path: generated mapper drift check plus ZTD-backed query-boundary tests.
- Standard runtime dependency goal: no `ztd-cli`, no `rawsql-ts`, no runtime mapper library, and no runtime validator library. A thin driver adapter dependency is allowed when it only handles driver mechanics.
- Standard package role: development-time code generation, inspection, and verification dependency.

## Runtime Dependency Inventory

This policy distinguishes the `ztd-cli` command runtime from the generated application runtime.

`ztd-cli` itself may depend on SQL analysis, project inspection, evidence rendering, file watching, and command-line tooling because it runs in development and CI.
That does not make those dependencies acceptable in generated application code.

The standard generated application runtime should exclude:

- `ztd-cli`;
- `rawsql-ts`;
- `@rawsql-ts/sql-contract`;
- runtime DB row validators such as Zod or ArkType;
- runtime mapper libraries;
- `@rawsql-ts/testkit-*` packages;
- SQL AST rewriting, query planning, or catalog execution helpers.

The standard generated application runtime may include a thin SQL driver adapter.
That adapter may compile named SQL parameters such as `:customerId` to driver
placeholders such as `$1` or `?`, pass ordered values to the driver, and unwrap
driver row results. It must not provide ORM query construction, SQL AST rewriting,
runtime DB row validation, or result-shaping behavior.

The generated test and verification path may use development-only dependencies such as PostgreSQL testkit packages, Testcontainers, mapper drift checks, and evidence rendering.
Those dependencies should stay in `devDependencies` or equivalent test-only wiring and should not be required by production DAO execution.

## Non-Standard Paths

The following are not part of the standard generated runtime path:

- Runtime ORM behavior.
- Runtime fluent SQL builder behavior.
- Runtime SQL AST rewriting in ordinary generated DAO execution.
- Runtime DB row validation with Zod, ArkType, or similar validators.
- SQL-side JSON shaping as a generated result-mapping strategy.
- PostgreSQL JSON aggregation (`json_agg`, `jsonb_agg`, `jsonb_build_object`, and related SQL JSON shaping) in generated query output.
- Hidden runtime SQL transformations that make reviewed SQL differ from executed SQL.
- Treating driver placeholder conversion as permission for ORM behavior or business SQL rewriting.
- Pipeline processing, scalar helper libraries, SSSQL optional-branch pruning, and parameter compression inside the core standard runtime path.
- Treating non-PostgreSQL support as already standard.

## Advanced Runtime Library Boundary

Advanced SQL runtime processing may still be valuable.

When needed, it should be treated as explicit optional infrastructure rather than part of the standard generated runtime path.
Compatibility helpers may exist, but they should not define the primary package concept.

Candidate advanced runtime areas include:

- SSSQL optional-branch pruning and omitted-parameter compression;
- runtime pipeline execution;
- runtime scalar result helpers when generated static code is insufficient;
- named parameter binding that exceeds the standard driver adapter contract;
- compatibility helpers for legacy dynamic SQL users.

The first extraction candidate should be SSSQL optional-branch pruning and omitted-parameter compression.
It is a real runtime behavior, it is advanced enough that many generated projects do not need it, and keeping it in the standard path makes the runtime-free claim ambiguous.

Pipeline execution should be evaluated next because it also represents runtime orchestration rather than generated direct execution.
Scalar result helpers should be treated cautiously: if the behavior can be generated as small static code, it should remain generated rather than become a shared runtime dependency.

## Package Split Direction

The recommended split is:

- `@rawsql-ts/ztd-cli`: development-time generator, analyzer, scaffold, and verifier;
- an optional advanced SQL runtime package: explicit infrastructure for dynamic SQL behavior that cannot be represented as static generated DAO code;
- an optional advanced SQL runtime package: temporary migration support for dynamic SQL behavior that cannot yet be generated statically.
- thin production driver adapter packages named by concrete driver implementation, such as `@rawsql-ts/driver-adapter-core`, `@rawsql-ts/driver-adapter-node-postgres`, `@rawsql-ts/driver-adapter-postgres-js`, or `@rawsql-ts/driver-adapter-mysql2`;
- testkit adapter packages named separately from production driver adapters, such as a future `@rawsql-ts/testkit-adapter-node-postgres`.

The existing `@rawsql-ts/adapter-node-pg` package is a testkit adapter for connecting node-postgres to `@rawsql-ts/testkit-postgres`.
It should not be treated as the production node-postgres driver adapter.
The non-breaking rename direction is to introduce a `testkit-adapter-*` alias first, keep the existing package for compatibility, and only then mark the legacy name as deprecated in docs or package metadata.

The optional runtime package should be opt-in and visible.
`ztd-cli` may provide commands that wire it into a generated project, but the default scaffold should not install it or import it.

Avoid a generic generation parameter that silently changes the standard runtime dependency model.
If a command enables advanced runtime behavior, generated files and docs should make that choice explicit so reviewers can still say whether a project is on the runtime-free path.

## Deprecation Decisions

- `@rawsql-ts/sql-contract-zod` is removed and must not appear in workspace packages, generated projects, or standard docs.
- `@rawsql-ts/sql-contract` is removed from the workspace and must not appear in generated projects, standard runtime docs, or package dependency manifests.
- Runtime DB row validation is not part of standard `ztd-cli` scaffold output.
- `createCatalogExecutor` is not part of standard generated query boundaries; new scaffolds should use thin generated executor calls plus generated mappers.
- SQL JSON aggregation and JSON-return shaping are removed from the generated result-mapping path. Standard code should return ordinary rows and build response shape through generated AOT mappers.
- SSSQL optional pruning, pipeline execution, scalar runtime helpers, and named parameter binding that exceeds the driver adapter contract belong in the advanced runtime package instead of the standard scaffold.

## Exception Policy

Departing from the standard path is allowed only as an explicit review decision.

The change should explain:

- why the runtime-free generated path is insufficient;
- whether the exception is temporary compatibility, an optional advanced runtime package, or a change to the standard concept;
- what additional tests or checks prove the exception;
- whether Package Concept, Testing Policy, Review Authority Model, docs, or generated project smoke tests need updates.

## Open Questions

- What should the advanced runtime package be named and scoped to include?
- Which legacy dynamic SQL primitives should move into the advanced runtime package?
- What is the migration path for current generated boundaries that still use runtime validation or catalog execution helpers?
- When, if ever, should non-PostgreSQL support become standard rather than experimental?
