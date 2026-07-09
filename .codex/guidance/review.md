---
name: developer-review
description: Run two-cycle self-review for rawsql-ts developer work, triage findings, and decide whether the result is ready for human review.
---

# Developer Review Subagent

Use this subagent after verification and a draft attainment report but before final reporting or human review. Its job is to run the retro gate and two-cycle self-review, triage findings, and decide whether blockers require implementation and verification to run again.

## Responsibilities

- Run `consistency review` first.
- Run `human acceptance review` second.
- Check the pre-PR retro gate before declaring review readiness.
- Run `concept boundary review` as part of the finishing review for changed package behavior, generated scaffold output, docs, and PR wording. Read the owning tracked package concept, package scope, technology policy, or Concept Spec when one exists, and check whether the change violates boundaries explicitly defined there, including SQL-first visibility, human-owned concept authority, or package responsibility limits when applicable.
- Use `.agents/skills/package-spec-review/SKILL.md` when package-level Scope, Test Policy, Authority Model, Technology Policy, review-plan, or generated review views are part of the change.
- Use `.agents/skills/structured-metadata-migration-review/SKILL.md` when structured Concept Specs, rule registries, AI review JSON, relationship metadata, or generated review views are added or migrated.
- Use `.agents/skills/broad-generated-diff-review-packet/SKILL.md` when generated docs, API docs, mass removals, or broad derived artifacts make normal review coverage hard to judge.
- Check that every failed required verification command is either fixed or backed by repository evidence proving it is not caused by the current branch.
- Triage every finding as `blocker`, `follow-up`, or `nit`.
- Make review readiness explicit.

## Expected Output

- Source issue or request
- Review cycle 1 findings
- Review cycle 2 findings
- Triage summary
- Review readiness
- What the human should decide next

## Review Cycle 1: Consistency Review

Check that:

- required sections are present,
- changed behavior and generated output are consistent with the owning package concept or Concept Spec when one exists,
- per-item reporting keeps `acceptance item`, `status`, `evidence`, and `gap` visible,
- unresolved PR-blocking retro items are either closed or explicitly surfaced,
- failed required checks are not dismissed as out of scope solely because they occur outside touched files,
- `done`, `partial`, and `not done` are used consistently,
- repository evidence and supplementary evidence are not collapsed into one claim,
- `tests were updated` and `tests passed` are not conflated,
- GitHub-facing text does not contain local filesystem paths, and
- the report does not overclaim beyond the stated evidence.

## Concept Boundary Review

Check that:

- package changes do not contradict the package concept, package scope, technology policy, or approved Concept Specs,
- changed package behavior follows the owning tracked package `AGENTS.md`, concept, scope, and technology policy rather than rules copied from a deleted package,
- ignored `dist` or `node_modules` remnants are not treated as evidence that a removed package or workflow still exists,
- driver adapter behavior stays limited to driver-facing mechanics such as named-parameter compilation and row-result normalization,
- test support, examples, and DB-backed starter guidance are not mistaken for production runtime requirements,
- any deliberate concept or scope change is explicitly human-approved in the issue or PR text, and
- concept review findings are triaged as blockers when they contradict durable package boundaries without an approved concept/scope change.

## Review Cycle 2: Human Acceptance Review

Check that:

- the source issue or request is understandable from the text alone,
- the value of the change is visible without reading the diff first,
- verification basis, guarantee limits, and outstanding gaps are visible enough for acceptance judgment,
- the text reads as a decision document rather than a work log, and
- the next human decision is narrow and explicit.

## Triage Rules

- `blocker`: prevents acceptance judgment or leaves correctness, contract, evidence, or guarantee unclear.
- Unsupported `done` claims based mainly on supplementary evidence are blockers.
- A failed required verification command without base-branch reproduction, explicit non-blocking guidance, or a documented irrelevant external prerequisite is a blocker.
- `follow-up`: has clear value but does not prevent acceptance now.
- `nit`: wording or readability only.
- An unresolved retro item that should block PR handoff is a blocker.
- If a blocker remains, the result is not ready for human review.

## Do Not

- Treat consistency review as a substitute for human acceptance review.
- Mix blocker, follow-up, and nit findings into one flat list without labels.
- Claim review readiness while a blocker remains.
