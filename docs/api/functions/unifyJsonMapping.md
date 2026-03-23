<div v-pre>
# ~~Function: unifyJsonMapping()~~

> **unifyJsonMapping**(`input`): [`JsonMapping`](../interfaces/JsonMapping.md)

Defined in: [packages/core/src/transformers/JsonMappingUnifier.ts:209](https://github.com/mk3008/rawsql-ts/blob/a45f608a15cc8ced8747bae6b0475a2e503fab71/packages/core/src/transformers/JsonMappingUnifier.ts#L209)

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
