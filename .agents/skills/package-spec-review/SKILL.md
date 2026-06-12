---
name: package-spec-review
description: Review rawsql-ts package-level Scope, Test Policy, Authority Model, Technology Policy, review-plan, and generated review views before package-level implementation or documentation changes.
---

# Package Spec Review

Use this skill when work touches package-level Concept Spec harnesses, package scope, verification policy, authority model, technology policy, generated review reports, or review-plan behavior.

## Authority Model

Apply the package review authority model before making review judgments:

- Human-owned requirements: Concept Specs, DFDs, Process Maps, Scope Spec, issues, and explicit human requirements.
- AI-led review management: review skills, cross-document review, review-plan required reads, and semantic findings.
- CLI-owned review views: Review Report, generated VitePress pages, metadata check output, and `tmp/transfer-review-plan.json`.

Do not treat AI proposals as approved requirements. Do not treat generated review views as source documents.

## Required Inputs

When available, load these in this order:

1. `tmp/transfer-review-plan.json`
2. Package Scope Spec and `scope-rules.json`
3. Package Test Policy and `test-rules.json`
4. Package Review Authority Model and `authority-rules.json`
5. Package Technology Policy and `tech-rules.json`
6. Changed artifacts and their `requiredReads`

If the review-plan reports diagnostics, unmapped business artifacts, or technology-policy exception warnings, surface those before semantic review.

## Technology Policy Checks

Check whether changed files imply a policy exception:

- non-PostgreSQL primary database assumptions
- ORM or ORM-like standard data access paths
- bypassing SQL-first, ztd-cli, or rawsql-ts generation/review paths
- Web UI as a transfer package front-facing surface
- generated SQL hidden from human review

These are review triggers, not automatic rejections. Report the exception reason that must be supplied, the scope impact, affected package specs, and required verification.

## Review Output

Use this shape:

- Status: `pass`, `needs-revision`, or `needs-human-decision`
- Authority inputs checked
- Package spec inputs checked
- CLI/review-plan findings
- Semantic findings
- Technology-policy exceptions
- Required human decision

## Constraints

- Do not rewrite Concept Specs, Process Maps, or policy text as final authority unless the user explicitly asks for edits.
- Do not use generated docs as source of truth.
- Do not silently skip mandatory rules from review-plan.
- Do not resolve a technology-policy exception by redefining concept/process meaning.
