---
name: package-spec-review
description: Review tracked rawsql-ts package-level Scope, Test Policy, Authority Model, Technology Policy, review-plan, and generated review views before package implementation or documentation changes. Use only when those package-owned artifacts exist in the checked-out base.
---

# Package Spec Review

Apply the owning package's tracked policy artifacts without inventing a missing harness or carrying rules forward from removed packages.

## Authority

- Human-owned requirements: Concept Specs, DFDs, Process Maps, Scope Specs, issues, and explicit human decisions.
- AI-led review management: cross-document checks, required-read planning, and findings.
- Tool-owned derived views: generated reports, metadata checks, and review plans produced by a tracked command.

Generated views are evidence and navigation aids, not requirement sources.

## Inputs

Discover tracked inputs in this order:

1. root and owning package `AGENTS.md` files;
2. package concept, scope, and design documentation;
3. tracked scope, test, authority, and technology rule registries;
4. a review plan produced by a tracked repository command, when available;
5. changed source artifacts and their declared required reads.

If no package-level harness exists, report this skill as not applicable and use the owning `AGENTS.md`, `DESIGN.md`, tests, and public contract. Do not reconstruct deleted files from ignored `dist` or `node_modules` output.

Surface diagnostics, unmapped business artifacts, missing source-to-generated traceability, and policy-exception warnings before semantic review.

## Checks

- changed behavior remains inside the owning package responsibility;
- test evidence satisfies the owning Test Policy;
- human-owned requirements are not replaced by AI or generated prose;
- technology choices follow the tracked Technology Policy or declare a human-reviewable exception;
- generated review views trace back to their tracked source and generator;
- cross-package effects and required verification are explicit.

Treat possible exceptions as review triggers, not automatic rejection. Name the policy source, exception reason, scope impact, affected packages, and verification required.

## Output

- Status: `pass`, `needs-revision`, `needs-human-decision`, or `not-applicable`
- Authority inputs checked
- Package spec inputs checked
- Derived review-plan findings
- Semantic findings
- Policy exceptions
- Required human decision

Do not rewrite human-owned requirements as final authority, use generated output as a source of truth, silently skip a tracked mandatory rule, or resolve a policy exception by redefining concept meaning.
