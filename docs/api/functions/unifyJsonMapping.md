<div v-pre>
# ~~Function: unifyJsonMapping()~~

> **unifyJsonMapping**(`input`): [`JsonMapping`](../interfaces/JsonMapping.md)

Defined in: [packages/core/src/transformers/JsonMappingUnifier.ts:209](https://github.com/mk3008/rawsql-ts/blob/9a43510a16e39bf2c2a913e6d2e5ec12b36391e6/packages/core/src/transformers/JsonMappingUnifier.ts#L209)

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
