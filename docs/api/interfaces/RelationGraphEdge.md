<div v-pre>
# Interface: RelationGraphEdge

Defined in: [packages/core/src/utils/RelationGraph.ts:9](https://github.com/mk3008/rawsql-ts/blob/0e6f6280921ceb8f72d155f28b906b2cad106dfe/packages/core/src/utils/RelationGraph.ts#L9)

## Properties

### childTable

> **childTable**: `string`

Defined in: [packages/core/src/utils/RelationGraph.ts:10](https://github.com/mk3008/rawsql-ts/blob/0e6f6280921ceb8f72d155f28b906b2cad106dfe/packages/core/src/utils/RelationGraph.ts#L10)

***

### parentTable

> **parentTable**: `string`

Defined in: [packages/core/src/utils/RelationGraph.ts:11](https://github.com/mk3008/rawsql-ts/blob/0e6f6280921ceb8f72d155f28b906b2cad106dfe/packages/core/src/utils/RelationGraph.ts#L11)

***

### childColumns

> **childColumns**: `string`[]

Defined in: [packages/core/src/utils/RelationGraph.ts:12](https://github.com/mk3008/rawsql-ts/blob/0e6f6280921ceb8f72d155f28b906b2cad106dfe/packages/core/src/utils/RelationGraph.ts#L12)

***

### parentColumns

> **parentColumns**: `string`[]

Defined in: [packages/core/src/utils/RelationGraph.ts:13](https://github.com/mk3008/rawsql-ts/blob/0e6f6280921ceb8f72d155f28b906b2cad106dfe/packages/core/src/utils/RelationGraph.ts#L13)

***

### constraintKind

> **constraintKind**: [`RelationConstraintKind`](../type-aliases/RelationConstraintKind.md)

Defined in: [packages/core/src/utils/RelationGraph.ts:14](https://github.com/mk3008/rawsql-ts/blob/0e6f6280921ceb8f72d155f28b906b2cad106dfe/packages/core/src/utils/RelationGraph.ts#L14)

***

### constraintName

> **constraintName**: `null` \| `string`

Defined in: [packages/core/src/utils/RelationGraph.ts:15](https://github.com/mk3008/rawsql-ts/blob/0e6f6280921ceb8f72d155f28b906b2cad106dfe/packages/core/src/utils/RelationGraph.ts#L15)

***

### evidenceKind

> **evidenceKind**: [`RelationEvidenceKind`](../type-aliases/RelationEvidenceKind.md)

Defined in: [packages/core/src/utils/RelationGraph.ts:20](https://github.com/mk3008/rawsql-ts/blob/0e6f6280921ceb8f72d155f28b906b2cad106dfe/packages/core/src/utils/RelationGraph.ts#L20)

Evidence behind the relation edge. v1 uses FK evidence, but callers can
keep the same edge shape when PK / UNIQUE inference is added later.

***

### confidence

> **confidence**: [`RelationConfidence`](../type-aliases/RelationConfidence.md)

Defined in: [packages/core/src/utils/RelationGraph.ts:25](https://github.com/mk3008/rawsql-ts/blob/0e6f6280921ceb8f72d155f28b906b2cad106dfe/packages/core/src/utils/RelationGraph.ts#L25)

Indicates whether the relation is directly confirmed or inferred from
broader schema evidence.

***

### isSelfReference

> **isSelfReference**: `boolean`

Defined in: [packages/core/src/utils/RelationGraph.ts:26](https://github.com/mk3008/rawsql-ts/blob/0e6f6280921ceb8f72d155f28b906b2cad106dfe/packages/core/src/utils/RelationGraph.ts#L26)
</div>
