/**
 * Enhanced JsonMapping with TypeScript type information for automatic compatibility validation
 */

import { JsonMapping } from '../../../core/src';

/**
 * Type property definition for automatic type validation
 */
export interface TypePropertyInfo {
    type: 'string' | 'number' | 'boolean' | 'Date' | 'object' | 'array';
    required: boolean;
    arrayElementType?: string; // For array types, specify the element type
    objectInterface?: string; // For object types, reference to the interface name
}

/**
 * Type information for entities in JsonMapping
 */
export interface EntityTypeInfo {
    interface?: string; // TypeScript interface name
    importPath?: string; // Path to import the interface from
    properties?: { [propertyName: string]: TypePropertyInfo };
}

/**
 * Enhanced JsonMapping with type information for automatic validation
 */
export interface EnhancedJsonMapping extends JsonMapping {
    typeInfo?: {
        interface: string; // Root type interface name
        importPath: string; // Path to import the interface from
    };
    rootEntity: JsonMapping['rootEntity'] & {
        typeInfo?: EntityTypeInfo;
    };
    nestedEntities: Array<JsonMapping['nestedEntities'][0] & {
        typeInfo?: EntityTypeInfo;
    }>;
}

/**
 * Type validation result
 */
export interface TypeValidationResult {
    isValid: boolean;
    errors: string[];
    missingProperties: string[];
    extraProperties: string[];
    typeConflicts: Array<{
        property: string;
        expected: string;
        actual: string;
    }>;
}
