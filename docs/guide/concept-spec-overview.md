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

## Concept-Driven Development Flow

Concept Spec work follows an intentionally staged development style.

1. Create and review Concept Specs.
2. Create and review Process Maps only when the logic is complex enough to need them.
3. Feed Process Map findings back into Concept Specs when the process exposes a missing concept, ambiguous term, or responsibility gap.
4. Implement with RFBA after the concept and process review surfaces are stable enough.

Concept Specs are not expected to become perfect from desk review alone.
They should be correct enough to protect durable meaning, responsibility boundaries, and invariants.
When a Process Map cannot express the use case without inventing undefined terms, contradicting a Concept Spec, or hiding a responsibility gap, update the Concept Spec or Concept Map before continuing.

Process Maps are optional.
Create them for complex flows that combine multiple concepts, branching decisions, duplicate prevention, auditability, history, or state transitions.
Do not create Process Maps for every CRUD feature or simple query.

This flow is deliberately not physical design.
Concept Specs and Process Maps should avoid DDL details, SQL shape, Zod schemas, API paths, function names, class structure, file layout, and transaction implementation unless the user explicitly asks for a separate implementation design.
Their value is long document lifetime: they should remain useful across implementation rewrites, schema refactors, and RFBA feature reshaping.

## Relationship To Agent Workflow Skills

Concept Specs are the durable harness.
Agent workflow skills are execution aids.

Do not treat a generic planning, TDD, subagent, review, or branch-finishing workflow as a replacement for Concept Specs.
Those skills may help the implementation phase, but they do not own the domain meaning, responsibility boundaries, non-responsibilities, or invariants.

The intended layering is:

| Layer | Role |
|---|---|
| Concept Spec | define what must keep its meaning |
| Concept Map | normalize concept names, glossary terms, and static relationships |
| Process Map | check whether complex use cases can be expressed from approved concepts |
| RFBA | expose the implementation surfaces humans should review |
| ztd-cli / ZTD / tests | provide scaffold, generated artifacts, drift checks, and executable verification |
| agent workflow skills | guide planning, TDD, verification, review, branch work, and subagent execution |

Agent workflow skills are useful after the concept and process context is known.
For example, they may enforce verification before completion, help split implementation tasks, or structure review checkpoints.

They should not generate authoritative concept prose, promote draft concepts, reorganize Concept Spec layout, or decide concept ownership.
If a workflow skill discovers an unclear concept boundary, it should report the ambiguity and route the work back to Concept Spec or Process Map review.

In short: Concept Specs say what must be protected; workflow skills help agents do the work without skipping the guardrails.

## Placement

Package-local Concept Specs live under package documentation, not under TypeScript source folders:

```text
packages/<package-name>/docs/concepts/
  README.md
  concept-map.md
  concept-relationship.json
  <concept-name>/
    SPEC.md

packages/<package-name>/docs/processes/
  process-map.json
  <process-name>-process.md
```

`packages/<package-name>/docs/concepts/README.md` is the package-local entrypoint.
It lists available Concept Specs and can describe package-specific reading order.

Individual concepts own their durable specification in their own directory:

```text
packages/transfer/docs/concepts/dirty-key/SPEC.md
```

Concept folders are stable anchors.
When a concept is still under discussion, keep the same concept directory and use `DRAFT.md` instead of `SPEC.md`:

```text
packages/transfer/docs/concepts/<concept-id>/
  DRAFT.md
```

`DRAFT.md` is a visible TODO and review target, but it is not an authoritative Concept Spec.
Agents may review it, point out contradictions, and propose wording, but they must not treat draft content as a stable premise for implementation unless the current issue explicitly asks for that draft to be used.

When the concept is approved, promote it in place:

1. Replace `DRAFT.md` with `SPEC.md`.
2. Remove the old `DRAFT.md`.
3. Update `concept-map.md` from `Draft Concepts` to `Defined Concepts`.
4. Update `concept-relationship.json` from `draftPath` / `status: "draft"` to `path` / `status: "defined"`.
5. Recheck process maps and feature references that depended on the draft wording.

Do not use a separate `_drafts/` folder for ordinary concept drafts.
The concept directory keeps links stable, makes unfinished work visible, and keeps promotion cheap.

Keep Concept Spec directories flat by default.
Do not use nested folders to express dependency, execution order, ownership, or transfer-model grouping.

Concept relationships are graph-shaped, not tree-shaped.
A concept may participate in multiple views, such as execution, transfer model, change detection, audit, lineage, or SQL generation.

Represent concept dependencies, static relationships, and glossary lookup in:

- `concept-map.md`
- `concept-relationship.json`

Represent process order, use-case flow, and input/output process details in process maps under:

- `docs/processes/`

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

Use the concept map as the package-level structure for static concept relationships.
It may provide static views over the same flat set of concepts, such as master correlation or glossary-oriented lookup.

Separate defined and draft concepts in the human-facing map:

- `Defined Concepts` have an approved `SPEC.md`.
- `Draft Concepts` have a `DRAFT.md` and are not yet authoritative.

Draft concepts may appear in maps as open work, but their status must be visible.
Do not let a draft concept appear as a defined production premise without an explicit human decision.

Do not put use-case execution order, process input/output flow, or state-machine details in the Concept Map.
Those belong in process maps.

Process maps may provide multiple process views over the same flat set of concepts, for example:

- transfer execution process
- lineage trace process
- SQL generation process
- audit or debugging process

A concept may appear in more than one view.
That is expected and is one reason filesystem nesting should not be used for ordinary relationship management.

Create child Concept Specs only in the rare case where all of these are true:

- the child concept cannot be understood without the direct parent
- the child concept does not naturally belong to multiple parents
- the child spec does not redefine the parent
- the flat concept plus map structure is no longer sufficient

Concept Spec movement, nesting, splitting, or merging requires explicit human instruction naming the target path.
AI agents and CLI tools must not reorganize Concept Spec layout to infer or express relationships.

## Term Reference Style

Use the concept map as the lookup table for Concept IDs, display names, glossary terms, and spec paths.

Concept IDs and file paths use kebab-case for machines and files.
Concept Spec prose should use the human-facing display name from the concept map.

When a Concept Spec references another Concept or a glossary term, write the term as inline code.
For example, write `Transfer Setting`, `Destination Link`, or `source key`.

Do not add per-term links in Concept Spec prose by default.
Links are harder to maintain and can create noisy documents.
Readers and agents should use `concept-map.md` to resolve a display name or glossary term to the owning Concept Spec.

The concept map should therefore expose both:

- a machine-facing `Concept ID`
- a human-facing `Display Name`

Glossary terms that are not standalone Concept Specs should live in a dedicated `Glossary Terms` section of the concept map.
They should not be added to `concept-relationship.json` unless a future CLI check needs machine-readable glossary metadata.

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

## concept-relationship.json

Package-level `concept-relationship.json` records concept discovery metadata for Concept Maps and future CLI checks.

For defined concepts, use `status: "defined"` and point to `SPEC.md`:

```json
{
  "id": "dirty-key",
  "status": "defined",
  "path": "dirty-key/SPEC.md",
  "summary": "変更が起きた可能性のある発生元行を識別する変更検知履歴"
}
```

For draft concepts, use `status: "draft"` and point to `DRAFT.md`:

```json
{
  "id": "example-concept",
  "status": "draft",
  "draftPath": "example-concept/DRAFT.md",
  "summary": "Draft concept under human review."
}
```

Do not put both `path` and `draftPath` on the same concept entry.
`path` means the concept is defined.
`draftPath` means the concept is unfinished.

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
- detect invalid `DRAFT.md` / `SPEC.md` lifecycle states

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
- one concept directory contains both `SPEC.md` and `DRAFT.md`
- `concept-relationship.json` marks a concept as `defined` but its `path` is missing or does not exist
- `concept-relationship.json` marks a concept as `defined` while that concept directory still has `DRAFT.md`
- `concept-relationship.json` marks a concept as `draft` but its `draftPath` is missing or does not exist
- `concept-relationship.json` marks a concept as `draft` while `SPEC.md` exists in that concept directory
- a concept directory with `SPEC.md` or `DRAFT.md` is missing from `concept-relationship.json`

Warnings:

- a Concept Spec has no visible references from `AGENTS.md`, `docs/concepts/README.md`, `README.md`, or `spec-relationship.json`
- a spec is becoming too long
- a spec has many additional dependencies
- constants look duplicated across specs
- a draft concept is used as a production dependency or process premise without explicit human approval
- a draft concept remains unresolved for a long time
- a draft concept appears under `Defined Concepts` in `concept-map.md`

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
