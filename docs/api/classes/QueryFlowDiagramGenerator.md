<div v-pre>
# Class: QueryFlowDiagramGenerator

Defined in: [packages/core/src/transformers/QueryFlowDiagramGenerator.ts:29](https://github.com/mk3008/rawsql-ts/blob/51bbec6ef0d7055aa2566e8bbb783d462b3eba39/packages/core/src/transformers/QueryFlowDiagramGenerator.ts#L29)

QueryFlowDiagramGenerator using model-based architecture
Generates Mermaid diagrams from SQL queries following consistent principles

## Constructors

### Constructor

> **new QueryFlowDiagramGenerator**(): `QueryFlowDiagramGenerator`

Defined in: [packages/core/src/transformers/QueryFlowDiagramGenerator.ts:36](https://github.com/mk3008/rawsql-ts/blob/51bbec6ef0d7055aa2566e8bbb783d462b3eba39/packages/core/src/transformers/QueryFlowDiagramGenerator.ts#L36)

#### Returns

`QueryFlowDiagramGenerator`

## Methods

### generateMermaidFlow()

> **generateMermaidFlow**(`query`, `options?`): `string`

Defined in: [packages/core/src/transformers/QueryFlowDiagramGenerator.ts:44](https://github.com/mk3008/rawsql-ts/blob/51bbec6ef0d7055aa2566e8bbb783d462b3eba39/packages/core/src/transformers/QueryFlowDiagramGenerator.ts#L44)

#### Parameters

##### query

`string` | [`SelectQuery`](../interfaces/SelectQuery.md)

##### options?

[`FlowDiagramOptions`](../interfaces/FlowDiagramOptions.md)

#### Returns

`string`

***

### generate()

> `static` **generate**(`sql`): `string`

Defined in: [packages/core/src/transformers/QueryFlowDiagramGenerator.ts:69](https://github.com/mk3008/rawsql-ts/blob/51bbec6ef0d7055aa2566e8bbb783d462b3eba39/packages/core/src/transformers/QueryFlowDiagramGenerator.ts#L69)

#### Parameters

##### sql

`string`

#### Returns

`string`
</div>
