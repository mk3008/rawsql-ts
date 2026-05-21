---
name: concept-draft-review
description: Review upstream ConceptSpec drafts, issue notes promoted toward ConceptSpec, or early design memos before they are treated as stable grounding.
---

# Concept Draft Review

Use this skill when an upstream ConceptSpec draft, issue note promoted toward ConceptSpec, or early design memo needs concept-level review before DFD, Process Map, DDL, RFBA, or implementation work.

This skill reviews upstream drafts.
It does not replace existing ConceptSpec, package-spec, or logical-model review skills for approved or structured specs.

## Purpose

- Check whether a draft is coherent enough to continue as upstream concept work.
- Find contradictions, missing definitions, boundary risks, relationship gaps, process connection gaps, and implementation leaks.
- Classify unknowns without forcing all draft uncertainty into immediate decisions.

## Required Behavior

- Review consistency against existing Concept Specs, Package Scope, DFDs, Process Maps, and relationship metadata when available.
- Treat human-authored drafts and explicit human issue requirements as human-owned.
- Do not finalize domain authority.
- Do not promote a draft concept to authoritative status unless the issue explicitly asks for that.
- Do not create implementation plans or implementation tasks.
- Do not force every unknown into a decision.
- Classify unknowns as blocking, non-blocking, or acceptable.
- Allow draft work to continue with classified unresolved items when the intended process is not blocked.
- Block progress only when the desired process cannot be explained without the missing definition or decision.
- Omit empty output sections.

## Review Dimensions

- contradictions
- missing definitions
- responsibility boundary problems
- relationship gaps
- process connection gaps
- implementation detail leaking into ConceptSpec
- unknowns that block the next artifact
- unknowns that can safely wait

## Output Shape

Use this structure and omit empty sections:

```md
# Concept Draft Review

## Status
ready-to-propose-promotion | draft-can-continue | needs-revision | needs-human-decision | blocked

## Existing Context Checked
- scope:
- concepts:
- DFDs:
- processes:
- relationship metadata:

## Findings

### Contradictions
- finding:
  why it matters:
  suggested direction:

### Missing Definitions
- finding:
  why it matters:
  suggested direction:

### Boundary Risks
- finding:
  why it matters:
  suggested direction:

### Relationship Gaps
- finding:
  why it matters:
  suggested direction:

### Process Connection Gaps
- finding:
  why it matters:
  suggested direction:

### Implementation Leaks
- finding:
  why it matters:
  suggested direction:

## Unresolved Register

### Decision Required Now
- decision:
  why it blocks:

### Decision Can Wait
- decision:
  why it can wait:
  revisit trigger:

### Acceptable Unknowns
- unknown:
  why it is acceptable:

## Suggested Next Artifact
- none | ConceptSpec update | concept-relationship metadata update | DFD draft | Process Map draft | feature-local spec | scope decision
```

## Not Authority

The review may organize, classify, and propose.
It must not approve the draft as authoritative ConceptSpec meaning by itself.
`ready-to-propose-promotion` means ready for human promotion review, not AI approval.
