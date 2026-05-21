---
name: issue-concept-grounding
description: Check business-bearing or domain-meaning issues before implementation planning to confirm grounding in Concept Specs, DFDs, Process Maps, Package Scope, feature-local specs, or explicit technical-support classification.
---

# Issue Concept Grounding

Use this skill before implementation planning for business-bearing or domain-meaning work.

This is the ConceptSpec upstream gate.
It is not a grill-me clone: grill-me removes ambiguity from a request, while this skill judges whether the request has a valid grounding path before implementation planning.

## Purpose

- Decide whether implementation planning may proceed.
- Route ungrounded work back to ConceptSpec, concept review, DFD, Process Map, feature-local spec, scope decision, technical-support classification, or human decision.
- Preserve unknowns that do not block the intended next artifact.

## Required Grounding Paths

Check whether the issue is grounded in one or more of:

- existing Concept Spec
- existing DFD
- existing Process Map
- Package Scope
- feature-local spec
- explicit technical-support classification

If grounding is missing, do not proceed directly to implementation planning.
Report that implementation planning should not proceed unless a human supplies grounding or explicitly accepts the scope.

## Required Behavior

- Do not implement.
- Do not create an execution plan yet.
- Do not assume the requested thing should be built.
- Use this gate for business-bearing or domain-meaning work.
- Do not require the full gate for purely mechanical maintenance, formatting, CI fixes, or internal cleanup unless they affect business meaning or business-bearing artifacts.
- If classifying work as `technical-support`, include a reason explaining why it is not business meaning.
- If grounding exists only in a draft artifact, report that explicitly and classify whether the draft is sufficient for the current next step or requires human confirmation before implementation planning.
- AI may report that implementation planning should not proceed.
- AI must not claim final authority to reject the requirement itself.
- Preserve non-blocking unknowns with a revisit trigger.
- Omit empty output sections.

## Grounding Classifications

- existing-concept
- existing-process
- new-concept-needed
- existing-concept-review-needed
- new-process-needed
- feature-local-spec
- technical-support
- scope-expansion
- out-of-scope-candidate
- unresolved-but-non-blocking
- blocked-by-missing-business-definition
- not-accepted-as-implementation-issue

## Output Shape

Use this structure and omit empty sections:

```md
# Issue Concept Grounding

## Status
implementation-ready | concept-work-required | process-work-required | scope-decision-required | technical-support-ok | not-accepted-as-implementation-issue | blocked

## Source Issue Or Request
- summary:
- requested change:

## Grounding Result
- grounding paths:
- existing concepts:
- existing DFDs:
- existing process maps:
- package scope rules:
- feature-local specs:
- technical-support reason:
- draft grounding:
- draft sufficient for next step: yes | no | needs-human-confirmation

## ConceptSpec Grill Points
- point:
  why it matters:
  required before implementation: yes | no
  suggested route:

## Missing Grounding
- missing item:
  why it matters:
  required next artifact:

## Unresolved But Allowed
- unknown:
  why it can remain unresolved:
  revisit trigger:

## Decision
- implementation planning may proceed: yes | no
- required next artifact:
- reason:
```

## Important Rule

An issue is not implementation-ready only because it has acceptance items.
If the acceptance items require undefined business meaning, missing process definition, or unapproved scope expansion, route the work back to ConceptSpec or process definition before implementation planning.
