---
name: concept-intake-organize
description: Organize early hearing notes, customer interview notes, rough memos, and chaotic domain discussions into ConceptSpec intake buckets without finalizing concepts or creating implementation tasks.
---

# Concept Intake Organize

Use this skill when early domain material needs to become reviewable before formal ConceptSpec, DFD, Process Map, feature-local spec, or scope work.

This is an upstream organization skill, not an implementation planning skill.
It preserves discovery material without making AI the authority for concept meaning.

## Purpose

- Separate raw observations from candidate concepts.
- Preserve terms, relationships, process fragments, scope candidates, and unknowns while the domain is still under discovery.
- Identify the next useful upstream artifact without forcing premature decisions.

## Required Behavior

- Treat early hearing notes as intentionally chaotic.
- Collect related information even when scope is not fixed yet.
- Do not discard information only because it may later be out of scope.
- Do not force all unknowns to be resolved.
- Preserve non-blocking unknowns.
- Identify blocking questions only when the next artifact cannot be created without them.
- Keep raw observations separate from concept candidates.
- Keep concept candidates separate from process fragments.
- Keep likely scope separate from scope candidates and out-of-scope candidates.
- Omit empty output sections.

## Do Not

- Do not finalize concepts.
- Do not promote a draft to authoritative ConceptSpec status.
- Do not create implementation tasks.
- Do not reject uncertain information too early.
- Do not treat generated docs or review views as source of truth.

## Output Shape

Use this structure and omit empty sections:

```md
# Concept Intake Organization

## Status
chaotic-but-usable | needs-follow-up | blocked-by-core-unknown

## Raw Intent
- summary:

## Raw Observations
- observation:
  source note:
  why it may matter:

## Observed Terms
- term:
  meaning candidate:
  confidence: low | medium | high
  note:

## Concept Candidates
- concept candidate:
  why it may be a concept:
  possible responsibilities:
  possible non-responsibilities:
  confidence: low | medium | high
  promote now: yes | no | later

## Relationship Candidates
- from:
  to:
  relation candidate:
  confidence: low | medium | high
  note:

## Process Fragments
- fragment:
  possible trigger:
  possible actor:
  possible input:
  possible output:
  later artifact: DFD | Process Map | unknown

## Scope Candidates
- item:
  likely status: in-scope | out-of-scope-candidate | unknown
  reason:
  finalize now: yes | no

## Unresolved Register

### Blocking Questions
- question:
  why it blocks:

### Non-blocking Unknowns
- unknown:
  why it can wait:
  revisit trigger:

### Messy Notes To Keep
- note:
  why it may matter later:

## Next Suggested Artifact
- continue hearing | draft ConceptSpec | draft DFD | draft Process Map | keep as issue note | scope decision
```
