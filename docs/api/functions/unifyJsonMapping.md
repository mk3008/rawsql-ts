<div v-pre>
# ~~Function: unifyJsonMapping()~~

> **unifyJsonMapping**(`input`): [`JsonMapping`](../interfaces/JsonMapping.md)

Defined in: [packages/core/src/transformers/JsonMappingUnifier.ts:209](https://github.com/mk3008/rawsql-ts/blob/7b4153bb3da3209d122265094ee6775b1e1f35aa/packages/core/src/transformers/JsonMappingUnifier.ts#L209)

Convenience function for direct JsonMapping extraction.

## Parameters

### input

`UnifiedMappingInput`

Any supported JSON mapping format

## Returns

[`JsonMapping`](../interfaces/JsonMapping.md)

JsonMapping ready for use with PostgresJsonQueryBuilder

## Deprecated

Use JsonMappingConverter.toLegacyMapping() instead.
</div>
