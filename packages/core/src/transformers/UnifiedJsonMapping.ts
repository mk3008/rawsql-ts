/**
 * Enhanced JSON mapping structure that integrates column mapping and type protection configuration.
 * This unified approach eliminates the need for separate .types.json files.
 */

import { JsonMapping } from './PostgresJsonQueryBuilder';

/**
 * Column configuration that can either be a simple string mapping or an enhanced mapping with type protection.
 */
export type ColumnMappingConfig = string | {
    column: string;
    forceString?: boolean;
};

/**
 * Enhanced JSON mapping configuration with integrated type protection.
 */
export interface UnifiedJsonMapping {
    rootName: string;
    typeInfo?: {
        interface: string;
        importPath: string;
    };
    rootEntity: {
        id: string;
        name: string;
        columns: Record<string, ColumnMappingConfig>;
    };
    nestedEntities?: Array<{
        id: string;
        name: string;
        parentId: string;
        propertyName: string;
        relationshipType: 'object' | 'array';
        columns: Record<string, ColumnMappingConfig>;
    }>;
    useJsonb?: boolean;
}

/**
 * Type protection configuration extracted from the unified mapping.
 */
export interface TypeProtectionConfig {
    protectedStringFields: string[];
}

/**
 * Convert a unified JSON mapping to separate JsonMapping and TypeProtectionConfig.
 * This enables backward compatibility with existing code while supporting the new unified structure.
 */
export function convertUnifiedMapping(unified: UnifiedJsonMapping): {
    jsonMapping: JsonMapping;
    typeProtection: TypeProtectionConfig;
} {
    const protectedStringFields: string[] = [];

    // Helper function to process columns and extract string protection settings
    const processColumns = (columns: Record<string, ColumnMappingConfig>): Record<string, string> => {
        const result: Record<string, string> = {};

        for (const [key, config] of Object.entries(columns)) {
            if (typeof config === 'string') {
                result[key] = config;
            } else {
                result[key] = config.column;
                if (config.forceString) {
                    protectedStringFields.push(config.column);
                }
            }
        }

        return result;
    };

    // Convert the unified mapping to traditional JsonMapping
    const jsonMapping: JsonMapping = {
        rootName: unified.rootName,
        rootEntity: {
            id: unified.rootEntity.id,
            name: unified.rootEntity.name,
            columns: processColumns(unified.rootEntity.columns)
        },
        nestedEntities: [],  // Initialize as empty array
        useJsonb: unified.useJsonb
    };

    // Add typeInfo if it exists
    if (unified.typeInfo) {
        // Note: JsonMapping doesn't have typeInfo in core, but we preserve it for backward compatibility
        (jsonMapping as any).typeInfo = unified.typeInfo;
    }

    // Process nested entities if they exist
    if (unified.nestedEntities) {
        jsonMapping.nestedEntities = unified.nestedEntities.map(entity => ({
            id: entity.id,
            name: entity.name,
            parentId: entity.parentId,
            propertyName: entity.propertyName,
            relationshipType: entity.relationshipType,
            columns: processColumns(entity.columns)
        }));
    }

    return {
        jsonMapping,
        typeProtection: { protectedStringFields }
    };
}
