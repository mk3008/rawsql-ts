# Transfer Process Maps

This directory contains process maps for `@rawsql-ts/transfer`.

Process maps describe use-case flow, process order, and input/output relationships derived from the Concept Specs.
They are not Concept Specs and do not redefine concept meanings, responsibilities, non-responsibilities, or invariants.

Process Map Markdown is the human-readable logical design.
`process-map.json` is the machine-readable review index for process map IDs, views, related concepts, and purposes.
Human review indexes can be generated from that metadata; do not store process-map coverage facts only in a hand-maintained README or generated page.

Process maps are more detailed than DFDs.
DFDs may use DFD Concept Groups to keep coarse data-flow diagrams readable.
Process maps must not use DFD Concept Groups; they should use concrete Concepts in detail views.

Available process maps:

This list is a human entrypoint. Use `process-map.json` for completeness checks.
Read DFDs first for business boundaries, then process maps for the detailed process flow of each business operation.

- [Transfer Execution Process](./transfer-execution-process.md)
- [Lineage Trace Process](./lineage-trace-process.md)

Machine-readable process metadata:

- [Process Map Metadata](./process-map.json)
