<div v-pre>
# Interface: FlowDiagramOptions

Defined in: [packages/core/src/transformers/QueryFlowDiagramGenerator.ts:16](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/transformers/QueryFlowDiagramGenerator.ts#L16)

## Extends

- [`BaseMermaidOptions`](BaseMermaidOptions.md)

## Properties

### title?

> `optional` **title**: `string`

Defined in: [packages/core/src/transformers/QueryFlowDiagramGenerator.ts:13](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/transformers/QueryFlowDiagramGenerator.ts#L13)

Diagram title

#### Inherited from

[`BaseMermaidOptions`](BaseMermaidOptions.md).[`title`](BaseMermaidOptions.md#title)

***

### showDetails?

> `optional` **showDetails**: `boolean`

Defined in: [packages/core/src/transformers/QueryFlowDiagramGenerator.ts:18](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/transformers/QueryFlowDiagramGenerator.ts#L18)

Show detailed information (columns, conditions)

***

### showCTEDependencies?

> `optional` **showCTEDependencies**: `boolean`

Defined in: [packages/core/src/transformers/QueryFlowDiagramGenerator.ts:20](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/transformers/QueryFlowDiagramGenerator.ts#L20)

Include CTE dependencies

***

### direction?

> `optional` **direction**: `"TD"` \| `"LR"` \| `"TB"` \| `"RL"`

Defined in: [packages/core/src/transformers/QueryFlowDiagramGenerator.ts:22](https://github.com/mk3008/rawsql-ts/blob/3b53f17d700cf976ce5c49b674a04b41eeb14c40/packages/core/src/transformers/QueryFlowDiagramGenerator.ts#L22)

Direction of flow (top-down, left-right)
</div>
