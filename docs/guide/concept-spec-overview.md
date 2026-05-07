---
title: What Is a Concept Spec?
outline: deep
---

# What Is a Concept Spec?

A Concept Spec is a durable specification for an important concept that spans multiple features.

It defines stable meaning, responsibility boundaries, non-responsibilities, and invariants that humans and AI agents should share before implementation starts.

Concept Specs are not implementation plans.
They are not SQL, DDL, queryspecs, transaction workflows, or test cases.

Concept Specs differ from ordinary implementation-driven specifications.
They do not primarily freeze how software should move step by step.
They freeze what must keep its meaning, what must not be broken, and which responsibility boundaries later changes must preserve.

## What Concept Specs Optimize For

Concept Specs are built around four review questions:

- What does this concept mean?
- What is this concept responsible for?
- What is this concept not responsible for?
- Which invariants must later features not violate?

The structure should let reviewers and agents find the stable domain assumptions before reading feature-local implementation details.

Concept Specs optimize for long-lived `what` and `why`, not short-lived `how`:

| Concept Spec Owns | Why It Belongs Here |
|---|---|
| term definitions | reduce interpretation drift between humans and agents |
| domain rules | preserve meaning across implementation changes |
| invariants | name what refactors and AI edits must not violate |
| responsibility boundaries | keep later features from redefining the same concept |
| important non-responsibilities | prevent plausible but harmful expansions of the concept |

Concept Specs may record priority or exception handling when that priority is part of the durable concept.
They should not become a complete decision log or a copy of implementation details.

## When To Create One

Create a Concept Spec when a concept meets several of these conditions:

- It is used by multiple features.
- Misunderstanding it would break the design.
- Its non-responsibilities matter as much as its responsibilities.
- It has invariants that implementation changes must preserve.
- DDL, queryspecs, and TypeScript types cannot fully express its meaning.

Do not create a Concept Spec for:

- a column description
- a temporary implementation decision
- behavior contained within one feature
- a concrete SQL shape
- a transaction procedure
- a test-case detail
- a feature-specific input contract

When unsure, keep the note in an issue or feature-local spec first.
Promote it to a Concept Spec only after the cross-feature concept is clear.

AI agents must not create, move, split, or merge Concept Specs unless the current issue explicitly instructs the agent to create, move, split, or merge a Concept Spec and names the target Concept Spec path.
If an agent finds a concept that may deserve a Concept Spec, it should report the candidate instead of creating a new spec on its own.

## Standard Shape

Use a `SPEC.md` file for the human-readable specification body.

A Concept Spec should usually include:

- `Definition`: what the concept is
- `Responsibilities`: what the concept owns
- `Non-responsibilities`: what the concept does not own
- `Invariants`: rules that later implementations must preserve

Use short additional sections when they explain an important design decision.
For example, a `Why` section can preserve why a responsibility boundary was narrowed.

Do not keep per-spec `Related Terms` lists when the package has a concept map or machine-readable relationship file.
Concept relationships should be normalized at the concept root, for example in `concept-map.md` and `concept-relationship.json`, so relationship maintenance does not drift across individual specs.

Avoid copying generic Concept Spec management rules into every individual spec.
Package-level guidance and repository documentation should carry the common rules.

## Negative Boundary Rule

Use negative statements carefully.

A negative boundary is useful when it prevents a common or high-impact misunderstanding, but a sentence that only says "this concept does not do X" often leaves readers asking where X belongs.

When writing a negative statement, prefer also naming the owning context or concept.

For example:

```md
- Dirty Key does not decide whether a row should be transferred.
- Whether a row should be transferred is decided in the Work Item context.
```

Do not add a long relationship list only to satisfy this rule.
If the owner is obvious from `concept-map.md`, a short pointer is enough.
If the owner is not known yet, state that the ownership is unresolved instead of silently ending with a negation.

## What Not To Put In Concept Specs

Concept Specs should not define:

- implementation steps
- SQL
- DDL
- transaction design
- feature-specific workflow
- temporary implementation details
- optimization techniques
- execution order
- table join procedures
- concrete query shapes

If a business rule itself contains a calculation rule, write it as a business rule, not as an implementation algorithm.

Concept Specs are not implementation specifications.
Do not put Zod schemas, API paths, function names, class structures, SQL predicates, or concrete processing steps in a Concept Spec unless the exact shape is itself the durable domain rule.

Use the right artifact for the job:

| Artifact | Primary Role |
|---|---|
| Concept Spec | durable meaning, responsibility boundaries, non-responsibilities, and invariants |
| Issue | the change request for the current work |
| feature-local spec | feature-specific behavior that has not become a cross-feature concept |
| DDL comment | table, column, and constraint meaning |
| queryspec | SQL input/output contract |
| code comment | local reason that is easiest to understand near the code |
| test / ZTD | executable verification |
| RFBA boundary | reviewable implementation surface |
| ztd-cli | scaffold, report, and structural check support |

## Placement

Package-local Concept Specs live under package documentation, not under TypeScript source folders:

```text
packages/<package-name>/docs/concepts/
  README.md
  concept-map.md
  concept-relationship.json
  <concept-name>/
    SPEC.md
```

`packages/<package-name>/docs/concepts/README.md` is the package-local entrypoint.
It lists available Concept Specs and can describe package-specific reading order.

Individual concepts own their durable specification in their own directory:

```text
packages/transfer/docs/concepts/dirty-key/SPEC.md
```

Keep Concept Spec directories flat by default.
Do not use nested folders to express dependency, execution order, ownership, or transfer-model grouping.

Concept relationships are graph-shaped, not tree-shaped.
A concept may participate in multiple views, such as execution, transfer model, change detection, audit, lineage, or SQL generation.

Represent dependencies, relationships, lifecycle order, and conceptual views in:

- `concept-map.md`
- `concept-relationship.json`

Filesystem nesting should be used only when a concept is truly a sub-concept that cannot be understood without its direct parent and does not naturally belong to multiple parents.

Feature-local specs, when needed, stay close to the feature:

```text
packages/<package-name>/src/features/<feature-name>/
  SPEC.md
  spec-relationship.json
```

Feature-local `SPEC.md` files describe feature-specific behavior.
They are not Concept Specs unless they are promoted to `docs/concepts/` by explicit human decision.
Feature-local specs may depend on Concept Specs, but they must not redefine Concept Specs.

## Concept Map Rules

Do not build a Concept Spec dependency tree on the filesystem.

Start with one direct directory per concept:

```text
docs/concepts/
  concept-map.md
  concept-relationship.json
  dirty-key/
    SPEC.md
  lineage/
    SPEC.md
```

Use the concept map as the package-level structure.
It may provide multiple views over the same flat set of concepts, for example:

- execution view
- transfer model view
- change detection view
- audit or debugging view
- SQL generation view

A concept may appear in more than one view.
That is expected and is one reason filesystem nesting should not be used for ordinary relationship management.

Create child Concept Specs only in the rare case where all of these are true:

- the child concept cannot be understood without the direct parent
- the child concept does not naturally belong to multiple parents
- the child spec does not redefine the parent
- the flat concept plus map structure is no longer sufficient

Concept Spec movement, nesting, splitting, or merging requires explicit human instruction naming the target path.
AI agents and CLI tools must not reorganize Concept Spec layout to infer or express relationships.

## spec-relationship.json

`spec-relationship.json` is optional machine-readable metadata.

It is not the specification body.
Do not put definitions, responsibilities, non-responsibilities, or invariants in it.

Use it only to help CLI tools and agents discover related specifications and check links.

The initial shape is:

```json
{
  "dependencies": [
    {
      "path": "../../docs/concepts/dirty-key/SPEC.md",
      "kind": "concept",
      "reason": "This feature depends on dirty key semantics"
    }
  ]
}
```

Allowed dependency kinds are:

- `concept`
- `feature-spec`
- `package-doc`

`reason` is an optional human note.
It should help review, but it should not be required for mechanical checks.

`dependencies[].path` is resolved relative to the `spec-relationship.json` file that declares it.

Feature dependencies point from the feature to the Concept Spec:

```text
feature -> Concept Spec
```

Concept Specs should not maintain a list of every feature that uses them.
That list drifts easily when new features are added.

## AGENTS.md Relationship

`AGENTS.md` should be an entrypoint, not a duplicate specification.

It may tell agents which Concept Specs to read before working on a domain area:

```md
## Concept Specs

Before implementing dirty-key handling, work items, transfer requests, key maps, active black, lineage, generated transfer SQL, or transfer execution features, read:

- `packages/transfer/docs/concepts/README.md`
```

Do not redefine the Concept Spec's detailed meaning inside `AGENTS.md`.

## CLI Relationship

Concept Specs are human-readable first, but their file structure should be easy for CLI tools to inspect.

Early CLI support should stay structural and mechanical:

- list Concept Specs
- check `spec-relationship.json` schema
- check `dependencies[].path` link existence
- reject manual parent dependencies
- show related specs for a feature

CLI tools must not reinterpret the spec body, move specs, split specs, merge specs, or reorganize the Concept Spec tree automatically.
Those actions require human review.

`ztd-cli` is not the primary author of Concept Specs.
It should support the relationship between Concept Specs, RFBA boundaries, query artifacts, tests, and generated files without inventing concept content.

Useful CLI support should focus on scaffold, discovery, reports, and structural checks.
For example, a CLI may show related Concept Specs before implementation or check broken `spec-relationship.json` links.
It should not generate authoritative concept prose or decide concept ownership on behalf of humans.

Future checks may compare constants across Concept Specs, DDL constraints, TypeScript unions, and queryspec expectations.
Those checks should come later because they need explicit mapping between artifacts.

## Drift Prevention

Use these rules to reduce drift:

- Do not redefine a parent Concept Spec in a child Concept Spec.
- Do not duplicate long responsibility explanations in DDL comments, queryspecs, README files, or feature specs.
- Let DDL comments describe tables, columns, and constraints.
- Let queryspecs describe SQL input/output contracts.
- Let feature specs describe feature-specific behavior.
- Let tests prove behavior.
- Let Concept Specs define concepts, responsibility boundaries, non-responsibilities, and invariants.

If a Concept Spec carries constants, keep them in a mechanically readable `Constants` section, such as fenced YAML.
Do not add constant-drift checks until the source artifacts can be mapped reliably.

## Error And Warning Levels

Structural checks should distinguish errors from warnings.

Errors:

- `spec-relationship.json` is invalid JSON
- `dependencies[].path` does not exist
- a child spec manually lists its parent Concept Spec as a dependency

Warnings:

- a Concept Spec has no visible references from `AGENTS.md`, `docs/concepts/README.md`, `README.md`, or `spec-relationship.json`
- a spec is becoming too long
- a spec has many additional dependencies
- constants look duplicated across specs

Unreferenced Concept Specs should usually be warnings, not errors.
New root or seed specs may exist before features depend on them.

## Relationship To RFBA

RFBA makes SQL and feature boundaries reviewable after the right context exists.

Concept Specs provide that context before RFBA feature implementation starts.

RFBA defines where humans should review.
Concept Specs define what those reviews must protect.

They are complementary:

- Concept Specs define cross-feature meaning and responsibility boundaries.
- RFBA organizes feature implementation so humans can review SQL, orchestration, public surfaces, and verification evidence.

Concept Specs should not replace RFBA boundaries, and RFBA feature files should not redefine Concept Specs.

## Summary

A Concept Spec is a durable specification for a cross-feature concept.

It fixes meaning, responsibilities, non-responsibilities, and invariants.

It stays human-readable, mechanically discoverable, and light enough to maintain.

AI and CLI tools may help find, link, and check Concept Specs, but they must not decide Concept Spec creation, movement, splitting, or merging without explicit human direction.
