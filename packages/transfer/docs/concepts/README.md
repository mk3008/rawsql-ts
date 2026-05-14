# Transfer Concept Specs

This directory contains Concept Specs for `@rawsql-ts/transfer`.

Concept Specs define stable meanings, responsibility boundaries, and invariants for concepts that span multiple features. They are not implementation plans, SQL, DDL, queryspecs, or test cases.

Human-owned Concept Specs live in each `<concept-id>/SPEC.md`.
Machine-readable concept lifecycle, glossary, and relationship metadata lives in `concept-relationship.json`.
Human review views such as Concept Maps or generated VitePress indexes should be regenerated or checked from that metadata; do not add concept graph facts only to a review view.

Concept lifecycle:

- Defined concepts use `<concept-id>/SPEC.md`.
- Draft concepts use `<concept-id>/DRAFT.md`.
- A draft is reviewable work in progress, not an authoritative Concept Spec.
- Promote a draft by replacing `DRAFT.md` with `SPEC.md`, then updating `concept-relationship.json` and regenerating or refreshing review views.

Available Concept Specs:

This list is a human entrypoint. Use `concept-relationship.json` and generated Concept Map views for completeness checks.

- [Active Black](./active-black/SPEC.md)
- [Black Transfer](./black-transfer/SPEC.md)
- [Destination](./destination/SPEC.md)
- [Destination Link](./destination-link/SPEC.md)
- [Dirty Key](./dirty-key/SPEC.md)
- [Dirty Key Processing](./dirty-key-processing/SPEC.md)
- [Lineage](./lineage/SPEC.md)
- [Physical Delete Transfer](./physical-delete-transfer/SPEC.md)
- [Posting Date Lower Bound](./posting-date-lower-bound/SPEC.md)
- [Red Transfer](./red-transfer/SPEC.md)
- [Transfer Execution](./transfer-execution/SPEC.md)
- [Transfer Run](./transfer-run/SPEC.md)
- [Transfer Setting](./transfer-setting/SPEC.md)
- [Work Item](./work-item/SPEC.md)

Concept relationship entrypoints:

- [Concept Map](./concept-map.md)
- [Concept Relationship Metadata](./concept-relationship.json)

Related DFDs:

- [Transfer DFDs](../dfd/README.md)
- [DFD Relationship Metadata](../dfd/relationship.json)

Related process maps:

- [Transfer Execution Process](../processes/transfer-execution-process.md)
- [Lineage Trace Process](../processes/lineage-trace-process.md)
