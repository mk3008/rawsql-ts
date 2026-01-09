<div v-pre>
# Interface: CTERestorationResult

Defined in: [packages/core/src/transformers/CTEQueryDecomposer.ts:40](https://github.com/mk3008/rawsql-ts/blob/94f584d3b9d408ecdd3b1321aec85354f4a34e6c/packages/core/src/transformers/CTEQueryDecomposer.ts#L40)

Result of CTE SQL restoration containing executable query and metadata

## Properties

### name

> **name**: `string`

Defined in: [packages/core/src/transformers/CTEQueryDecomposer.ts:42](https://github.com/mk3008/rawsql-ts/blob/94f584d3b9d408ecdd3b1321aec85354f4a34e6c/packages/core/src/transformers/CTEQueryDecomposer.ts#L42)

Name of the CTE

***

### executableSql

> **executableSql**: `string`

Defined in: [packages/core/src/transformers/CTEQueryDecomposer.ts:44](https://github.com/mk3008/rawsql-ts/blob/94f584d3b9d408ecdd3b1321aec85354f4a34e6c/packages/core/src/transformers/CTEQueryDecomposer.ts#L44)

Executable SQL query including all dependencies

***

### dependencies

> **dependencies**: `string`[]

Defined in: [packages/core/src/transformers/CTEQueryDecomposer.ts:46](https://github.com/mk3008/rawsql-ts/blob/94f584d3b9d408ecdd3b1321aec85354f4a34e6c/packages/core/src/transformers/CTEQueryDecomposer.ts#L46)

Array of CTE names that this CTE depends on (in execution order)

***

### warnings

> **warnings**: `string`[]

Defined in: [packages/core/src/transformers/CTEQueryDecomposer.ts:48](https://github.com/mk3008/rawsql-ts/blob/94f584d3b9d408ecdd3b1321aec85354f4a34e6c/packages/core/src/transformers/CTEQueryDecomposer.ts#L48)

Any warnings encountered during restoration
</div>
