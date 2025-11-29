<div v-pre>
# Function: convertColumnsToLegacy()

> **convertColumnsToLegacy**(`columns`): `Record`&lt;`string`, `string`\&gt;

Defined in: [packages/core/src/transformers/EnhancedJsonMapping.ts:146](https://github.com/mk3008/rawsql-ts/blob/178c748123fdac6f78b4287de916003e473264a6/packages/core/src/transformers/EnhancedJsonMapping.ts#L146)

Converts enhanced column configurations to simple string mappings for legacy compatibility.

This function transforms complex column configurations (with type info, nullable flags, etc.)
into simple string mappings that can be used with PostgresJsonQueryBuilder.

**Supported Input Formats:**
- Simple strings: `"user_name"` → `"user_name"`
- Column config: `{ column: "u.name", type: "string" }` → `"u.name"`
- From config: `{ from: "user_name", nullable: true }` → `"user_name"`

## Parameters

### columns

`Record`&lt;`string`, `any`\&gt;

Record of field names to column configurations

## Returns

`Record`&lt;`string`, `string`\&gt;

Record of field names to column source strings

## Example

```typescript
const enhanced = {
  id: { column: "u.user_id", type: "number" },
  name: { from: "user_name", type: "string" },
  email: "email_address"
};

const legacy = convertColumnsToLegacy(enhanced);
// Result: { id: "u.user_id", name: "user_name", email: "email_address" }
```
</div>
