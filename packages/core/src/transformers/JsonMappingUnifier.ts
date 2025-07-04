/**
 * Unified JSON Mapping processor that supports both legacy and model-driven formats.
 * 
 * @deprecated Use JsonMappingConverter instead. This module is kept for backward compatibility.
 * This module provides backward compatibility while encouraging migration to the model-driven format.
 * It automatically detects the input format and normalizes to a consistent internal representation.
 */

import { JsonMapping } from './PostgresJsonQueryBuilder';
import { ModelDrivenJsonMapping, convertModelDrivenMapping } from './ModelDrivenJsonMapping';
import { JsonMappingConverter, JsonMappingInput } from './JsonMappingConverter';

/**
 * Unified mapping format that can handle both legacy and model-driven inputs.
 */
export interface UnifiedMappingInput {
    // Model-driven format
    typeInfo?: {
        interface: string;
        importPath: string;
    };
    structure?: any;
    protectedStringFields?: string[];

    // Legacy format detection fields
    rootName?: string;
    rootEntity?: any;
    nestedEntities?: any[];

    // Direct JsonMapping fields (for backward compatibility)
    columns?: any;
    relationships?: any;
}

/**
 * Result of mapping format detection and conversion.
 */
export interface MappingProcessResult {
    format: 'model-driven' | 'unified' | 'legacy';
    jsonMapping: JsonMapping;
    originalInput: UnifiedMappingInput;
    metadata?: {
        typeInfo?: {
            interface: string;
            importPath: string;
        };
        protectedStringFields?: string[];
        typeProtection?: any; // From model-driven conversion
    };
}

/**
 * Detects the format of a JSON mapping configuration.
 * 
 * @param input - The mapping configuration to analyze
 * @returns The detected format type
 */
export function detectMappingFormat(input: UnifiedMappingInput): 'model-driven' | 'unified' | 'legacy' {
    // Model-driven format: has typeInfo and structure
    if (input.typeInfo && input.structure) {
        return 'model-driven';
    }

    // Unified format: has rootName and rootEntity
    if (input.rootName && input.rootEntity) {
        return 'unified';
    }

    // Legacy format: direct JsonMapping structure
    if (input.columns || input.relationships) {
        return 'legacy';
    }

    // Default fallback
    return 'legacy';
}

/**
 * Converts legacy unified format to JsonMapping.
 * 
 * @param input - Unified format mapping configuration
 * @returns Converted JsonMapping
 */
function convertUnifiedFormat(input: UnifiedMappingInput): JsonMapping {
    if (!input.rootEntity) {
        throw new Error('Unified format requires rootEntity');
    }

    const result: JsonMapping = {
        rootName: input.rootName || 'root',
        rootEntity: {
            id: input.rootEntity.id || 'root',
            name: input.rootEntity.name || 'Root',
            columns: input.rootEntity.columns || {}
        },
        nestedEntities: []
    };

    // Convert nestedEntities
    if (input.nestedEntities && Array.isArray(input.nestedEntities)) {
        result.nestedEntities = input.nestedEntities.map(entity => ({
            id: entity.id || entity.propertyName || 'nested',
            name: entity.name || entity.propertyName || 'Nested',
            parentId: entity.parentId || result.rootEntity.id,
            propertyName: entity.propertyName || 'nested',
            relationshipType: entity.relationshipType || 'object',
            columns: entity.columns || {}
        }));
    }

    return result;
}

/**
 * Converts legacy format directly to JsonMapping.
 * 
 * @param input - Legacy format mapping configuration
 * @returns JsonMapping
 */
function convertLegacyFormat(input: UnifiedMappingInput): JsonMapping {
    const result: JsonMapping = {
        rootName: input.rootName || 'root',
        rootEntity: {
            id: 'root',
            name: input.rootName || 'Root',
            columns: input.columns || {}
        },
        nestedEntities: []
    };
    // Convert relationships to nestedEntities
    if (input.relationships && typeof input.relationships === 'object') {
        for (const [propertyName, relationship] of Object.entries(input.relationships)) {
            // Type assertion for legacy relationship format
            const rel = relationship as any;
            result.nestedEntities.push({
                id: propertyName,
                name: propertyName.charAt(0).toUpperCase() + propertyName.slice(1),
                parentId: 'root',
                propertyName,
                relationshipType: rel.type === 'hasMany' ? 'array' : 'object',
                columns: rel.columns || {}
            });
        }
    }

    return result;
}

/**
 * Main processor that unifies all JSON mapping formats into a consistent JsonMapping.
 * 
 * @deprecated Use JsonMappingConverter.convert() instead.
 * 
 * Features:
 * - Automatic format detection
 * - Backward compatibility with all existing formats
 * - Metadata preservation for advanced features
 * - Zero external dependencies
 * 
 * @param input - Any supported JSON mapping format
 * @returns Unified processing result with JsonMapping and metadata
 */
export function processJsonMapping(input: UnifiedMappingInput): MappingProcessResult {
    // Runtime deprecation warning
    console.warn('⚠️ DEPRECATED: processJsonMapping() is deprecated. Use JsonMappingConverter.convert() instead.');
    console.warn('Migration guide: https://github.com/mk3008/rawsql-ts/blob/main/docs/migration-guide.md');
    
    // Check for legacy format with columns and relationships
    if ((input.columns || input.relationships) && !input.rootName && !input.rootEntity) {
        const jsonMapping = convertLegacyFormat(input);
        return {
            format: 'legacy',
            jsonMapping,
            originalInput: input,
            metadata: {}
        };
    }
    
    const converter = new JsonMappingConverter();
    const result = converter.convert(input as JsonMappingInput);
    
    // Map converter formats to unifier formats for backward compatibility
    let format: 'model-driven' | 'unified' | 'legacy' = result.format as any;
    
    // If it's detected as 'legacy' by converter but has rootName and rootEntity, it's 'unified' format
    if (result.format === 'legacy' && input.rootName && input.rootEntity) {
        format = 'unified';
    }
    
    return {
        format,
        jsonMapping: result.mapping,
        originalInput: input,
        metadata: {
            typeInfo: result.metadata?.typeInfo,
            typeProtection: result.typeProtection
        }
    };
}

/**
 * Convenience function for direct JsonMapping extraction.
 * 
 * @deprecated Use JsonMappingConverter.toLegacyMapping() instead.
 * 
 * @param input - Any supported JSON mapping format
 * @returns JsonMapping ready for use with PostgresJsonQueryBuilder
 */
export function unifyJsonMapping(input: UnifiedMappingInput): JsonMapping {
    // Runtime deprecation warning
    console.warn('⚠️ DEPRECATED: unifyJsonMapping() is deprecated. Use JsonMappingConverter.toLegacyMapping() instead.');
    console.warn('Migration guide: https://github.com/mk3008/rawsql-ts/blob/main/docs/migration-guide.md');
    
    const converter = new JsonMappingConverter();
    return converter.toLegacyMapping(input as JsonMappingInput);
}

/**
 * Type guard to check if input uses model-driven format.
 * 
 * @param input - Mapping input to check
 * @returns True if input is model-driven format
 */
export function isModelDrivenFormat(input: UnifiedMappingInput): input is ModelDrivenJsonMapping {
    return detectMappingFormat(input) === 'model-driven';
}

/**
 * Type guard to check if input uses unified format.
 * 
 * @param input - Mapping input to check
 * @returns True if input is unified format
 */
export function isUnifiedFormat(input: UnifiedMappingInput): boolean {
    return detectMappingFormat(input) === 'unified';
}

/**
 * Type guard to check if input uses legacy format.
 * 
 * @param input - Mapping input to check
 * @returns True if input is legacy format
 */
export function isLegacyFormat(input: UnifiedMappingInput): boolean {
    return detectMappingFormat(input) === 'legacy';
}

/**
 * Migration helper that suggests upgrading to model-driven format.
 * 
 * @param input - Current mapping configuration
 * @returns Suggestions for migration (if applicable)
 */
export function suggestModelDrivenMigration(input: UnifiedMappingInput): string[] {
    const format = detectMappingFormat(input);
    const suggestions: string[] = [];

    if (format !== 'model-driven') {
        suggestions.push('Consider migrating to model-driven JSON mapping format');
        suggestions.push('Benefits: Better type safety, IDE support, and future-proof design');
        suggestions.push('See: Model-Driven JSON Mapping Guide for migration instructions');

        if (format === 'unified') {
            suggestions.push('Your current unified format can be automatically converted');
        }

        if (format === 'legacy') {
            suggestions.push('Legacy format support will be maintained but new features target model-driven format');
        }
    }

    return suggestions;
}
