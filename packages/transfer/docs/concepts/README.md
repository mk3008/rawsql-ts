# Transfer Concept Specs

This directory contains Concept Specs for `@rawsql-ts/transfer`.

Concept Specs define stable meanings, responsibility boundaries, and invariants for concepts that span multiple features. They are not implementation plans, SQL, DDL, queryspecs, or test cases.

Structured Concept Specs live in each `<concept-id>/concept.json`.
Machine-readable concept lifecycle, glossary, and relationship metadata lives in `concept-relationship.json`.
Human review views such as Concept Maps or generated VitePress indexes should be regenerated or checked from that metadata; do not add concept graph facts only to a review view.

Concept lifecycle:

- Defined concepts use `<concept-id>/concept.json`.
- Draft concepts use `<concept-id>/concept.json` with optional `DRAFT.md` notes.
- A draft is reviewable work in progress, not an authoritative Concept Spec.
- Promote a draft by updating lifecycle status in `concept.json`, then regenerating review views.

Available Concept Specs:

This list is a human entrypoint. Use `concept-relationship.json` and generated VitePress Concept views for completeness checks.

- [Active Black](./active-black/concept.json)
- [Black Transfer](./black-transfer/concept.json)
- [Destination](./destination/concept.json)
- [Destination Link](./destination-link/concept.json)
- [Dirty Key](./dirty-key/concept.json)
- [Dirty Key Processing](./dirty-key-processing/concept.json)
- [Duplicate Control](./duplicate-control/concept.json)
- [Lineage](./lineage/concept.json)
- [Physical Delete Transfer](./physical-delete-transfer/concept.json)
- [Posting Date Lower Bound](./posting-date-lower-bound/concept.json)
- [Red Transfer](./red-transfer/concept.json)
- [Transfer Execution](./transfer-execution/concept.json)
- [Transfer Run](./transfer-run/concept.json)
- [Transfer Setting](./transfer-setting/concept.json)
- [Transfer Target Decision](./transfer-target-decision/concept.json)
- [Work Item](./work-item/concept.json)

Concept relationship entrypoints:

- [Concept Relationship Metadata](./concept-relationship.json)

Related DFDs:

- [Transfer DFDs](../dfd/README.md)
- [DFD Relationship Metadata](../dfd/relationship.json)

Related process maps:

- [Transfer Execution Process](../processes/transfer-execution-process.md)
- [Lineage Trace Process](../processes/lineage-trace-process.md)
