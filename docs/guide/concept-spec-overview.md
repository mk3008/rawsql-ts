---
title: What Is a Concept Spec?
outline: deep
---

# What Is a Concept Spec?

A Concept Spec is a durable specification for an important concept that spans multiple features.

It defines stable meaning, responsibility boundaries, non-responsibilities, and invariants that humans and AI agents should share before implementation starts.

Concept Specs are not implementation plans.
They are not SQL, DDL, queryspecs, transaction workflows, or test cases.

## What Concept Specs Optimize For

Concept Specs are built around four review questions:

- What does this concept mean?
- What is this concept responsible for?
- What is this concept not responsible for?
- Which invariants must later features not violate?

The structure should let reviewers and agents find the stable domain assumptions before reading feature-local implementation details.

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
- `Related Terms`: related concepts that this spec does not define

Use short additional sections when they explain an important design decision.
For example, a `Why` section can preserve why a responsibility boundary was narrowed.

Avoid copying generic Concept Spec management rules into every individual spec.
Package-level guidance and repository documentation should carry the common rules.

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

## Placement

Package-local Concept Specs live under package documentation, not under TypeScript source folders:

```text
packages/<package-name>/docs/concepts/
  README.md
  <concept-name>/
    SPEC.md
```

`packages/<package-name>/docs/concepts/README.md` is the package-local entrypoint.
It lists available Concept Specs and can describe package-specific reading order.

Individual concepts own their durable specification in their own directory:

```text
packages/transfer/docs/concepts/dirty-key/SPEC.md
```

Feature-local specs, when needed, stay close to the feature:

```text
packages/<package-name>/src/features/<feature-name>/
  SPEC.md
  spec-relationship.json
```

Feature-local `SPEC.md` files describe feature-specific behavior.
They are not Concept Specs unless they are promoted to `docs/concepts/` by explicit human decision.
Feature-local specs may depend on Concept Specs, but they must not redefine Concept Specs.

## Tree Rules

Do not start with a deep Concept Spec tree.

Start with one directory per concept:

```text
docs/concepts/
  dirty-key/
    SPEC.md
  lineage/
    SPEC.md
```

Create child Concept Specs only when all of these are true:

- the parent spec is becoming too large
- one section is repeatedly referenced by multiple issues or features
- the section can stand as a child concept that depends on the parent
- the child spec does not redefine the parent

Child Concept Specs implicitly depend on their nearest parent Concept Spec.
Do not manually list the parent as a dependency in `spec-relationship.json`; the directory structure is the parent link.

If a concept has multiple parents, keep it as an independent Concept Spec under `docs/concepts/` and record extra dependencies only when needed.

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

They are complementary:

- Concept Specs define cross-feature meaning and responsibility boundaries.
- RFBA organizes feature implementation so humans can review SQL, orchestration, public surfaces, and verification evidence.

Concept Specs should not replace RFBA boundaries, and RFBA feature files should not redefine Concept Specs.

## Summary

A Concept Spec is a durable specification for a cross-feature concept.

It fixes meaning, responsibilities, non-responsibilities, and invariants.

It stays human-readable, mechanically discoverable, and light enough to maintain.

AI and CLI tools may help find, link, and check Concept Specs, but they must not decide Concept Spec creation, movement, splitting, or merging without explicit human direction.
