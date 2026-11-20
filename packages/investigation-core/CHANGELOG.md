# @rawsql-ts/investigation-core

## 0.2.0

### Minor Changes

- [#964](https://github.com/mk3008/rawsql-ts/pull/964) [`c2f3458`](https://github.com/mk3008/rawsql-ts/commit/c2f3458ea4b4d3ce580942b508cd9f6265a8bc23) Thanks [@mk3008](https://github.com/mk3008)! - Add reusable query-structure analysis, column lineage, and bounded fixture extraction in the investigation engine within the rawsql-ts monorepo; SQL usage scans can be confined to a workspace-relative directory without QuerySpec metadata, and browser bundling correctly omits type-only runtime exports.

- [#967](https://github.com/mk3008/rawsql-ts/pull/967) [`186e038`](https://github.com/mk3008/rawsql-ts/commit/186e0383c9277594160fb694ef1fdbe649f54d6d) Thanks [@mk3008](https://github.com/mk3008)! - Expose parameter collection and add `inspectQueryContract` for static parameter, output-column, physical-table, DDL-proven type, and query-output nullability inspection.

- [#967](https://github.com/mk3008/rawsql-ts/pull/967) [`186e038`](https://github.com/mk3008/rawsql-ts/commit/186e0383c9277594160fb694ef1fdbe649f54d6d) Thanks [@mk3008](https://github.com/mk3008)! - Add structured static schema diagnostics in core that distinguish proven ambiguous columns from unresolved ownership and return unsupported query roots as domain limitations.

- [#969](https://github.com/mk3008/rawsql-ts/pull/969) [`3ef168e`](https://github.com/mk3008/rawsql-ts/commit/3ef168eb33fe6c4608750b65dc6a51848f92c9d8) Thanks [@mk3008](https://github.com/mk3008)! - Add safe parser-backed query-scope slicing with explicit ready or blocked results, structural selector input, selected-subtree boundary checks, DDL-assisted ownership proof, nested required-CTE reconstruction, and generated SQL.

- [#968](https://github.com/mk3008/rawsql-ts/pull/968) [`376fdf1`](https://github.com/mk3008/rawsql-ts/commit/376fdf1869c53edb9b3cb1ee5c5dc166333aa2b7) Thanks [@mk3008](https://github.com/mk3008)! - Add versioned structural selectors for parser-backed query scopes, explicit AST resolution outcomes, and full query-structure metadata for parent scopes, direct CTE references, and fail-closed outer-reference classification. Existing lineage scope IDs and legacy-compatible `kind` values remain unchanged; consumers should use the new `scopeKind` field when switching over the exact structural kinds `root`, `exists`, and `in_subquery`.

  `QueryStructureSummaryV1.scopeCount` now counts the complete parser-backed structural scope inventory, including the root, predicate subqueries, and set-operation scopes. `maximumNestingDepth` now follows structural parent selectors and counts the root as depth 1, so both summary values can change for the same SQL compared with the previous lineage-only inventory.

### Patch Changes

- Updated dependencies [[`c2f3458`](https://github.com/mk3008/rawsql-ts/commit/c2f3458ea4b4d3ce580942b508cd9f6265a8bc23), [`99d0050`](https://github.com/mk3008/rawsql-ts/commit/99d0050bae48e22ec4522d306dd5c5e1f89b4de9), [`186e038`](https://github.com/mk3008/rawsql-ts/commit/186e0383c9277594160fb694ef1fdbe649f54d6d), [`1cd1afd`](https://github.com/mk3008/rawsql-ts/commit/1cd1afd8218a871909126b4212a2e025f9f09b70), [`186e038`](https://github.com/mk3008/rawsql-ts/commit/186e0383c9277594160fb694ef1fdbe649f54d6d), [`99d0050`](https://github.com/mk3008/rawsql-ts/commit/99d0050bae48e22ec4522d306dd5c5e1f89b4de9), [`d7e02be`](https://github.com/mk3008/rawsql-ts/commit/d7e02be4fbe81b2df6bb0d55064ad30ef6d91e65), [`376fdf1`](https://github.com/mk3008/rawsql-ts/commit/376fdf1869c53edb9b3cb1ee5c5dc166333aa2b7), [`b5a0c2b`](https://github.com/mk3008/rawsql-ts/commit/b5a0c2b933f40050707d711d0f881bf8a83d968b)]:
  - rawsql-ts@0.31.0
