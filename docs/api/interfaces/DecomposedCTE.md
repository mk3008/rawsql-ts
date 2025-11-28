<div v-pre>
# Interface: DecomposedCTE

Defined in: [packages/core/src/transformers/CTEQueryDecomposer.ts:14](https://github.com/mk3008/rawsql-ts/blob/08ef245e1b92295c0c83cf10a43bc6449a2ba4d3/packages/core/src/transformers/CTEQueryDecomposer.ts#L14)

Interface representing a decomposed CTE with executable query

## Properties

### name

> **name**: `string`

Defined in: [packages/core/src/transformers/CTEQueryDecomposer.ts:16](https://github.com/mk3008/rawsql-ts/blob/08ef245e1b92295c0c83cf10a43bc6449a2ba4d3/packages/core/src/transformers/CTEQueryDecomposer.ts#L16)

Name of the CTE

***

### query

> **query**: `string`

Defined in: [packages/core/src/transformers/CTEQueryDecomposer.ts:18](https://github.com/mk3008/rawsql-ts/blob/08ef245e1b92295c0c83cf10a43bc6449a2ba4d3/packages/core/src/transformers/CTEQueryDecomposer.ts#L18)

Executable SQL query for this CTE (includes dependencies)

***

### dependencies

> **dependencies**: `string`[]

Defined in: [packages/core/src/transformers/CTEQueryDecomposer.ts:20](https://github.com/mk3008/rawsql-ts/blob/08ef245e1b92295c0c83cf10a43bc6449a2ba4d3/packages/core/src/transformers/CTEQueryDecomposer.ts#L20)

Array of CTE names that this CTE depends on

***

### dependents

> **dependents**: `string`[]

Defined in: [packages/core/src/transformers/CTEQueryDecomposer.ts:22](https://github.com/mk3008/rawsql-ts/blob/08ef245e1b92295c0c83cf10a43bc6449a2ba4d3/packages/core/src/transformers/CTEQueryDecomposer.ts#L22)

Array of CTE names that depend on this CTE

***

### isRecursive

> **isRecursive**: `boolean`

Defined in: [packages/core/src/transformers/CTEQueryDecomposer.ts:24](https://github.com/mk3008/rawsql-ts/blob/08ef245e1b92295c0c83cf10a43bc6449a2ba4d3/packages/core/src/transformers/CTEQueryDecomposer.ts#L24)

Whether this CTE is recursive
</div>
