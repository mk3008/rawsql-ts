<div v-pre>
# Function: convertModelDrivenMapping()

> **convertModelDrivenMapping**(`modelMapping`): `object`

Defined in: [packages/core/src/transformers/ModelDrivenJsonMapping.ts:63](https://github.com/mk3008/rawsql-ts/blob/a45f608a15cc8ced8747bae6b0475a2e503fab71/packages/core/src/transformers/ModelDrivenJsonMapping.ts#L63)

Convert a model-driven JSON mapping to the traditional JsonMapping format.
This enables backward compatibility with existing PostgresJsonQueryBuilder.

## Parameters

### modelMapping

[`ModelDrivenJsonMapping`](../interfaces/ModelDrivenJsonMapping.md)

## Returns

`object`

### jsonMapping

> **jsonMapping**: [`JsonMapping`](../interfaces/JsonMapping.md)

### typeProtection

> **typeProtection**: `TypeProtectionConfig`
</div>
