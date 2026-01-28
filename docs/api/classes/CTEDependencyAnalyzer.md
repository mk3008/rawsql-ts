<div v-pre>
# Class: CTEDependencyAnalyzer

Defined in: [packages/core/src/transformers/CTEDependencyAnalyzer.ts:44](https://github.com/mk3008/rawsql-ts/blob/eb87c364119e1d94cd289801a211bf4874dd6cee/packages/core/src/transformers/CTEDependencyAnalyzer.ts#L44)

Analyzer for CTE dependencies in SQL queries.
Provides functionality to analyze dependencies, detect circular references,
and generate topological ordering of CTEs.

## Constructors

### Constructor

> **new CTEDependencyAnalyzer**(): `CTEDependencyAnalyzer`

Defined in: [packages/core/src/transformers/CTEDependencyAnalyzer.ts:58](https://github.com/mk3008/rawsql-ts/blob/eb87c364119e1d94cd289801a211bf4874dd6cee/packages/core/src/transformers/CTEDependencyAnalyzer.ts#L58)

#### Returns

`CTEDependencyAnalyzer`

## Methods

### analyzeDependencies()

> **analyzeDependencies**(`query`): [`CTEDependencyGraph`](../interfaces/CTEDependencyGraph.md)

Defined in: [packages/core/src/transformers/CTEDependencyAnalyzer.ts:75](https://github.com/mk3008/rawsql-ts/blob/eb87c364119e1d94cd289801a211bf4874dd6cee/packages/core/src/transformers/CTEDependencyAnalyzer.ts#L75)

Analyzes the dependencies between CTEs in the given query

#### Parameters

##### query

[`SimpleSelectQuery`](SimpleSelectQuery.md)

The query to analyze

#### Returns

[`CTEDependencyGraph`](../interfaces/CTEDependencyGraph.md)

The dependency graph

***

### getDependencies()

> **getDependencies**(`cteName`): `string`[]

Defined in: [packages/core/src/transformers/CTEDependencyAnalyzer.ts:87](https://github.com/mk3008/rawsql-ts/blob/eb87c364119e1d94cd289801a211bf4874dd6cee/packages/core/src/transformers/CTEDependencyAnalyzer.ts#L87)

Gets the list of CTEs that the specified CTE depends on

#### Parameters

##### cteName

`string`

The name of the CTE

#### Returns

`string`[]

Array of CTE names this CTE depends on

***

### getDependents()

> **getDependents**(`cteName`): `string`[]

Defined in: [packages/core/src/transformers/CTEDependencyAnalyzer.ts:98](https://github.com/mk3008/rawsql-ts/blob/eb87c364119e1d94cd289801a211bf4874dd6cee/packages/core/src/transformers/CTEDependencyAnalyzer.ts#L98)

Gets the list of CTEs that depend on the specified CTE

#### Parameters

##### cteName

`string`

The name of the CTE

#### Returns

`string`[]

Array of CTE names that depend on this CTE

***

### getMainQueryDependencies()

> **getMainQueryDependencies**(): `string`[]

Defined in: [packages/core/src/transformers/CTEDependencyAnalyzer.ts:108](https://github.com/mk3008/rawsql-ts/blob/eb87c364119e1d94cd289801a211bf4874dd6cee/packages/core/src/transformers/CTEDependencyAnalyzer.ts#L108)

Gets the list of CTEs that are directly referenced by the main query

#### Returns

`string`[]

Array of CTE names referenced by the main query

***

### getNodesByType()

> **getNodesByType**(`nodeType`): [`CTENode`](../interfaces/CTENode.md)[]

Defined in: [packages/core/src/transformers/CTEDependencyAnalyzer.ts:119](https://github.com/mk3008/rawsql-ts/blob/eb87c364119e1d94cd289801a211bf4874dd6cee/packages/core/src/transformers/CTEDependencyAnalyzer.ts#L119)

Gets nodes by type (CTE or ROOT)

#### Parameters

##### nodeType

[`NodeType`](../type-aliases/NodeType.md)

The type of nodes to retrieve

#### Returns

[`CTENode`](../interfaces/CTENode.md)[]

Array of nodes of the specified type

***

### getMainQueryNode()

> **getMainQueryNode**(): `undefined` \| [`CTENode`](../interfaces/CTENode.md)

Defined in: [packages/core/src/transformers/CTEDependencyAnalyzer.ts:128](https://github.com/mk3008/rawsql-ts/blob/eb87c364119e1d94cd289801a211bf4874dd6cee/packages/core/src/transformers/CTEDependencyAnalyzer.ts#L128)

Gets the main query node

#### Returns

`undefined` \| [`CTENode`](../interfaces/CTENode.md)

The main query node or undefined if not found

***

### hasCircularDependency()

> **hasCircularDependency**(): `boolean`

Defined in: [packages/core/src/transformers/CTEDependencyAnalyzer.ts:137](https://github.com/mk3008/rawsql-ts/blob/eb87c364119e1d94cd289801a211bf4874dd6cee/packages/core/src/transformers/CTEDependencyAnalyzer.ts#L137)

Checks if there are any circular dependencies in the CTE graph

#### Returns

`boolean`

true if circular dependencies exist, false otherwise

***

### getExecutionOrder()

> **getExecutionOrder**(): `string`[]

Defined in: [packages/core/src/transformers/CTEDependencyAnalyzer.ts:155](https://github.com/mk3008/rawsql-ts/blob/eb87c364119e1d94cd289801a211bf4874dd6cee/packages/core/src/transformers/CTEDependencyAnalyzer.ts#L155)

Gets the topological sort order for CTE execution

#### Returns

`string`[]

Array of CTE names in execution order

#### Throws

Error if circular dependencies are detected
</div>
