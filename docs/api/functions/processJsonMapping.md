<div v-pre>
# ~~Function: processJsonMapping()~~

> **processJsonMapping**(`input`): `MappingProcessResult`

Defined in: [packages/core/src/transformers/JsonMappingUnifier.ts:163](https://github.com/mk3008/rawsql-ts/blob/d0f163554c861b2dd282c2088d010eb950ef4180/packages/core/src/transformers/JsonMappingUnifier.ts#L163)

Main processor that unifies all JSON mapping formats into a consistent JsonMapping.

## Parameters

### input

`UnifiedMappingInput`

Any supported JSON mapping format

## Returns

`MappingProcessResult`

Unified processing result with JsonMapping and metadata

## Deprecated

Use JsonMappingConverter.convert() instead.

Features:
- Automatic format detection
- Backward compatibility with all existing formats
- Metadata preservation for advanced features
- Zero external dependencies
</div>
