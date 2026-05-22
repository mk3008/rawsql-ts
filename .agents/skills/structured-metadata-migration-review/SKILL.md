---
name: structured-metadata-migration-review
description: Review rawsql-ts structured metadata migrations and generators for schema/version parity, real fixture parsing, canonical enum alignment, relationship evidence integrity, display-label quality, and generated review-view consistency. Use when work adds or migrates Concept Specs, Scope/Test/Authority/Technology rule registries, AI review JSON, relationship metadata, or generated review docs.
---

# Structured Metadata Migration Review

Use this skill before reviewing or presenting changes that move human-owned or AI-assisted review material into structured metadata.

## Workflow

1. Identify the source-of-truth artifacts and generated review views.
2. Check that every reader, generator, and validator rejects missing or unsupported `schemaVersion` values.
3. Compare canonical enum-like values across schema files, TypeScript constants, metadata examples, and tests.
4. Confirm tests parse realistic structured files instead of writing markdown or placeholder text into `.json` fixtures.
5. Review relationship and evidence fields for polarity, `negatesSimilarityWith`, `supportedBy`, and claimed reason alignment.
6. Review display labels, summaries, and generated UI strings for truncation, orphaned particles, duplicated wording, and language-policy drift.
7. Check that generated review views are reproducible and are not treated as source authority.

## Review Checks

- `schemaVersion` is required and validated on load.
- Schema JSON and implementation allowlists agree for statement types, relationship kinds, statuses, rule kinds, and lifecycle values.
- Fixtures exercise the parser and validator that production code uses.
- Required reads from `review-plan` include migrated structured artifacts such as `concept.json`, not only legacy markdown paths.
- Metadata relationship evidence supports the stated reason directly.
- Generated docs use theme-aware styles and readable labels when the change affects generated review UI.

## Output Shape

- Status: `pass`, `needs-revision`, or `needs-human-decision`
- Source artifacts checked
- Generated views checked
- Schema and enum parity findings
- Fixture realism findings
- Evidence and display-label findings
- Verification run or not run

## Constraints

- Do not infer human approval from generated views or AI review summaries.
- Do not treat schema-valid JSON as semantically reviewed when evidence links or labels are still inconsistent.
- Do not call a migration complete if tests bypass the real structured parser.
