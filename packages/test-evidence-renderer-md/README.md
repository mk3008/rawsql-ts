# @rawsql-ts/test-evidence-renderer-md

Markdown projection renderers for test evidence models and diffs.

## Scope

- Markdown output only
- Depends on semantic models from `@rawsql-ts/test-evidence-core`
- Does not compute diffs or normalize semantics

## Projection Rule

Renderer output is a projection. Source of truth remains core models (`SpecificationModel` / `DiffJson`).

## Options Policy

Renderer options are presentation-only.

- Allowed: layout, verbosity, ordering style
- Not allowed: semantic transforms, model normalization, diff computation changes

For specification markdown, `expected: "throws"` cases render `error` blocks and never render `output` blocks.
