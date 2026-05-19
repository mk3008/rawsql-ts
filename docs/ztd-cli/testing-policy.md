---
title: ztd-cli Testing Policy Draft
outline: deep
---

# ztd-cli Testing Policy Draft

<div class="concept-definition-summary">Draft verification policy for the runtime-free ztd-cli generation path.</div>

<div class="concept-review-summary dense">
  <div class="concept-summary-top">
    <div class="concept-header-meta">
      <span>id <code>ztd-cli-testing-policy</code></span>
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
    <span class="concept-status ok">purpose: present</span>
    <span class="concept-status ok">scope: present</span>
    <span class="concept-status ok">mapper strategy: present</span>
    <span class="concept-status ok">gates: present</span>
    <span class="concept-status neutral">rules index: not registered</span>
  </div>
  <div class="concept-related-concepts">
    <a href="./package-concept">Package Concept</a>
    <a href="./review-authority-model">Review Authority Model</a>
    <a href="./technology-policy">Technology Policy</a>
  </div>
</div>

This document is a package-level verification harness for the target `ztd-cli` concept.
It is not the Concept Spec body.

## Purpose

`ztd-cli` verifies its standard generated runtime path by shifting correctness left into source artifacts and generated checks.

The standard verification strategy is not to add runtime validation to the hot mapper path.
Instead, it combines DDL structure, SQL/query contracts, generated mapper drift checks, and ZTD-backed query-boundary tests.

## In Scope

- DDL-derived table, column, constraint, and database type coverage.
- SQL resource review and query-boundary contract coverage.
- Generated AOT mapper drift detection.
- ZTD-backed query-boundary tests that execute SQL and mapper behavior together.
- Generated project smoke tests that prove the standard runtime path does not depend on `ztd-cli`, `rawsql-ts`, runtime mapper libraries, or runtime validator libraries.
- Boundary cases for `null`, database defaults, missing rows, cardinality, scalar values, arrays, JSON columns, and enum-like values when the DDL or query contract exposes them.

## Out of Scope

- Treating E2E tests as the only proof for SQL and mapper correctness.
- Adding Zod, ArkType, or similar runtime validation to the standard DB row mapper path.
- Requiring production runtime SQL AST rewriting to prove ordinary generated DAO behavior.
- Treating generated review pages as executable verification.
- Hiding SQL JSON shaping behind runtime behavior as the standard mapper strategy.

## Required Review Posture

Tests should protect source intent, not reproduce implementation shape.

When a test case is derived from a concept, package policy, DDL constraint, SQL contract, or issue requirement, the owning source should be visible enough that reviewers can tell what the test protects.

Generated tests and generated plans are review aids.
Human-owned or AI-authored persistent test cases remain responsible for the meaningful examples and boundary cases.

## Mapper Safety Strategy

DB rows are a narrower trust boundary than external request payloads.

Mapper safety is provided by:

- DDL constraints and database types.
- SQL/query contracts.
- Generated mapper drift checks.
- ZTD-backed SQL and mapper tests.

If a feature adds runtime DB row validation to the standard generated path, the review must explain why these checks are insufficient for that feature.

## Required Gates

Before a generated runtime path is treated as type-safe, reviewers should have evidence that:

- the SQL contract and generated mapper are in sync;
- the generated mapper check passes;
- the ZTD-backed mapper test covers the expected success path;
- relevant edge cases are covered either by ZTD-backed tests, traditional DB tests, or an explicit accepted gap;
- the generated runtime path can execute without `ztd-cli`, `rawsql-ts`, runtime mapper libraries, or runtime validator libraries.

## Open Questions

- What is the minimum smoke test that proves runtime-free generated project behavior?
- Which constraint classes require traditional physical DB tests in addition to ZTD tests?
- Should mapper drift checks become a required repository-level gate for all generated projects?
- How should scalar and optional advanced runtime features declare their separate verification requirements?
