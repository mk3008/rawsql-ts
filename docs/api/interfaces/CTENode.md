<div v-pre>
# Interface: CTENode

Defined in: [packages/core/src/transformers/CTEDependencyAnalyzer.ts:23](https://github.com/mk3008/rawsql-ts/blob/0e6f6280921ceb8f72d155f28b906b2cad106dfe/packages/core/src/transformers/CTEDependencyAnalyzer.ts#L23)

Interface representing a node in the dependency graph (either CTE or main query)

## Properties

### name

> **name**: `string`

Defined in: [packages/core/src/transformers/CTEDependencyAnalyzer.ts:24](https://github.com/mk3008/rawsql-ts/blob/0e6f6280921ceb8f72d155f28b906b2cad106dfe/packages/core/src/transformers/CTEDependencyAnalyzer.ts#L24)

***

### type

> **type**: [`NodeType`](../type-aliases/NodeType.md)

Defined in: [packages/core/src/transformers/CTEDependencyAnalyzer.ts:25](https://github.com/mk3008/rawsql-ts/blob/0e6f6280921ceb8f72d155f28b906b2cad106dfe/packages/core/src/transformers/CTEDependencyAnalyzer.ts#L25)

***

### cte

> **cte**: `null` \| [`CommonTable`](../classes/CommonTable.md)

Defined in: [packages/core/src/transformers/CTEDependencyAnalyzer.ts:26](https://github.com/mk3008/rawsql-ts/blob/0e6f6280921ceb8f72d155f28b906b2cad106dfe/packages/core/src/transformers/CTEDependencyAnalyzer.ts#L26)

***

### dependencies

> **dependencies**: `string`[]

Defined in: [packages/core/src/transformers/CTEDependencyAnalyzer.ts:27](https://github.com/mk3008/rawsql-ts/blob/0e6f6280921ceb8f72d155f28b906b2cad106dfe/packages/core/src/transformers/CTEDependencyAnalyzer.ts#L27)

***

### dependents

> **dependents**: `string`[]

Defined in: [packages/core/src/transformers/CTEDependencyAnalyzer.ts:28](https://github.com/mk3008/rawsql-ts/blob/0e6f6280921ceb8f72d155f28b906b2cad106dfe/packages/core/src/transformers/CTEDependencyAnalyzer.ts#L28)
</div>
