---
title: Test Documentation Dogfooding
---

# Test Documentation Dogfooding

This scenario exercises the `ztd evidence test-doc` path and verifies that the exported Markdown is enough for a maintainer or AI agent to understand what the current ZTD test assets cover without opening the source files first.

## Goal

Export one human-readable Markdown document that answers these questions immediately:

- Which SQL and function catalogs exist?
- What each catalog is meant to protect?
- Which test cases are available for the current happy path?
- Which fixtures and execution style the SQL catalogs expect?

## When to use this scenario

Use this scenario when all of the following are true:

- You already have executable ZTD test assets.
- You need a shareable summary for review, onboarding, or AI handoff.
- Raw JSON evidence is too low-level for the immediate next step.

## Regression surface

- Test file: `packages/ztd-cli/tests/testDocumentationDogfooding.cli.test.ts`
- Test name: `test documentation dogfood scenario preserves the shortest export loop artifact`

This regression surface keeps the shortest export loop in git so future changes can prove that the human-readable documentation path still captures catalog purpose, execution style, fixtures, and case-level expectations.

## Shortest happy path

1. Prepare a workspace with feature-local QuerySpecs or legacy SQL specs plus `tests/specs/index` exports.
2. Run `ztd evidence test-doc --out artifacts/test-evidence/test-documentation.md`.
3. Inspect the Markdown for catalog summaries, case lists, fixture notes, and expected results.

## Example walkthrough

### 1. Prepare a minimal workspace

The workspace must include at least one of the following:

- Option A, feature-side: Feature-local QuerySpec-like files under `src/features/**`, or legacy `src/catalog/specs/*.spec.json`, for SQL catalog metadata.
- Option B, test-side: `tests/specs/index.*` for function and SQL catalog case exports.

### 2. Export the documentation

```bash
ztd evidence test-doc --out artifacts/test-evidence/test-documentation.md
```

What this gives the AI:

- One Markdown file instead of separate JSON plus source-file hops.
- Stable catalog headings, purpose text, and case summaries.
- Fixture visibility for SQL catalogs.

### 3. Review the exported sections

Good output should include all of the following:

- top-level summary counts
- one section per catalog
- a case list for each catalog
- input/setup and expected-result blocks per case
- definition links that point back to the source catalog files

## What good evidence looks like

The export is useful when it answers these questions without another source-code pass:

- What does this catalog protect?
- Is this a SQL catalog or a function-unit catalog?
- Which fixtures or setup data does the happy path depend on?
- Which specific case should be extended next when a new behavior is added?

## Why this scenario matters

This is the shortest realistic path that exercises the new human-readable documentation export together with the existing deterministic evidence model.

If this scenario stays smooth, maintainers can hand off current test coverage faster during review, onboarding, and AI-assisted follow-up work.
