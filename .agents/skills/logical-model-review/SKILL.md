---
name: logical-model-review
description: Review rawsql-ts logical-model and implementation changes using ddl-docs review-plan output as the deterministic read order. Use when reviewing Concept Specs, Package Scope Specs, DFDs, Process Maps, DDL metadata, table docs, generated transfer docs, or RFBA changes that should be grounded in package scope, concept, process, and verification policy context.
---

# Logical Model Review

Use this skill to review changes without rediscovering context by inference.

The review source order is:

1. `review-plan.mandatoryScope.files`
2. `review-plan.mandatoryScope.rules`
3. `review-plan.mandatoryVerification.files`
4. `review-plan.mandatoryVerification.policies`
5. `changedFiles[].requiredReads.scopeRules`
6. `changedFiles[].requiredReads.concepts`
7. `changedFiles[].requiredReads.dfds`
8. `changedFiles[].requiredReads.processes`
9. `changedFiles[].requiredReads.ddlRelationships`
10. `changedFiles[].requiredReads.testPolicies`
11. the changed file itself

## Workflow

1. Generate or request a `review-plan` for the changed files.
2. Read mandatory scope and verification files before reviewing individual changes.
3. Read each changed file's required reads in the order above.
4. Treat `review-plan.diagnostics` and `unmappedArtifacts` as review inputs, not as optional noise.
5. Review semantic consistency only after the deterministic context has been loaded.

## Review Rules

- Do not infer missing Concept, DFD, Process, DDL, Scope, or Test Policy links when `review-plan` can provide them.
- If `review-plan` cannot resolve a link, report the diagnostic or metadata gap instead of guessing.
- Treat generated docs as review views, not source of truth.
- Treat `summary`, `reason`, `note`, and `reviewAction` metadata as review aids, not authoritative domain meaning.
- Ground semantic findings in the owning Package Scope Spec, Concept Spec, DFD, Process Map, DDL relationship metadata, or Test Policy.
- When a changed artifact is business-bearing and unmapped, report a reviewability gap before reviewing implementation details.
- Keep meaning review separate from mechanical check results: cite mechanical failures, then add semantic findings only where human judgment is needed.
- Do not convert every missing detail into a blocker.
- Block only when the missing concept, relationship, process, or scope decision prevents safe implementation judgment or breaks the intended business process.
- Report intentionally unresolved items as unresolved-but-acceptable when they do not block the reviewed process or implementation decision.

## If No Review Plan Exists

Prefer creating one instead of manually searching.

Use the repository command shape:

```bash
node packages/ddl-docs-cli/dist/src/index.js review-plan \
  --changed-files <changed-files.txt> \
  --ddl-dir packages/transfer/db/ddl \
  --relationship packages/transfer/db/ddl/relationship.json \
  --table-docs packages/transfer/db/ddl/table-docs.json \
  --concept-relationship packages/transfer/docs/concepts/concept-relationship.json \
  --dfd-relationship packages/transfer/docs/dfd/relationship.json \
  --process-dir packages/transfer/docs/processes \
  --scope-doc packages/transfer/docs/scope/SYSTEM_SCOPE.md \
  --scope-rules packages/transfer/docs/scope/scope-rules.json \
  --test-policy packages/transfer/docs/testing/TEST_POLICY.md \
  --test-rules packages/transfer/docs/testing/test-rules.json \
  --out <review-plan.json>
```

Build `@rawsql-ts/ddl-docs-cli` first when `dist/` is stale.

## Output Shape

Use this structure:

```md
# Logical Model Review

## Status
pass | needs-revision | needs-human-decision

## Review Plan Inputs
- mandatory scope:
- mandatory verification:
- changed files:
- diagnostics:
- unmapped artifacts:

## Findings

### scope-boundary
- severity:
- location or quote:
- why it matters:
- suggested direction:

### concept-process-consistency
- severity:
- location or quote:
- why it matters:
- suggested direction:

### verification-policy-gap
- severity:
- location or quote:
- why it matters:
- suggested direction:

### relationship-metadata-gap
- severity:
- location or quote:
- why it matters:
- suggested direction:

### generated-view-drift
- severity:
- location or quote:
- why it matters:
- suggested direction:

## Unresolved But Acceptable

- item:
- why it can remain unresolved:
- revisit trigger:
- owner or expected decision source:

## Human Decisions Required

## Verification Not Run
```

Omit empty finding categories.
