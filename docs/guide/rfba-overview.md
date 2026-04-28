---
title: What Is RFBA?
outline: deep
---

# What Is RFBA?

RFBA means **Review-First Backend Architecture**.

It is a backend architecture for AI-assisted development where the main goal is not to make AI fully autonomous.
The goal is to make AI-produced work reviewable by humans.

RFBA does this by splitting files by review responsibility.
Human reviewers should be able to find the artifacts that carry business meaning, understand what they depend on, and verify the local evidence around them.

## What RFBA Optimizes For

RFBA is built around four review questions:

- What is the responsibility boundary?
- Which direction do dependencies flow?
- What is the public surface?
- What verification belongs to this boundary?

The structure should make those answers visible from the filesystem before a reviewer has to read every implementation detail.

## Scope

RFBA is intentionally scoped to backend work, especially database applications.

In database applications, DDL is already a strong artifact.
RFBA treats DDL as the source of truth for data structure, not as a duplicate of product requirements.
On top of that DDL, raw SQL is a natural review boundary because it shows which tables, joins, filters, updates, and result columns carry the use-case meaning.

DTOs, mapping, validation, and routing still matter, but they are usually easier to scaffold, derive, test, or repair with AI/tooling once the DDL and SQL shape are visible.

## Relationship To VSA

RFBA is compatible with Vertical Slice Architecture.

Like VSA, RFBA groups work by feature or use case instead of spreading one use case across technical layers.
RFBA adds a review-first focus: inside a feature, expose the artifacts that humans should review most carefully, especially SQL and orchestration, while keeping supporting files close to the review boundary they serve.

## ztd-cli Structural Vocabulary

`ztd-cli` applies RFBA with three structural terms:

- `root-boundary`: the app-level boundary layer. In rawsql-ts starter layouts, the concrete root-boundaries are `src/features`, `src/adapters`, and `src/libraries`.
- `feature-boundary`: a feature-owned boundary under `src/features/<feature>/`.
- `sub-boundary`: an optional child boundary inside a feature when review responsibility, allowed dependencies, public surface, or verification scope changes.

For query-heavy features, a query folder is the query unit.
It keeps SQL, row/result mapping, execution contract, and query-local verification together for review.

## What RFBA Is Not

RFBA is not a universal file naming rule.

`boundary.ts` is the default `ztd-cli` feature scaffold convention because it makes generated feature and query entrypoints easy to find.
That filename is useful, but it is not the definition of RFBA.
Outside feature-scoped scaffold conventions, projects may choose different filenames when that better expresses the local public surface.

RFBA is also not a claim that humans only review SQL.
DDL, orchestration, public API contracts, and important verification cases still need human judgment.
The point is to make the review-heavy artifacts visible and local, while letting AI and tools handle more of the surrounding wiring and consistency work.
