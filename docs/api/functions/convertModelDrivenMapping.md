<div v-pre>
# Function: convertModelDrivenMapping()

> **convertModelDrivenMapping**(`modelMapping`): `object`

Defined in: [packages/core/src/transformers/ModelDrivenJsonMapping.ts:63](https://github.com/mk3008/rawsql-ts/blob/9a43510a16e39bf2c2a913e6d2e5ec12b36391e6/packages/core/src/transformers/ModelDrivenJsonMapping.ts#L63)

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
