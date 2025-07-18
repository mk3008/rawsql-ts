/**
 * Model-driven JSON mapping structure that mirrors TypeScript model definitions.
 * This approach provides intuitive, hierarchical mapping that closely resembles the target data structure.
 */

import { JsonMapping } from './PostgresJsonQueryBuilder';

/**
 * Supported field types for database column mapping.
 */
export type FieldType = 'string' | 'number' | 'boolean' | 'object' | 'array' | 'auto';

/**
 * Field mapping configuration that can be either a simple column name or enhanced mapping with type control.
 */
export type FieldMapping = string | {
    column: string;
    type?: FieldType;
} | {
    from: string;  // Legacy support
    type?: FieldType;
};

/**
 * Nested object or array structure definition.
 */
export interface NestedStructure {
    type: 'object' | 'array';
    from: string; // SQL table alias
    structure: StructureFields;
}

/**
 * Structure fields can contain either field mappings or nested structures.
 */
export type StructureFields = {
    [key: string]: FieldMapping | NestedStructure;
};

/**
 * Model-driven JSON mapping that mirrors TypeScript interface structure.
 * This design makes it easy to understand the relationship between models and database columns.
 */
export interface ModelDrivenJsonMapping {
    typeInfo: {
        interface: string;
        importPath: string;
    };
    structure: StructureFields;
}

/**
 * Type protection configuration extracted from the model-driven mapping.
 */
export interface TypeProtectionConfig {
    protectedStringFields: string[];
}

/**
 * Convert a model-driven JSON mapping to the traditional JsonMapping format.
 * This enables backward compatibility with existing PostgresJsonQueryBuilder.
 */
export function convertModelDrivenMapping(modelMapping: ModelDrivenJsonMapping): {
    jsonMapping: JsonMapping;
    typeProtection: TypeProtectionConfig;
} {
    const protectedStringFields: string[] = [];
    let entityIdCounter = 0;
    const propertyNameCounters: Record<string, number> = {};

    // Generate unique entity IDs
    const generateEntityId = () => `entity_${++entityIdCounter}`;
    
    // Generate unique property names to avoid JSON key conflicts
    const generateUniquePropertyName = (baseName: string): string => {
        if (!propertyNameCounters[baseName]) {
            propertyNameCounters[baseName] = 0;
        }
        propertyNameCounters[baseName]++;
        return propertyNameCounters[baseName] === 1 ? baseName : `${baseName}_${propertyNameCounters[baseName]}`;
    };
    // Helper function to process structure fields and extract entities
    const processStructure = (
        structure: StructureFields,
        parentId: string | null = null
    ): {
        columns: Record<string, string>;
        nestedEntities: any[];
    } => {
        const columns: Record<string, string> = {};
        const nestedEntities: any[] = []; for (const [fieldName, config] of Object.entries(structure)) {
            if (typeof config === 'string') {
                // Simple field mapping: "fieldName": "column_name"
                columns[fieldName] = config;
            } else if ('column' in config && typeof config.column === 'string' && !('type' in config && (config.type === 'object' || config.type === 'array'))) {
                // Enhanced field mapping: "fieldName": { "column": "column_name", "type": "string" }
                const fieldConfig = config as FieldMapping;
                if (typeof fieldConfig === 'object' && 'column' in fieldConfig) {
                    columns[fieldName] = fieldConfig.column;
                    if (fieldConfig.type === 'string') {
                        protectedStringFields.push(fieldConfig.column);
                    }
                }
            } else if ('from' in config && typeof config.from === 'string' && !('type' in config && (config.type === 'object' || config.type === 'array'))) {
                // Legacy field mapping: "fieldName": { "from": "column_name", "type": "string" }
                const fieldConfig = config as FieldMapping;
                if (typeof fieldConfig === 'object' && 'from' in fieldConfig) {
                    columns[fieldName] = fieldConfig.from;
                    if (fieldConfig.type === 'string') {
                        protectedStringFields.push(fieldConfig.from);
                    }
                }
            } else if ('type' in config && (config.type === 'object' || config.type === 'array')) {
                // Nested structure: object or array
                const nestedStructure = config as NestedStructure;
                const uniquePropertyName = generateUniquePropertyName(fieldName);
                // Generate globally unique entity ID to ensure unique JSON column names
                const entityId = generateEntityId();

                const processedNested = processStructure(nestedStructure.structure, entityId);
                nestedEntities.push({
                    id: entityId, // Use unique ID to avoid column conflicts
                    name: fieldName.charAt(0).toUpperCase() + fieldName.slice(1), // Capitalize first letter
                    parentId: parentId || 'root',
                    propertyName: uniquePropertyName,
                    originalPropertyName: fieldName, // Store original name for final mapping
                    relationshipType: nestedStructure.type,
                    columns: processedNested.columns
                });

                // Add nested entities from deeper levels
                nestedEntities.push(...processedNested.nestedEntities.map(entity => ({
                    ...entity,
                    parentId: entity.parentId === 'root' ? entityId : entity.parentId
                })));
            }
        }

        return { columns, nestedEntities };
    };

    // Process the root structure
    const processed = processStructure(modelMapping.structure);    // Build the traditional JsonMapping
    const jsonMapping: JsonMapping = {
        rootName: 'root', // Default root name
        rootEntity: {
            id: 'root',
            name: 'Root',
            columns: processed.columns
        },
        nestedEntities: processed.nestedEntities
    };

    // Add typeInfo for backward compatibility
    (jsonMapping as any).typeInfo = modelMapping.typeInfo;

    return {
        jsonMapping,
        typeProtection: { protectedStringFields }
    };
}

/**
 * Validate that a model-driven mapping structure is well-formed.
 */
export function validateModelDrivenMapping(mapping: ModelDrivenJsonMapping): string[] {
    const errors: string[] = [];

    // Validate typeInfo
    if (!mapping.typeInfo) {
        errors.push('typeInfo is required');
    } else {
        if (!mapping.typeInfo.interface) {
            errors.push('typeInfo.interface is required');
        }
        if (!mapping.typeInfo.importPath) {
            errors.push('typeInfo.importPath is required');
        }
    }

    // Validate structure
    if (!mapping.structure || typeof mapping.structure !== 'object') {
        errors.push('structure is required and must be an object');
    }

    return errors;
}
