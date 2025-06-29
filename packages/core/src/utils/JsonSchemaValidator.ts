import { JsonMapping } from '../transformers/PostgresJsonQueryBuilder';

/**
 * Type alias for nested entity structure from JsonMapping
 */
type NestedEntity = JsonMapping['nestedEntities'][0];

/**
 * Represents the structure extracted from JsonMapping analysis
 */
export type ExtractedStructure =
    | 'primitive'
    | { [key: string]: ExtractedStructure }
    | ExtractedStructure[];

/**
 * Represents the expected type structure for validation
 */
export type ExpectedTypeStructure =
    | 'primitive'
    | { [key: string]: ExpectedTypeStructure }
    | ExpectedTypeStructure[];

/**
 * Result of JsonMapping validation
 */
export interface ValidationResult {
    isValid: boolean;
    errors: string[];
    missingProperties: string[];
    extraProperties: string[];
}

export class JsonSchemaValidator {
    /**
     * Validates JsonMapping structure against an expected type structure.
     * Checks if the JsonMapping covers all required properties and relationships.
     * 
     * @param jsonMapping The JsonMapping configuration to validate
     * @param expectedStructure The expected type structure to validate against
     * @returns ValidationResult containing validation status and detailed errors
     */
    public static validate(
        jsonMapping: JsonMapping,
        expectedStructure: ExpectedTypeStructure
    ): ValidationResult {
        const extractedStructure = this.extractStructureFromJsonMapping(jsonMapping);
        return this.compareStructures(extractedStructure, expectedStructure);
    }

    /**
     * Validates JsonMapping structure and throws an error if validation fails.
     * Convenience method for strict validation scenarios.
     * 
     * @param jsonMapping The JsonMapping configuration to validate
     * @param expectedStructure The expected type structure to validate against
     * @throws Error if validation fails with detailed error messages
     */
    public static validateStrict(
        jsonMapping: JsonMapping,
        expectedStructure: ExpectedTypeStructure
    ): void {
        const result = this.validate(jsonMapping, expectedStructure);
        if (!result.isValid) {
            const errorMessage = [
                'JsonMapping validation failed:',
                ...result.errors
            ].join('\n');
            throw new Error(errorMessage);
        }
    }

    /**
     * Extracts structure information from JsonMapping configuration.
     * Analyzes rootEntity and nestedEntities to build complete structure map.
     * 
     * @param jsonMapping The JsonMapping to analyze
     * @returns ExtractedStructure representing the mapping structure
     */
    private static extractStructureFromJsonMapping(jsonMapping: JsonMapping): ExtractedStructure {
        const structure: ExtractedStructure = {};

        // Extract root entity properties
        if (jsonMapping.rootEntity && jsonMapping.rootEntity.columns) {
            Object.keys(jsonMapping.rootEntity.columns).forEach(propertyName => {
                structure[propertyName] = 'primitive';
            });
        }
        // Extract nested entities
        if (jsonMapping.nestedEntities) {
            // Process direct children of root entity first
            jsonMapping.nestedEntities
                .filter((entity: NestedEntity) => entity.parentId === jsonMapping.rootEntity.id)
                .forEach((entity: NestedEntity) => {
                    if (entity.propertyName && entity.columns) {
                        if (entity.relationshipType === 'object') {
                            // Single object relationship
                            structure[entity.propertyName] = this.extractNestedEntityStructure(entity, jsonMapping);
                        } else if (entity.relationshipType === 'array') {
                            // Array relationship
                            structure[entity.propertyName] = [this.extractNestedEntityStructure(entity, jsonMapping)];
                        }
                    }
                });
        }

        return structure;
    }    /**
     * Extracts structure from a nested entity, including its children.
     */
    private static extractNestedEntityStructure(entity: NestedEntity, jsonMapping: JsonMapping): ExtractedStructure {
        const entityStructure: ExtractedStructure = {};

        // Add entity's own columns
        if (entity.columns) {
            Object.keys(entity.columns).forEach(propName => {
                entityStructure[propName] = 'primitive';
            });
        }

        // Add nested children of this entity
        if (jsonMapping.nestedEntities) {
            jsonMapping.nestedEntities
                .filter((childEntity: NestedEntity) => childEntity.parentId === entity.id)
                .forEach((childEntity: NestedEntity) => {
                    if (childEntity.propertyName && childEntity.columns) {
                        if (childEntity.relationshipType === 'object') {
                            entityStructure[childEntity.propertyName] = this.extractNestedEntityStructure(childEntity, jsonMapping);
                        } else if (childEntity.relationshipType === 'array') {
                            entityStructure[childEntity.propertyName] = [this.extractNestedEntityStructure(childEntity, jsonMapping)];
                        }
                    }
                });
        }

        return entityStructure;
    }    /**
     * Compares extracted structure with expected structure with proper type guards.
     */
    private static compareStructures(
        extracted: ExtractedStructure,
        expected: ExpectedTypeStructure,
        path: string = ''
    ): ValidationResult {
        const errors: string[] = [];
        const missingProperties: string[] = [];
        const extraProperties: string[] = [];

        // Handle primitive comparison
        if (extracted === 'primitive' && expected === 'primitive') {
            return { isValid: true, errors: [], missingProperties: [], extraProperties: [] };
        }

        // Handle array types
        if (Array.isArray(expected) && Array.isArray(extracted)) {
            if (expected.length > 0 && extracted.length > 0) {
                const nestedResult = this.compareStructures(extracted[0], expected[0], `${path}[]`);
                errors.push(...nestedResult.errors);
                missingProperties.push(...nestedResult.missingProperties);
                extraProperties.push(...nestedResult.extraProperties);
            }
            return { isValid: errors.length === 0, errors, missingProperties, extraProperties };
        }        // Both should be objects for property comparison
        if (typeof extracted !== 'object' || typeof expected !== 'object' ||
            Array.isArray(extracted) || Array.isArray(expected) ||
            extracted === null || expected === null) {
            return { isValid: true, errors: [], missingProperties: [], extraProperties: [] };
        }

        // Now we know both are object types, safe to access properties
        const extractedObj = extracted as { [key: string]: ExtractedStructure };
        const expectedObj = expected as { [key: string]: ExpectedTypeStructure };

        // Check for missing properties in extracted structure
        Object.keys(expectedObj).forEach(key => {
            const currentPath = path ? `${path}.${key}` : key;

            if (!(key in extractedObj)) {
                missingProperties.push(currentPath);
                errors.push(`Missing property: ${currentPath}`);
                return;
            }

            const extractedValue = extractedObj[key];
            const expectedValue = expectedObj[key];

            // Recursively compare nested structures
            const nestedResult = this.compareStructures(extractedValue, expectedValue, currentPath);
            errors.push(...nestedResult.errors);
            missingProperties.push(...nestedResult.missingProperties);
            extraProperties.push(...nestedResult.extraProperties);
        });

        // Check for extra properties in extracted structure
        Object.keys(extractedObj).forEach(key => {
            const currentPath = path ? `${path}.${key}` : key;
            if (!(key in expectedObj)) {
                extraProperties.push(currentPath);
                // Note: Extra properties are not considered errors in this implementation
                // as JsonMapping might include additional metadata
            }
        });

        return {
            isValid: errors.length === 0,
            errors,
            missingProperties,
            extraProperties
        };
    }

    /**
     * Validates JsonMapping structure against a sample object that implements the expected type.
     * This method extracts structure from the sample object and compares it with JsonMapping.
     * 
     * @param jsonMapping The JsonMapping configuration to validate
     * @param sampleObject A sample object that implements the expected interface/type
     * @returns ValidationResult containing validation status and detailed errors
     */
    public static validateAgainstSample<T>(
        jsonMapping: JsonMapping,
        sampleObject: T
    ): ValidationResult {
        const expectedStructure = this.extractStructureFromSample(sampleObject);
        return this.validate(jsonMapping, expectedStructure);
    }

    /**
     * Validates JsonMapping structure against a sample object and throws an error if validation fails.
     * Convenience method for strict validation scenarios with sample objects.
     * 
     * @param jsonMapping The JsonMapping configuration to validate
     * @param sampleObject A sample object that implements the expected interface/type
     * @throws Error if validation fails with detailed error messages
     */
    public static validateAgainstSampleStrict<T>(
        jsonMapping: JsonMapping,
        sampleObject: T
    ): void {
        const result = this.validateAgainstSample(jsonMapping, sampleObject);
        if (!result.isValid) {
            const errorMessage = [
                'JsonMapping validation against sample object failed:',
                ...result.errors
            ].join('\n');
            throw new Error(errorMessage);
        }
    }    /**
     * Extracts structure information from a sample object.
     * Recursively analyzes the object properties to build a structure map.
     * 
     * @param sampleObject The sample object to analyze
     * @returns ExpectedTypeStructure representing the object structure
     */
    private static extractStructureFromSample(sampleObject: any): ExpectedTypeStructure {
        if (sampleObject === null || sampleObject === undefined) {
            return 'primitive' as ExpectedTypeStructure;
        }

        if (Array.isArray(sampleObject)) {
            if (sampleObject.length === 0) {
                return [] as ExpectedTypeStructure;
            }
            return [this.extractStructureFromSample(sampleObject[0])] as ExpectedTypeStructure;
        }

        if (typeof sampleObject === 'object') {
            const structure: { [key: string]: ExpectedTypeStructure } = {};
            Object.keys(sampleObject).forEach(key => {
                structure[key] = this.extractStructureFromSample(sampleObject[key]);
            });
            return structure as ExpectedTypeStructure;
        }

        // Primitive types (string, number, boolean, etc.)
        return 'primitive' as ExpectedTypeStructure;
    }
}
