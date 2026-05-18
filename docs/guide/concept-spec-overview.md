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

## Authority Model

Humans own Concept Spec authority.

AI agents may review drafts, point out contradictions, suggest wording, find missing references, and report candidate concepts.
They must not decide that a draft concept is authoritative, create a new Concept Spec, promote a concept, redefine concept ownership, move, split, merge, or reorganize the concept graph unless the current issue explicitly names the target Concept Spec, the requested action, and the intended destination or ownership change.

This keeps AI useful as a reviewer and consistency checker without making it the source of domain truth.

## Concept Spec Format Rules

Use a `concept.json` file for the human-readable specification body.

A Concept Spec should usually include:

- `Definition`: what the concept is
- `Responsibilities`: what the concept owns
- `Non-responsibilities`: what the concept does not own
- `Invariants`: rules that later implementations must preserve

Use short additional sections when they explain an important design decision.
For example, a `Why` section can preserve why a responsibility boundary was narrowed.

Do not keep per-spec `Related Terms` lists when the package has generated concept review views or machine-readable relationship files.
Concept relationships should be normalized at the concept root, primarily in `concept-relationship.json`, so relationship maintenance does not drift across individual specs.
Generated Concept review pages may present that metadata as human review views, but relationship facts should not exist only in generated pages.

Avoid copying generic Concept Spec management rules into every individual spec.
Package-level guidance and repository documentation should carry the common rules.

Concept Spec prose may reference other Concepts or glossary terms with inline code, such as `Transfer Setting` or `source key`.
Do not require inline Markdown links for every term; generated Concept review views and relationship metadata should be the lookup surface.

Concept Specs should avoid scope tables, relationship tables, or generated indexes that are only useful as review aids.
If a view can be generated from structured metadata, keep the metadata as the maintained source and generate the view.

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
If the owner is obvious from `concept-relationship.json` or a generated Concept Map review view, a short pointer is enough.
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
| concept-relationship.json | machine-readable concept graph, lifecycle, glossary, and relationship metadata |
| Concept Map | generated or regeneratable human review view for concept lists, glossary terms, lifecycle status, and static relationships |
| DFD | coarse logical data-flow harness for business operations, timing, actors, inputs, outputs, and system boundaries |
| DFD relationship metadata | machine-readable compiled logical model for DFD terms, concept groups, inputs, and outputs |
| Issue | the change request for the current work |
| feature-local spec | feature-specific behavior that has not become a cross-feature concept |
| DDL comment | table, column, and constraint meaning |
| queryspec | SQL input/output contract |
| code comment | local reason that is easiest to understand near the code |
| test / ZTD | executable verification |
| RFBA boundary | reviewable implementation surface |
| ztd-cli | scaffold, report, and structural check support |

## Relationship To Issues

An Issue is a change request, not the source of durable domain meaning.

Issues should reference the relevant Concept Specs, DFDs, Process Maps, or feature-local specs that constrain the work.
If an issue needs a concept that does not exist yet, the issue should call that out as concept work instead of allowing implementation to invent the concept implicitly.

Reviewing an issue therefore includes checking whether the issue is grounded in the approved concept and process context.

## Review Support Views

Logical-model prose is human-owned.
AI agents may help structure, compare, and review it, but they do not own the domain truth.

Review support views are derived views over logical-model metadata.
They may include Concept Maps, Concept indexes, DFD group indexes, Process Map indexes, generated VitePress source pages, table-definition review pages, and other coverage or drift dashboards.

These views are useful because humans are bad at spotting missing entries, stale links, duplicated terms, and lifecycle gaps across many documents.
However, review support views should be regeneratable from structured metadata whenever possible.
They may be kept out of version control if the project can recreate them deterministically.

Do not put durable facts only in a review support view.
If a fact needs to be searched, counted, checked, linked, or used by AI/CLI without inference, put it in structured metadata such as `concept-relationship.json`, `docs/dfd/relationship.json`, `docs/processes/process-map.json`, `db/ddl/relationship.json`, `db/ddl/table-docs.json`, or `db/ddl/order.json`.

## Concept-Driven Development Flow

Concept Spec work follows an intentionally staged development style.

The default order is:

```text
Concept -> DFD -> Process -> DDL -> RFBA -> Verification
```

This is not a waterfall process.
Each stage is a review harness for the next stage, and findings may flow backward.

1. Create and review Concept Specs.
2. Create and review DFDs when the domain needs business-operation, timing, actor, input/output, or system-boundary clarity.
3. Create and review Process Maps only when the logic is complex enough to need process-level flow and concrete concept input/output.
4. Feed DFD and Process Map findings back into Concept Specs when they expose a missing concept, ambiguous term, duplicate concept, or responsibility gap.
5. Design DDL after the relevant DFD and required Process Map surfaces make the physical design derivable.
6. Implement with RFBA after the logical review surfaces and DDL review surfaces are stable enough.
7. Verify with mechanical checks, SQL/ZTD tests, package tests, and generated review reports as appropriate.

Concept Specs are not expected to become perfect from desk review alone.
They should be correct enough to protect durable meaning, responsibility boundaries, and invariants.
When a DFD or Process Map cannot express the use case without inventing undefined terms, contradicting a Concept Spec, or hiding a responsibility gap, update the Concept Spec or the relevant structured relationship metadata before continuing.

Initial Concept Specs may be rough.
They should still be independently explainable as concepts, but their relationship graph may remain incomplete until DFD review exposes how the concepts are used.

DFD review is the point where concept usage becomes visible.
Before moving from DFD toward DDL, the DFD should identify the relevant business operation, event timing, actor, input/output data, and system boundary.
The DFD does not need to define every detailed process, but it should make it clear where a concept is created, read, or used.

Process Maps are optional and risk-driven.
Create them for complex or critical logic that needs proof that the use case can be derived from the approved concepts.
A Process Map may be created before every DFD is complete when a core risk needs early validation.
Simple master registration, CRUD, or query-only work may skip a Process Map when the DFD is enough.

DDL is physical design derived from the logical model.
Before DDL review, the relevant subsystem ownership should be clear enough that create/update/delete responsibility does not cross subsystem boundaries accidentally.
Subsystems are logical boundaries first; they are not automatically database schemas.

Logical models are requirements-like artifacts.
Humans should own and write the durable meaning, but prose alone is weak at coverage, overview, and drift detection.
Therefore each human-readable logical design should have structured metadata where the stable relationships can be recorded without repeated inference.
Human review views may exist, but they should be generated from structured metadata whenever possible so review format changes do not require AI or humans to re-infer the graph.

Review support views are not authoritative logical models.
They exist to help humans inspect coverage, lifecycle state, relationships, and omissions.

The intended operating model is simple:

- AI drafts Concept, DFD, Process, relationship, and DDL candidates.
- Humans review and accept concept ownership, promotion, boundaries, and domain meaning.
- CLI checks detect structural drift, broken references, duplicate or missing metadata, and generated-doc inconsistencies.
- Review skills use the mechanical check output as evidence, then add human-facing semantic review where judgment is required.

## Artifact Grounding

Artifacts that carry domain meaning should usually be grounded in the logical model.

For example:

- DDL usually physicalizes Concepts, DFD outputs, Process outputs, current-state records, or durable processing records.
- RFBA features usually implement a business operation, a Process Map, or a narrow feature-local use case constrained by Concepts.
- SQL and queryspecs should be reviewable against the Concept, DFD, Process, or DDL responsibility they serve.
- Tests should make it possible to see which concept/process/SQL contract they protect when that relationship is important.
- Generated documentation is a review view over source artifacts and structured metadata, not the durable source of meaning.

Do not force every artifact to link to a Concept.
Framework glue, generated code, technical support tables, caches, operational control tables, or purely mechanical checks may be valid without being standalone domain concepts.
When such an artifact affects business behavior, classify its role clearly and record the reason in structured metadata instead of leaving the connection to reviewer inference.

If an artifact has business meaning but cannot be traced to a Concept, DFD, Process Map, feature-local spec, or explicit technical-support classification, treat that as a review risk.

DFDs are intentionally coarser than Process Maps.
They are often created alongside or soon after Concept Specs, before detailed process review.
A DFD should show what business operation runs, when it runs, who or what performs it, which data enters, which data leaves, and which system boundary is crossed.
It should not force detailed process order, SQL, transaction design, or physical storage.

DFDs may use DFD Concept Groups to keep diagrams readable.
For example, a DFD may group several concrete Concepts under `Transfer Configuration` when the data-flow question does not need each concrete concept node.
These groups are explanation labels for DFD readability, not standalone runtime concepts.
They are useful when business operations need to be reviewed before every concrete Concept boundary has been fully expanded in the diagram.
The group lets reviewers discuss the business data flow at the right grain while still requiring a later expansion to concrete Concepts or explicit non-concept terms.
Process Maps must not use DFD Concept Groups; Process Maps should expand to concrete Concepts in detail views.

Process Maps are optional.
Create them for complex flows that combine multiple concepts, branching decisions, duplicate prevention, auditability, history, or state transitions.
Do not create Process Maps for every CRUD feature or simple query.

## DFD Format Rules

DFD Markdown is a human-readable business-operation flow, not physical design.
It should be readable without opening JSON, but it should not duplicate mechanically extractable metadata in handwritten scope tables.

A DFD Markdown file should usually include:

- `## Purpose`
- `## Overall Flow`
- `## Boundary` when system boundary matters
- one `## <Business Operation> Detail Flow` per business operation
- optional notes or review points

Overall flow diagrams should:

- use `flowchart TD`
- show business operations and their high-level data dependency
- avoid detail-level input/output, storage design, SQL, DDL, functions, classes, and transaction details

Detail flow diagrams should:

- use `flowchart LR`
- describe one business operation
- include independent Mermaid nodes for `When:` and `Who:` when timing or actors matter
- use separate nodes for event timing, role, business operation, system-scope storage, and external storage
- use business-operation nodes visually distinct from role and storage nodes
- use solid arrows for data flow
- use dotted arrows for trigger, responsibility, control, or context
- avoid hiding roles or timing only inside prose or operation labels
- avoid handwritten Scope tables for role, timing, input, or output metadata

When multiple roles can perform the same business operation, model them as multiple `Who:` nodes.
Do not combine roles into a single "A or B" role label.

DFD roles should be role names or system actor names.
They should not be vague descriptions such as "the entity that starts the process" when a clearer role such as "user", "scheduler", or "external producer" is available.

Machine extraction should be explicit:

- tools may extract roles from Mermaid `Who:` nodes
- tools may extract timing from Mermaid `When:` nodes when needed
- `docs/dfd/relationship.json` should own stable DFD IDs, business-operation IDs, input/output references, DFD Concept Groups, external stores, and derived views
- if metadata cannot be extracted mechanically from Mermaid, add it to structured metadata or define a stable Mermaid convention
- do not rely on repeated AI inference from prose to rebuild DFD metadata

DFDs may use DFD Concept Groups.
Process Maps must not use DFD Concept Groups.

## Subsystems

Subsystems are logical ownership boundaries for DFDs, processes, and later physical design review.

A subsystem should help reviewers understand which business operations own create/update/delete responsibility and which other subsystems may only read or depend on the resulting data.
Cross-subsystem reads may be valid, but cross-subsystem create/update/delete paths should be explicit and reviewed.

Do not treat a subsystem as a database schema by default.
Small products may use one physical schema while still keeping logical subsystem ownership in DFD metadata.
Large products may choose to map subsystems to database schemas or other physical deployment boundaries, but that is a physical design decision, not the definition of a subsystem.

Before DDL design, assign business operations to subsystems when the domain is large enough that ownership would otherwise become unclear.
This reduces physical-design churn by making CUD ownership visible before table layout and schema naming decisions begin.

## Process Map Rules

Process Maps are long-lived logical review documents, not implementation procedures.

Mermaid diagrams in Process Maps should be Step Functions-like process maps.

Main routine diagrams should:

- use `flowchart TD`
- show process order
- have explicit `start` and `done` nodes
- contain process and branch nodes only
- avoid storage nodes, data stores, DDL details, SQL, functions, classes, and implementation artifacts

Detail diagrams should:

- explain one process only
- use `flowchart LR`
- show concept-level input, the process, and concept-level output
- treat temporary logical outputs as allowed review aids, but keep final outputs grounded in defined Concepts when possible
- avoid calling the next subprocess unless that call is the subject of the detail view

When a diagram describes movement, fixation, transfer, tracing, or result recording, route the relationship through an operation or routine node.
Diagram arrows should not imply that data moves directly from one stored concept to another.

Process Maps must use concrete Concepts, glossary terms, external stores, or explicitly registered derived views.
They must not use DFD Concept Groups.
DFD Concept Groups are allowed in DFDs only, where coarse business-operation review needs a simpler view.

Process Maps may be supported by `docs/processes/process-map.json`.
That metadata should record process map IDs, source Markdown paths, views, typed process inputs, typed process outputs, process-local derived views, external stores, and related Concepts.
Use `inputs` and `outputs` for concept-level process I/O.
Use `relatedConcepts` for Concepts that explain or classify the view but are not the direct input or output.
Use `uses` for Concepts that represent the operation semantics used by the process.
This lets tools detect missing process documents, stale links, unknown Concepts, unknown external stores, unknown derived views, and accidental use of DFD-only groups.

Each Process Map Markdown file should link to this section so new process documents inherit the same review rules instead of copying them.

This flow is deliberately not physical design.
Concept Specs, DFDs, and Process Maps should avoid DDL details, SQL shape, Zod schemas, API paths, function names, class structure, file layout, and transaction implementation unless the user explicitly asks for a separate implementation design.
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
| concept-relationship.json | store machine-readable concept names, glossary terms, lifecycle state, and static relationships |
| Concept Map | generated or regeneratable human review view over the concept relationship metadata |
| DFD | show coarse business-operation data flow, timing, actors, inputs, outputs, and system boundaries |
| DFD relationship metadata | compile DFD terms into a machine-checkable logical model |
| Process Map | check whether complex use cases can be expressed from approved concepts |
| Package Scope Spec | define the package ownership boundary, out-of-scope work, and package-wide invariants |
| Package Test Policy | define the package verification strategy that review skills and PR checks must consider |
| Package Review Authority Model | define which artifacts are human-owned requirements, AI-led review work, or CLI-owned review views |
| Package Technology Policy | define package-level technology constraints and review-trigger exceptions |
| RFBA | expose the implementation surfaces humans should review |
| ztd-cli / ZTD / tests | provide scaffold, generated artifacts, drift checks, and executable verification |
| review-plan | provide deterministic review inputs from changed files, relationship metadata, Package Scope, Test Policy, Authority Model, and Technology Policy |
| agent workflow skills | guide planning, TDD, verification, review, branch work, and subagent execution |

Agent workflow skills are useful after the concept and process context is known.
For example, they may enforce verification before completion, help split implementation tasks, or structure review checkpoints.

When a `review-plan` is available, review skills should treat it as the read-order harness instead of rediscovering related context by inference.
The review should load Package Scope, Package Test Policy, Package Review Authority Model, Package Technology Policy, changed-file required reads, relationship metadata, and then the changed artifact itself.
If `review-plan` reports unresolved links or unmapped business-bearing artifacts, the review should surface those metadata gaps rather than guessing the missing relationships.

Package Review Authority Model controls who may treat each review input as authoritative.
Requirement-like Concept Specs, DFDs, Process Maps, Scope Specs, and human-stated issue requirements are human-owned.
Review skills are AI-led review management and must keep their conclusions approval-oriented.
Generated Review Reports, VitePress pages, metadata checks, and review-plan snapshots are CLI-owned review inputs, not source documents.

Package Technology Policy is not a Concept Spec.
It records implementation constraints such as database platform, SQL-first path, standard CLI surface, and review-trigger exceptions.
Review skills should report technology-policy exceptions explicitly instead of changing concept/process meaning to fit implementation choices.

They should not generate authoritative concept prose, promote draft concepts, reorganize Concept Spec layout, or decide concept ownership.
If a workflow skill discovers an unclear concept boundary, it should report the ambiguity and route the work back to Concept Spec or Process Map review.

In short: Concept Specs say what must be protected; workflow skills help agents do the work without skipping the guardrails.

## Placement

Package-local Concept Specs live under package documentation, not under TypeScript source folders:

```text
packages/<package-name>/docs/concepts/
  README.md
  concept-relationship.json
  <concept-name>/
    concept.json

packages/<package-name>/docs/processes/
  process-map.json
  <process-name>-process.md

packages/<package-name>/docs/dfd/
  README.md
  relationship.json
  <dfd-name>.md
```

`packages/<package-name>/docs/concepts/README.md` is the package-local entrypoint.
It lists available Concept Specs and can describe package-specific reading order.

Individual concepts own their durable specification in their own directory:

```text
packages/transfer/docs/concepts/dirty-key/concept.json
```

Concept folders are stable anchors.
When a concept is still under discussion, keep the same concept directory and still use `concept.json` as the structured source of truth.
Use `DRAFT.md` only as supplemental notes, meeting material, or unresolved draft prose:

```text
packages/transfer/docs/concepts/<concept-id>/
  concept.json
  DRAFT.md
```

`DRAFT.md` is a visible TODO and review target, but it is not an authoritative Concept Spec.
Agents may review it, point out contradictions, and propose wording, but they must not treat draft content as a stable premise for implementation unless the current issue explicitly asks for that draft to be used.

When the concept is approved, promote it in place:

1. Update lifecycle status in `concept.json`.
2. Remove `DRAFT.md` when the draft notes are no longer needed.
3. Update `concept-relationship.json` from `status: "draft"` to `status: "defined"` and remove `draftPath` when the notes are no longer needed.
4. Regenerate or refresh generated Concept review views from the structured metadata.
5. Recheck DFDs, Process Maps, and feature references that depended on the draft wording.

Do not use a separate `_drafts/` folder for ordinary concept drafts.
The concept directory keeps links stable, makes unfinished work visible, and keeps promotion cheap.

Keep Concept Spec directories flat by default.
Do not use nested folders to express dependency, execution order, ownership, or transfer-model grouping.

Concept relationships are graph-shaped, not tree-shaped.
A concept may participate in multiple views, such as execution, transfer model, change detection, audit, lineage, or SQL generation.

Represent concept dependencies, static relationships, and glossary lookup in:

- `concept-relationship.json`

Represent generated concept coverage and relationship review views through the docs generation pipeline, such as VitePress Concept pages.

Represent process order, use-case flow, and input/output process details in process maps under:

- `docs/processes/`

Represent business-operation data flow, event timing, actor ownership, input/output data, and system boundaries in DFDs under:

- `docs/dfd/`

DFDs are allowed to use DFD Concept Groups when concrete Concept lists would make the diagram too noisy.
DFD Concept Groups are not normal Concept Specs and should not be placed under `docs/concepts/`.
They are DFD-only virtual display labels that exist in `docs/dfd/relationship.json`.
Their concrete Concept or external-store members must be derivable from that metadata.
Do not maintain a separate handwritten membership document for them.

Process Maps must not use DFD Concept Groups.
They should use concrete Concept names in detail diagrams so process-level input/output remains reviewable.

Filesystem nesting should be used only when a concept is truly a sub-concept that cannot be understood without its direct parent and does not naturally belong to multiple parents.

Feature-local specs, when needed, stay close to the feature:

```text
packages/<package-name>/src/features/<feature-name>/
  concept.json
  spec-relationship.json
```

Feature-local `concept.json` files describe feature-specific behavior.
They are not Concept Specs unless they are promoted to `docs/concepts/` by explicit human decision.
Feature-local specs may depend on Concept Specs, but they must not redefine Concept Specs.

## Concept Map Rules

Do not build a Concept Spec dependency tree on the filesystem.

Start with one direct directory per concept:

```text
docs/concepts/
  concept-relationship.json
  dirty-key/
    concept.json
  lineage/
    concept.json
```

Use `concept-relationship.json` as the package-level structured source for concept names, glossary terms, lifecycle state, and static concept relationships.

Use the Concept Map as a human review view generated or regenerated from that structured source.
It helps humans review coverage, draft/defined status, glossary terms, and static relationships, but it should not become a separate hand-maintained source of truth.
If the Concept Map format changes, regenerate it from structured metadata instead of re-inferring the concept graph from prose.

The Concept Map is a lookup and review index, not a business-flow document.

Keep maintenance workflows, registration flows, input/output data movement, timing, actors, and system-boundary questions in DFDs.
Keep process order and detailed process input/output in Process Maps.
If a static relationship starts to read like "how to register, update, search, or maintain this data", move that view to a DFD or Process Map instead of keeping it in the Concept Map.

Separate defined and draft concepts in the human-facing map:

- `Defined Concepts` have an approved `concept.json`.
- `Draft Concepts` have `concept.json` with `status: "draft"` and may have supplemental `DRAFT.md` notes.

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

Use `concept-relationship.json` as the structured lookup table for Concept IDs, display names, glossary terms, and spec paths.
Use the Concept Map as the human-facing view over that lookup table.

Concept IDs and file paths use kebab-case for machines and files.
Concept Spec prose should use the human-facing display name from the concept map.

When a Concept Spec references another Concept or a glossary term, write the term as inline code.
For example, write `Transfer Setting`, `Destination Link`, or `source key`.

Do not add per-term links in Concept Spec prose by default.
Links are harder to maintain and can create noisy documents.
Readers and agents should use `concept-relationship.json`, or a generated Concept Map review view derived from it, to resolve a display name or glossary term to the owning Concept Spec.

The structured metadata and generated Concept Map should therefore expose both:

- a machine-facing `Concept ID`
- a human-facing `Display Name`

Glossary terms that are not standalone Concept Specs should live in `concept-relationship.json` when tools or agents need to resolve them without inference.
The Concept Map may render those entries in a dedicated `Glossary Terms` section for human review.

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
      "path": "../../docs/concepts/dirty-key/concept.json",
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
It is the structured source for generated Concept Map review views.

Keep information that must be searched, counted, checked, or regenerated here rather than only in prose.
Examples include concept IDs, display names, lifecycle status, spec paths, glossary terms, static relationships, and relationship reasons.
This lets tools answer questions such as how many draft concepts remain, whether a referenced concept exists, and whether a generated review view is stale.

`summary` is allowed as a short index note for humans, AI agents, and generated review views.
It may be written by a human or proposed by an AI agent, but it is not authoritative concept prose.
The owning `concept.json` remains the source of concept meaning. `DRAFT.md` may record supplemental draft notes but is not the authoritative source.
Keep `summary` to about one sentence, avoid implementation detail, and do not use it as the basis for implementation decisions.
If `summary` conflicts with the spec body, the spec body wins and the summary should be corrected.

The same rule applies to other short metadata notes such as glossary `meaning`, glossary `note`, concept `note`, and relationship `reason`.
They are search, discovery, and review-aid text.
They may make generated indexes easier to use, but they must not become a second source of concept truth.
When they conflict with the owning Concept Spec or approved logical model, correct the metadata.

For defined concepts, use `status: "defined"` and point to `concept.json`:

```json
{
  "id": "dirty-key",
  "status": "defined",
  "path": "dirty-key/concept.json",
  "summary": "変更が起きた可能性のある発生元行を識別する変更検知履歴"
}
```

For draft concepts, use `status: "draft"` and point `path` to `concept.json`.
Use `draftPath` only when supplemental draft notes exist:

```json
{
  "id": "example-concept",
  "status": "draft",
  "path": "example-concept/concept.json",
  "draftPath": "example-concept/DRAFT.md",
  "summary": "Draft concept under human review."
}
```

For draft concepts, `path` is still the structured source of truth.
`draftPath` points only to supplemental notes.

## Why Relationship Metadata Exists

Concept Specs are intentionally human-readable, but prose alone is not a reliable harness.

A natural-language specification can contain missing terms, renamed concepts, stale assumptions, unresolved ownership, or responsibility gaps that are difficult for humans and AI agents to notice during ordinary reading.

Relationship metadata exists to make those failures visible before implementation review.

It is not a second specification body.
It does not prove semantic correctness.
It records the concept graph, draft/defined lifecycle, DFD inputs and outputs, concept groups, and feature dependencies so tools and agents can detect unresolved references, stale links, hidden ownership gaps, and drift between human-readable documents and structured design metadata.

In other words, prose explains the meaning.
Relationship metadata makes the review surface searchable, checkable, and harder to silently bypass.
Relationship metadata is therefore a review index, not a replacement for human judgment.

## DFD relationship.json

Package-level DFD metadata records the compiled logical model behind human-readable DFD Markdown.

The Markdown files remain the human-readable logical design.
The structured file exists so CLI tools and agents do not have to infer the same concepts, groups, inputs, outputs, and external stores from prose every time.

DFD Concept Groups are virtual grouping labels for DFD diagrams.
They are not Concept Specs and are not normal Markdown-owned documents.
Their identity, display name, scope, and members should live in `docs/dfd/relationship.json` so tools can expand a group into its concrete Concepts or external stores without inference.

A DFD Concept Group exists only to simplify a DFD view.
It is similar to a folder, section heading, or composite label: it bundles existing terms for the diagram but does not create a new domain concept.
For that reason, a group must not own responsibilities, non-responsibilities, invariants, DDL, Process Map detail, or feature behavior.

The benefit is that early business definitions can be reviewed without forcing every DFD to show every concrete Concept node.
For example, a DFD can say that `Transfer Execution` reads `Transfer Configuration`, while `relationship.json` records that the group expands to `Transfer Setting`, `Destination Link`, and `Destination`.

This shortcut is only safe when expansion is mechanical.
Every DFD Concept Group must have members in `docs/dfd/relationship.json`.
Each member must resolve to a defined Concept or an explicit allowed non-concept term such as an external store or derived view.
If a group has no members, references an unknown member, or is used outside DFDs, treat it as a structural check finding.

Do not maintain handwritten group membership in a separate Markdown file.
If humans need a group index, generate or check it from `docs/dfd/relationship.json`.

Use `docs/dfd/relationship.json` to record:

- DFD subsystems
- DFD Concept Groups
- members of each DFD Concept Group
- external stores referenced by DFDs
- derived views when they are intentionally used as intermediate logical outputs
- DFD business operations
- DFD input and output references

Example:

```json
{
  "schemaVersion": 1,
  "subsystems": [
    {
      "id": "batch",
      "displayName": "Batch",
      "summary": "Batch-oriented business operations."
    }
  ],
  "externalStores": [
    {
      "id": "source-data",
      "displayName": "Source Data"
    }
  ],
  "conceptGroups": [
    {
      "id": "transfer-configuration",
      "displayName": "Transfer Configuration",
      "scope": "dfd-only",
      "members": [
        { "type": "concept", "id": "transfer-setting" },
        { "type": "concept", "id": "destination-link" },
        { "type": "concept", "id": "destination" }
      ]
    }
  ],
  "dfds": [
    {
      "id": "transfer-execution-data-flow",
      "displayName": "Transfer Execution Data Flow",
      "subsystem": "batch",
      "path": "transfer-execution-data-flow.md",
      "businessOperations": [
        {
          "id": "transfer-execution",
          "displayName": "Transfer Execution",
          "inputs": [
            { "type": "concept", "id": "dirty-key" },
            { "type": "concept-group", "id": "transfer-configuration" }
          ],
          "outputs": [
            { "type": "concept", "id": "transfer-run" }
          ]
        }
      ]
    }
  ]
}
```

DFD pages are generated as subsystem and business views:

```text
docs/dfd/
  index.md
  <subsystem-id>/
    index.md
    business/
      <business-id>.md
      <business-id>/
        process/
          index.md
          <process-id>.md
```

The DFD root page is an index. A subsystem page owns the business correlation for that subsystem.
A business page owns the business definition.
Related Process Maps are business-owned views because a Process Map explains how one business operation is decomposed into reviewable logical steps.
Do not generate or maintain intermediate pages such as `docs/dfd/<dfd-id>.md`; they blur the boundary between subsystem indexes and business definitions.

Allowed DFD reference types should start small:

- `concept`
- `concept-group`
- `external-store`
- `derived-view`

DFD Concept Group members should normally be concrete `concept` entries or explicit `external-store` entries.
Do not nest DFD Concept Groups unless a future CLI check also handles cycle detection and expansion.

The DFD metadata should let a structural checker answer these questions without natural-language inference:

- Does every DFD input/output resolve to a defined Concept, a DFD Concept Group, an external store, or an allowed derived view?
- Does every DFD Concept Group member resolve to a defined Concept or allowed non-concept term?
- Does every referenced DFD Markdown file exist?
- Does DFD Markdown expose parseable `Who:` nodes when role review views depend on them?
- Does DFD Markdown expose parseable `When:` nodes when timing review views depend on them?
- Do DFD operation IDs and input/output references in metadata stay aligned with the human-readable Mermaid flow?
- Does any Process Map use a DFD-only Concept Group?

These checks do not prove semantic correctness.
They make drift, missing links, and unresolved terms visible before human review.

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
- detect invalid `DRAFT.md` / `concept.json` lifecycle states
- check `concept-relationship.json` concept IDs, paths, statuses, and relationship references
- check `docs/dfd/relationship.json` DFD Concept Groups, input/output references, external stores, and Markdown paths
- check `docs/processes/process-map.json` Process Map IDs, Markdown paths, view IDs, typed input/output refs, external stores, derived views, and related Concepts
- check that Process Maps do not use DFD-only Concept Groups
- check that Process Map Markdown files link to the common Process Map rules
- check that DFD Markdown exposes parseable Mermaid `Who:` nodes where role extraction is required
- check that DFD Markdown does not reintroduce handwritten Scope tables that duplicate Mermaid or relationship metadata

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
- Let DFDs define coarse business-operation data flow, timing, actors, inputs, outputs, and system boundaries.
- Let Process Maps define process order and concrete concept-level process input/output.
- Keep DFD Concept Group membership in `docs/dfd/relationship.json` so it can be mechanically checked.

If a Concept Spec carries constants, keep them in a mechanically readable `Constants` section, such as fenced YAML.
Do not add constant-drift checks until the source artifacts can be mapped reliably.

## Error And Warning Levels

Structural checks should distinguish errors from warnings.

Errors:

- `spec-relationship.json` is invalid JSON
- `dependencies[].path` does not exist
- a child spec manually lists its parent Concept Spec as a dependency
- `concept-relationship.json` marks a concept as `defined` but its `path` is missing or does not exist
- `concept-relationship.json` marks a concept as `defined` while that concept directory still has `DRAFT.md`
- `concept-relationship.json` marks a concept as `draft` but its `path` to `concept.json` is missing or does not exist
- a concept directory has `DRAFT.md` but no `concept.json`
- a concept directory with `concept.json` or `DRAFT.md` is missing from `concept-relationship.json`
- `docs/dfd/relationship.json` is invalid JSON or has an invalid schema
- a DFD input/output reference points to an unknown Concept, Concept Group, external store, or derived view
- a DFD Concept Group member points to an unknown or non-defined Concept
- a Process Map uses a DFD-only Concept Group
- `docs/processes/process-map.json` references a missing Process Map Markdown file
- `docs/processes/process-map.json` view references an unknown Process Map or Concept
- a Process Map Markdown file is missing from `docs/processes/process-map.json`
- a referenced DFD Markdown file does not exist

Warnings:

- a Concept Spec has no visible references from `AGENTS.md`, `docs/concepts/README.md`, `README.md`, or `spec-relationship.json`
- a defined or draft concept has no short `summary` index note in `concept-relationship.json`
- a `summary` in `concept-relationship.json` is too long to behave as an index note
- glossary `meaning`, glossary `note`, concept `note`, or relationship `reason` is too long to behave as review-aid metadata
- a spec is becoming too long
- a spec has many additional dependencies
- constants look duplicated across specs
- a draft concept is used as a production dependency or process premise without explicit human approval
- a draft concept remains unresolved for a long time
- a draft concept appears as a defined concept in generated Concept review views
- a DFD operation lacks parseable Mermaid `Who:` nodes where generated role views depend on them
- a DFD Markdown file contains handwritten Scope tables that duplicate Mermaid or relationship metadata
- a DFD Concept Group exists in Markdown but is missing from structured metadata, or vice versa
- a DFD relationship entry has no human-readable explanation where one is needed for review
- a Process Map Markdown file does not link to the common Process Map rules in `docs/guide/concept-spec-overview.md`

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

Relationship metadata does not replace prose.
It makes the concept graph, lifecycle state, feature dependencies, and DFD references checkable so unresolved terms, stale links, and drift become visible before implementation review.

Generated human review views such as Concept Maps may make coverage and lifecycle state easier to inspect, but they should be derived from structured metadata rather than maintained by repeated inference.

AI and CLI tools may help find, link, check, generate review views, and review Concept Specs, but they must not decide Concept Spec creation, promotion, movement, splitting, merging, or ownership without explicit human direction.
