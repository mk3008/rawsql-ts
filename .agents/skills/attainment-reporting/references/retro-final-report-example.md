# Retro-Aware Final Report Example

Use this reference when `tmp/RETRO.md` affected the final claim or the pre-PR retro gate result must be visible to the reader.

## Example: retro item resolved before PR

```md
Source issue or request
- #730 Introduce a retro ledger and pre-PR gate for recognition mismatches.

Why it matters
- The workflow needs a place to record interpretation misses and a gate that prevents unresolved retro items from slipping into human review.

What changed
- Added a local-only retro ledger, documented when to record retro items, and made pre-PR retro review part of planning, verification, reporting, and self-review.

Acceptance items status
- acceptance item: Define a local-only retro ledger and its operating shape.
  status: done
  evidence: `tmp/RETRO.md` now defines entry fields, gate states, and a sample incident.
  gap: none
- acceptance item: Require pre-PR review of unresolved retro items.
  status: done
  evidence: repository guidance now says `open` retro items block PR readiness.
  gap: none
- acceptance item: Show how the recent dogfooding mismatch would be captured.
  status: done
  evidence: `tmp/RETRO.md` includes a sample entry based on the dogfooding interpretation mismatch.
  gap: none

Verification basis
- Repository guidance diff plus local ledger inspection were treated as sufficient evidence because this task changes workflow documentation rather than runtime behavior.

Repository evidence
- Updated `AGENTS.md`
- Updated `.codex/agents/*.md`
- Added `.agents/skills/retro-capture`
- Added `.agents/skills/pre-pr-retro-gate`

Supplementary evidence
- Reviewed `tmp/RETRO.md` locally to confirm the sample entry and gate states read cleanly.

Guarantee limits
- This proves the repository workflow now defines retro capture and gate behavior.
- It does not yet prove that the workflow feels lightweight in repeated real tasks.

Outstanding gaps
- Dogfooding on a later real task is still needed to judge friction.

Outcome or attainment level
- partial

What the human should decide next
- Accept the workflow guidance now, or require one more real-task dogfood pass before PR.

Review readiness
- ready if the reviewer accepts the remaining dogfood gap.
```

## Example: accepted defer item remains visible

Use this shape when a retro item is not fully resolved but PR handoff is still acceptable.

```md
Source issue or request
- #730 Introduce a retro ledger and pre-PR gate for recognition mismatches.

Why it matters
- The workflow should expose unresolved interpretation risk rather than bury it in narrative confidence.

What changed
- Added retro capture and pre-PR gate guidance, but one follow-up automation remains deferred.

Acceptance items status
- acceptance item: Define a local-only retro ledger and its operating shape.
  status: done
  evidence: `tmp/RETRO.md` exists with entry fields and gate semantics.
  gap: none
- acceptance item: Require pre-PR review of unresolved retro items.
  status: partial
  evidence: guidance requires the gate and the retro item is marked `accepted defer` with a stated owner and follow-up path.
  gap: automatic enforcement has not been added yet.

Verification basis
- The reporting shape is sufficient only because the defer rationale is explicit and reviewer-checkable.

Repository evidence
- Updated `AGENTS.md`
- Updated `.codex/agents/reporting.md`

Supplementary evidence
- Local review confirmed the defer rationale is written in `tmp/RETRO.md`.

Guarantee limits
- This does not guarantee automatic enforcement; it guarantees only that the remaining risk is surfaced before review.

Outstanding gaps
- Follow-up automation owner: workflow maintainer.
- Follow-up path: convert the manual gate into a script or Codex skill-backed checklist.

Outcome or attainment level
- partial

What the human should decide next
- Accept the explicit defer for now, or require automation before review handoff.

Review readiness
- not ready unless the reviewer agrees that the defer rationale is acceptable.
```

## Notes

- Keep `acceptance item`, `status`, `evidence`, and `gap` visible for every item.
- If any retro item is still `open`, do not use the accepted-defer shape; the result is blocked.
- Prefer repository evidence first and label local retro inspection as supplementary evidence.
