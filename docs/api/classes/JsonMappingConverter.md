<div v-pre>
# Class: JsonMappingConverter

Defined in: [packages/core/src/transformers/JsonMappingConverter.ts:225](https://github.com/mk3008/rawsql-ts/blob/20e77930050634d1683aacac0cbdcebfe1978871/packages/core/src/transformers/JsonMappingConverter.ts#L225)

Unified JSON mapping converter that handles all supported formats using the Strategy pattern.

This converter automatically detects the input format and applies the appropriate conversion
strategy to transform any supported JSON mapping format into a standardized result.

**Supported Formats:**
- **Enhanced**: Rich format with metadata, type protection, and advanced column configurations
- **Model-Driven**: TypeScript interface-based mapping with structured field definitions
- **Legacy**: Simple format compatible with PostgresJsonQueryBuilder

**Usage:**
```typescript
const converter = new JsonMappingConverter();
const result = converter.convert(someMapping);
const legacyMapping = converter.toLegacyMapping(someMapping);
```

## Constructors

### Constructor

> **new JsonMappingConverter**(): `JsonMappingConverter`

Defined in: [packages/core/src/transformers/JsonMappingConverter.ts:237](https://github.com/mk3008/rawsql-ts/blob/20e77930050634d1683aacac0cbdcebfe1978871/packages/core/src/transformers/JsonMappingConverter.ts#L237)

Creates a new JsonMappingConverter with all supported strategies.

Strategies are checked in order of specificity:
1. Enhanced format (most feature-rich)
2. Model-driven format (TypeScript-based)
3. Legacy format (fallback)

#### Returns

`JsonMappingConverter`

## Methods

### detectFormat()

> **detectFormat**(`input`): [`MappingFormat`](../type-aliases/MappingFormat.md)

Defined in: [packages/core/src/transformers/JsonMappingConverter.ts:262](https://github.com/mk3008/rawsql-ts/blob/20e77930050634d1683aacac0cbdcebfe1978871/packages/core/src/transformers/JsonMappingConverter.ts#L262)

Detects the format of the input mapping without performing conversion.

This method uses the same strategy pattern as conversion but only returns
the detected format type for inspection purposes.

#### Parameters

##### input

[`JsonMappingInput`](../type-aliases/JsonMappingInput.md)

The JSON mapping to analyze

#### Returns

[`MappingFormat`](../type-aliases/MappingFormat.md)

The detected mapping format type

#### Throws

When input format is not supported by any strategy

#### Example

```typescript
const format = converter.detectFormat(myMapping);
console.log(`Detected format: ${format}`); // "enhanced", "model-driven", or "legacy"
```

***

### convert()

> **convert**(`input`): [`ConversionResult`](../interfaces/ConversionResult.md)

Defined in: [packages/core/src/transformers/JsonMappingConverter.ts:297](https://github.com/mk3008/rawsql-ts/blob/20e77930050634d1683aacac0cbdcebfe1978871/packages/core/src/transformers/JsonMappingConverter.ts#L297)

Converts any supported JSON mapping format to a comprehensive result with metadata.

This is the primary conversion method that performs format detection and transformation
in a single operation. The result includes the legacy mapping, type protection configuration,
and metadata about the conversion process.

#### Parameters

##### input

[`JsonMappingInput`](../type-aliases/JsonMappingInput.md)

The JSON mapping in any supported format (Enhanced, Model-Driven, or Legacy)

#### Returns

[`ConversionResult`](../interfaces/ConversionResult.md)

Complete conversion result with mapping, metadata, and type protection

#### Throws

When the input format is not recognized by any strategy

#### Example

```typescript
const result = converter.convert(enhancedMapping);
console.log(`Format: ${result.format}`);
console.log(`Type protection: ${result.typeProtection.protectedStringFields.length} fields`);

// Use the converted mapping
const queryBuilder = new PostgresJsonQueryBuilder(result.mapping);
```

#### See

 - [toLegacyMapping](../functions/toLegacyMapping.md) For simple mapping extraction
 - [getTypeProtection](#gettypeprotection) For type protection only

***

### toLegacyMapping()

> **toLegacyMapping**(`input`): [`JsonMapping`](../interfaces/JsonMapping.md)

Defined in: [packages/core/src/transformers/JsonMappingConverter.ts:327](https://github.com/mk3008/rawsql-ts/blob/20e77930050634d1683aacac0cbdcebfe1978871/packages/core/src/transformers/JsonMappingConverter.ts#L327)

Extracts only the legacy JsonMapping for direct use with PostgresJsonQueryBuilder.

This convenience method performs the full conversion but returns only the mapping portion,
discarding metadata and type protection information. Use this when you only need
the mapping for query building and don't require additional metadata.

#### Parameters

##### input

[`JsonMappingInput`](../type-aliases/JsonMappingInput.md)

The JSON mapping in any supported format

#### Returns

[`JsonMapping`](../interfaces/JsonMapping.md)

Legacy-format JsonMapping ready for PostgresJsonQueryBuilder

#### Throws

When the input format is not supported

#### Example

```typescript
const legacyMapping = converter.toLegacyMapping(modelDrivenMapping);
const queryBuilder = new PostgresJsonQueryBuilder(legacyMapping);
const query = queryBuilder.build(selectQuery);
```

#### See

[convert](#convert) For full conversion with metadata

***

### getTypeProtection()

> **getTypeProtection**(`input`): [`TypeProtectionConfig`](../interfaces/TypeProtectionConfig.md)

Defined in: [packages/core/src/transformers/JsonMappingConverter.ts:355](https://github.com/mk3008/rawsql-ts/blob/20e77930050634d1683aacac0cbdcebfe1978871/packages/core/src/transformers/JsonMappingConverter.ts#L355)

Extracts type protection configuration for runtime type checking.

Type protection helps identify fields that should be treated as strings
to prevent injection attacks or type coercion issues. This is particularly
useful when working with user input or external data sources.

#### Parameters

##### input

[`JsonMappingInput`](../type-aliases/JsonMappingInput.md)

The JSON mapping in any supported format

#### Returns

[`TypeProtectionConfig`](../interfaces/TypeProtectionConfig.md)

Type protection configuration with protected field definitions

#### Throws

When the input format is not supported

#### Example

```typescript
const typeProtection = converter.getTypeProtection(enhancedMapping);

// Apply type protection during data processing
for (const field of typeProtection.protectedStringFields) {
    if (typeof data[field] !== 'string') {
        data[field] = String(data[field]);
    }
}
```

***

### validate()

> **validate**(`input`): `string`[]

Defined in: [packages/core/src/transformers/JsonMappingConverter.ts:389](https://github.com/mk3008/rawsql-ts/blob/20e77930050634d1683aacac0cbdcebfe1978871/packages/core/src/transformers/JsonMappingConverter.ts#L389)

Validates that the input mapping is well-formed and can be successfully converted.

This method performs comprehensive validation without attempting conversion,
returning an array of error messages for any issues found. An empty array
indicates the mapping is valid and ready for conversion.

**Validation Checks:**
- Basic structure validation (object type, required fields)
- Format-specific validation (Enhanced, Model-Driven, Legacy)
- Column configuration validation
- Type protection configuration validation

#### Parameters

##### input

[`JsonMappingInput`](../type-aliases/JsonMappingInput.md)

The JSON mapping to validate

#### Returns

`string`[]

Array of validation error messages (empty if valid)

#### Example

```typescript
const errors = converter.validate(suspiciousMapping);
if (errors.length > 0) {
    console.error('Validation failed:', errors);
    throw new Error(`Invalid mapping: ${errors.join(', ')}`);
}

// Safe to convert
const result = converter.convert(suspiciousMapping);
```

#### See

[convert](#convert) Performs conversion after implicit validation

***

### upgradeToEnhanced()

> **upgradeToEnhanced**(`legacy`, `typeInfo?`): [`EnhancedJsonMapping`](../interfaces/EnhancedJsonMapping.md)

Defined in: [packages/core/src/transformers/JsonMappingConverter.ts:450](https://github.com/mk3008/rawsql-ts/blob/20e77930050634d1683aacac0cbdcebfe1978871/packages/core/src/transformers/JsonMappingConverter.ts#L450)

Creates a new enhanced mapping from legacy mapping.

#### Parameters

##### legacy

[`LegacyJsonMapping`](../interfaces/LegacyJsonMapping.md)

##### typeInfo?

###### interface

`string`

###### importPath

`string`

#### Returns

[`EnhancedJsonMapping`](../interfaces/EnhancedJsonMapping.md)
</div>
