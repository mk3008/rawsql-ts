# Transfer Concept Specs

This directory contains Concept Specs for `@rawsql-ts/transfer`.

Concept Specs define stable meanings, responsibility boundaries, and invariants for concepts that span multiple features. They are not implementation plans, SQL, DDL, queryspecs, or test cases.

Concept lifecycle:

- Defined concepts use `<concept-id>/SPEC.md`.
- Draft concepts use `<concept-id>/DRAFT.md`.
- A draft is reviewable work in progress, not an authoritative Concept Spec.
- Promote a draft by replacing `DRAFT.md` with `SPEC.md`, then updating `concept-map.md` and `concept-relationship.json`.

Available Concept Specs:

- [Active Black](./active-black/SPEC.md)
- [Black Transfer](./black-transfer/SPEC.md)
- [Destination](./destination/SPEC.md)
- [Destination Link](./destination-link/SPEC.md)
- [Dirty Key](./dirty-key/SPEC.md)
- [Dirty Key Processing](./dirty-key-processing/SPEC.md)
- [Lineage](./lineage/SPEC.md)
- [Physical Delete Transfer](./physical-delete-transfer/SPEC.md)
- [Red Transfer](./red-transfer/SPEC.md)
- [Transfer Execution](./transfer-execution/SPEC.md)
- [Transfer Run](./transfer-run/SPEC.md)
- [Transfer Setting](./transfer-setting/SPEC.md)
- [Work Item](./work-item/SPEC.md)

Concept relationship entrypoints:

- [Concept Map](./concept-map.md)
- [Concept Relationship Metadata](./concept-relationship.json)

Related process maps:

- [Transfer Execution Process](../processes/transfer-execution-process.md)
- [Lineage Trace Process](../processes/lineage-trace-process.md)
