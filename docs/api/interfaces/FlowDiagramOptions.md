<div v-pre>
# Interface: FlowDiagramOptions

Defined in: [packages/core/src/transformers/QueryFlowDiagramGenerator.ts:16](https://github.com/mk3008/rawsql-ts/blob/d15b52f58a5f1892ed05d2ab4829bbebde506c12/packages/core/src/transformers/QueryFlowDiagramGenerator.ts#L16)

## Extends

- [`BaseMermaidOptions`](BaseMermaidOptions.md)

## Properties

### title?

> `optional` **title**: `string`

Defined in: [packages/core/src/transformers/QueryFlowDiagramGenerator.ts:13](https://github.com/mk3008/rawsql-ts/blob/d15b52f58a5f1892ed05d2ab4829bbebde506c12/packages/core/src/transformers/QueryFlowDiagramGenerator.ts#L13)

Diagram title

#### Inherited from

[`BaseMermaidOptions`](BaseMermaidOptions.md).[`title`](BaseMermaidOptions.md#title)

***

### showDetails?

> `optional` **showDetails**: `boolean`

Defined in: [packages/core/src/transformers/QueryFlowDiagramGenerator.ts:18](https://github.com/mk3008/rawsql-ts/blob/d15b52f58a5f1892ed05d2ab4829bbebde506c12/packages/core/src/transformers/QueryFlowDiagramGenerator.ts#L18)

Show detailed information (columns, conditions)

***

### showCTEDependencies?

> `optional` **showCTEDependencies**: `boolean`

Defined in: [packages/core/src/transformers/QueryFlowDiagramGenerator.ts:20](https://github.com/mk3008/rawsql-ts/blob/d15b52f58a5f1892ed05d2ab4829bbebde506c12/packages/core/src/transformers/QueryFlowDiagramGenerator.ts#L20)

Include CTE dependencies

***

### direction?

> `optional` **direction**: `"TD"` \| `"LR"` \| `"TB"` \| `"RL"`

Defined in: [packages/core/src/transformers/QueryFlowDiagramGenerator.ts:22](https://github.com/mk3008/rawsql-ts/blob/d15b52f58a5f1892ed05d2ab4829bbebde506c12/packages/core/src/transformers/QueryFlowDiagramGenerator.ts#L22)

Direction of flow (top-down, left-right)
</div>
