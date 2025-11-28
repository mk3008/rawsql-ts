<div v-pre>
# Function: convertToLegacyJsonMapping()

> **convertToLegacyJsonMapping**(`input`): [`LegacyJsonMapping`](../interfaces/LegacyJsonMapping.md)

Defined in: [packages/core/src/transformers/EnhancedJsonMapping.ts:210](https://github.com/mk3008/rawsql-ts/blob/9500e016cd69eeba79110f829feb7e699e7361d9/packages/core/src/transformers/EnhancedJsonMapping.ts#L210)

Converts any unified JSON mapping format to legacy JsonMapping format.

This universal converter handles Enhanced, Unified, and Legacy formats, providing
a single interface for converting complex mapping configurations to the simple
format expected by PostgresJsonQueryBuilder.

**Supported Input Formats:**
- **Enhanced**: With metadata, type protection, and advanced column configs
- **Unified**: Standard format with rootName and rootEntity
- **Legacy**: Already compatible format (returned as-is)

**Features:**
- Automatic format detection
- Column configuration simplification
- Nested entity handling
- Type protection extraction

## Parameters

### input

`any`

JSON mapping in any supported format

## Returns

[`LegacyJsonMapping`](../interfaces/LegacyJsonMapping.md)

Legacy JsonMapping compatible with PostgresJsonQueryBuilder

## Throws

When input is null, undefined, or malformed

## Example

```typescript
// Enhanced format input
const enhanced = {
  rootName: "User",
  rootEntity: {
    columns: {
      id: { column: "u.user_id", type: "number" },
      name: { column: "u.user_name", type: "string" }
    }
  },
  metadata: { version: "2.0" }
};

const legacy = convertToLegacyJsonMapping(enhanced);
// Result: Compatible with PostgresJsonQueryBuilder
```

## See

 - [convertColumnsToLegacy](convertColumnsToLegacy.md) For column-specific conversion
 - [extractTypeProtection](extractTypeProtection.md) For type safety features
</div>
