<div v-pre>
# Class: JsonSchemaValidator

Defined in: [packages/core/src/utils/JsonSchemaValidator.ts:34](https://github.com/mk3008/rawsql-ts/blob/0c9553e70639b777e5a11e31a87363d288f66c8b/packages/core/src/utils/JsonSchemaValidator.ts#L34)

## Constructors

### Constructor

> **new JsonSchemaValidator**(): `JsonSchemaValidator`

#### Returns

`JsonSchemaValidator`

## Methods

### validate()

> `static` **validate**(`jsonMapping`, `expectedStructure`): [`ValidationResult`](../interfaces/ValidationResult.md)

Defined in: [packages/core/src/utils/JsonSchemaValidator.ts:43](https://github.com/mk3008/rawsql-ts/blob/0c9553e70639b777e5a11e31a87363d288f66c8b/packages/core/src/utils/JsonSchemaValidator.ts#L43)

Validates JsonMapping structure against an expected type structure.
Checks if the JsonMapping covers all required properties and relationships.

#### Parameters

##### jsonMapping

[`JsonMapping`](../interfaces/JsonMapping.md)

The JsonMapping configuration to validate

##### expectedStructure

[`ExpectedTypeStructure`](../type-aliases/ExpectedTypeStructure.md)

The expected type structure to validate against

#### Returns

[`ValidationResult`](../interfaces/ValidationResult.md)

ValidationResult containing validation status and detailed errors

***

### validateStrict()

> `static` **validateStrict**(`jsonMapping`, `expectedStructure`): `void`

Defined in: [packages/core/src/utils/JsonSchemaValidator.ts:59](https://github.com/mk3008/rawsql-ts/blob/0c9553e70639b777e5a11e31a87363d288f66c8b/packages/core/src/utils/JsonSchemaValidator.ts#L59)

Validates JsonMapping structure and throws an error if validation fails.
Convenience method for strict validation scenarios.

#### Parameters

##### jsonMapping

[`JsonMapping`](../interfaces/JsonMapping.md)

The JsonMapping configuration to validate

##### expectedStructure

[`ExpectedTypeStructure`](../type-aliases/ExpectedTypeStructure.md)

The expected type structure to validate against

#### Returns

`void`

#### Throws

Error if validation fails with detailed error messages

***

### validateAgainstSample()

> `static` **validateAgainstSample**&lt;`T`\&gt;(`jsonMapping`, `sampleObject`): [`ValidationResult`](../interfaces/ValidationResult.md)

Defined in: [packages/core/src/utils/JsonSchemaValidator.ts:220](https://github.com/mk3008/rawsql-ts/blob/0c9553e70639b777e5a11e31a87363d288f66c8b/packages/core/src/utils/JsonSchemaValidator.ts#L220)

Validates JsonMapping structure against a sample object that implements the expected type.
This method extracts structure from the sample object and compares it with JsonMapping.

#### Type Parameters

##### T

`T`

#### Parameters

##### jsonMapping

[`JsonMapping`](../interfaces/JsonMapping.md)

The JsonMapping configuration to validate

##### sampleObject

`T`

A sample object that implements the expected interface/type

#### Returns

[`ValidationResult`](../interfaces/ValidationResult.md)

ValidationResult containing validation status and detailed errors

***

### validateAgainstSampleStrict()

> `static` **validateAgainstSampleStrict**&lt;`T`\&gt;(`jsonMapping`, `sampleObject`): `void`

Defined in: [packages/core/src/utils/JsonSchemaValidator.ts:236](https://github.com/mk3008/rawsql-ts/blob/0c9553e70639b777e5a11e31a87363d288f66c8b/packages/core/src/utils/JsonSchemaValidator.ts#L236)

Validates JsonMapping structure against a sample object and throws an error if validation fails.
Convenience method for strict validation scenarios with sample objects.

#### Type Parameters

##### T

`T`

#### Parameters

##### jsonMapping

[`JsonMapping`](../interfaces/JsonMapping.md)

The JsonMapping configuration to validate

##### sampleObject

`T`

A sample object that implements the expected interface/type

#### Returns

`void`

#### Throws

Error if validation fails with detailed error messages
</div>
