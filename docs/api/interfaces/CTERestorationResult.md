<div v-pre>
# Interface: CTERestorationResult

Defined in: [packages/core/src/transformers/CTEQueryDecomposer.ts:40](https://github.com/mk3008/rawsql-ts/blob/048e31d240bb59505c83f5c0c9a6bff3144552fc/packages/core/src/transformers/CTEQueryDecomposer.ts#L40)

Result of CTE SQL restoration containing executable query and metadata

## Properties

### name

> **name**: `string`

Defined in: [packages/core/src/transformers/CTEQueryDecomposer.ts:42](https://github.com/mk3008/rawsql-ts/blob/048e31d240bb59505c83f5c0c9a6bff3144552fc/packages/core/src/transformers/CTEQueryDecomposer.ts#L42)

Name of the CTE

***

### executableSql

> **executableSql**: `string`

Defined in: [packages/core/src/transformers/CTEQueryDecomposer.ts:44](https://github.com/mk3008/rawsql-ts/blob/048e31d240bb59505c83f5c0c9a6bff3144552fc/packages/core/src/transformers/CTEQueryDecomposer.ts#L44)

Executable SQL query including all dependencies

***

### dependencies

> **dependencies**: `string`[]

Defined in: [packages/core/src/transformers/CTEQueryDecomposer.ts:46](https://github.com/mk3008/rawsql-ts/blob/048e31d240bb59505c83f5c0c9a6bff3144552fc/packages/core/src/transformers/CTEQueryDecomposer.ts#L46)

Array of CTE names that this CTE depends on (in execution order)

***

### warnings

> **warnings**: `string`[]

Defined in: [packages/core/src/transformers/CTEQueryDecomposer.ts:48](https://github.com/mk3008/rawsql-ts/blob/048e31d240bb59505c83f5c0c9a6bff3144552fc/packages/core/src/transformers/CTEQueryDecomposer.ts#L48)

Any warnings encountered during restoration
</div>
