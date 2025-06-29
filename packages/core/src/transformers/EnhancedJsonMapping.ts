/**
 * Enhanced JSON mapping structure that extends the base JsonMapping interface
 * with additional metadata and type safety features.
 */

/**
 * Supported column types for enhanced mapping.
 */
export type ColumnType = 'string' | 'number' | 'boolean' | 'date' | 'auto';

/**
 * Enhanced column configuration that supports both simple and complex mappings.
 */
export interface ColumnConfig {
    /** Source column name */
    column: string;
    /** Type enforcement for this column */
    type?: ColumnType;
    /** Whether this field is nullable */
    nullable?: boolean;
    /** Custom transformation function */
    transform?: string;
}

/**
 * Column mapping can be either a simple string or enhanced configuration.
 */
export type ColumnMapping = string | ColumnConfig;

/**
 * Enhanced entity definition with additional metadata.
 */
export interface EnhancedEntity {
    id: string;
    name: string;
    columns: Record<string, ColumnMapping>;
    /** Entity description for documentation */
    description?: string;
}

/**
 * Enhanced nested entity with relationship metadata.
 */
export interface EnhancedNestedEntity extends EnhancedEntity {
    parentId: string;
    propertyName: string;
    relationshipType: 'object' | 'array';
    /** Join condition for complex relationships */
    joinCondition?: string;
}

/**
 * Type protection configuration.
 */
export interface TypeProtectionConfig {
    /** Columns that should be treated as strings */
    protectedStringFields: string[];
    /** Columns that should be parsed as dates */
    dateFields?: string[];
    /** Columns that should be parsed as numbers */
    numberFields?: string[];
    /** Custom type transformations */
    customTransforms?: Record<string, string>;
}

/**
 * Enhanced JSON mapping with type safety and metadata support.
 */
export interface EnhancedJsonMapping {
    /** Root entity name */
    rootName: string;
    /** Root entity definition */
    rootEntity: EnhancedEntity;
    /** Nested entities */
    nestedEntities: EnhancedNestedEntity[];
    /** Result format */
    resultFormat?: 'array' | 'single';
    /** Empty result fallback */
    emptyResult?: string;
    /** Type information */
    typeInfo?: {
        interface: string;
        importPath: string;
        generics?: string[];
    };
    /** Type protection configuration */
    typeProtection?: TypeProtectionConfig;
    /** Mapping metadata */
    metadata?: {
        version: string;
        description?: string;
        author?: string;
        createdAt?: string;
        updatedAt?: string;
    };
}

/**
 * Legacy JSON mapping interface (from PostgresJsonQueryBuilder).
 */
export interface LegacyJsonMapping {
    rootName: string;
    rootEntity: {
        id: string;
        name: string;
        columns: { [jsonKey: string]: string };
    };
    nestedEntities: Array<{
        id: string;
        name: string;
        parentId: string;
        propertyName: string;
        relationshipType?: "object" | "array";
        columns: { [jsonKey: string]: string };
    }>;
    resultFormat?: "array" | "single";
    emptyResult?: string;
}

/**
 * Converts enhanced column configurations to simple string mappings for legacy compatibility.
 * 
 * This function transforms complex column configurations (with type info, nullable flags, etc.)
 * into simple string mappings that can be used with PostgresJsonQueryBuilder.
 * 
 * **Supported Input Formats:**
 * - Simple strings: `"user_name"` → `"user_name"`
 * - Column config: `{ column: "u.name", type: "string" }` → `"u.name"`
 * - From config: `{ from: "user_name", nullable: true }` → `"user_name"`
 * 
 * @param columns - Record of field names to column configurations
 * @returns Record of field names to column source strings
 * 
 * @example
 * ```typescript
 * const enhanced = {
 *   id: { column: "u.user_id", type: "number" },
 *   name: { from: "user_name", type: "string" },
 *   email: "email_address"
 * };
 * 
 * const legacy = convertColumnsToLegacy(enhanced);
 * // Result: { id: "u.user_id", name: "user_name", email: "email_address" }
 * ```
 */
export function convertColumnsToLegacy(columns: Record<string, any>): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [key, config] of Object.entries(columns)) {
        if (typeof config === 'string') {
            result[key] = config;
        } else if (config && typeof config === 'object') {
            if ('column' in config) {
                result[key] = config.column;
            } else if ('from' in config) {
                result[key] = config.from;
            } else {
                result[key] = key; // fallback
            }
        } else {
            result[key] = key; // fallback
        }
    }
    return result;
}

/**
 * Converts any unified JSON mapping format to legacy JsonMapping format.
 * 
 * This universal converter handles Enhanced, Unified, and Legacy formats, providing
 * a single interface for converting complex mapping configurations to the simple
 * format expected by PostgresJsonQueryBuilder.
 * 
 * **Supported Input Formats:**
 * - **Enhanced**: With metadata, type protection, and advanced column configs
 * - **Unified**: Standard format with rootName and rootEntity
 * - **Legacy**: Already compatible format (returned as-is)
 * 
 * **Features:**
 * - Automatic format detection
 * - Column configuration simplification
 * - Nested entity handling
 * - Type protection extraction
 * 
 * @param input - JSON mapping in any supported format
 * @returns Legacy JsonMapping compatible with PostgresJsonQueryBuilder
 * 
 * @throws {Error} When input is null, undefined, or malformed
 * 
 * @example
 * ```typescript
 * // Enhanced format input
 * const enhanced = {
 *   rootName: "User",
 *   rootEntity: {
 *     columns: {
 *       id: { column: "u.user_id", type: "number" },
 *       name: { column: "u.user_name", type: "string" }
 *     }
 *   },
 *   metadata: { version: "2.0" }
 * };
 * 
 * const legacy = convertToLegacyJsonMapping(enhanced);
 * // Result: Compatible with PostgresJsonQueryBuilder
 * ```
 * 
 * @see {@link convertColumnsToLegacy} For column-specific conversion
 * @see {@link extractTypeProtection} For type safety features
 */
export function convertToLegacyJsonMapping(input: any): LegacyJsonMapping {
    if (!input) {
        throw new Error('Input mapping is required');
    }

    // If it's already in legacy format, return as-is
    if (input.rootName && input.rootEntity && 
        typeof input.rootEntity.columns === 'object' &&
        !input.typeInfo && !input.typeProtection && !input.metadata) {
        
        // Check if columns are already in string format
        const allColumnsAreStrings = Object.values(input.rootEntity.columns).every(
            col => typeof col === 'string'
        );
        
        if (allColumnsAreStrings) {
            return input as LegacyJsonMapping;
        }
    }

    // Enhanced format conversion
    if (input.rootName && input.rootEntity) {
        return {
            rootName: input.rootName,
            rootEntity: {
                id: input.rootEntity.id || 'root',
                name: input.rootEntity.name || input.rootName,
                columns: convertColumnsToLegacy(input.rootEntity.columns || {})
            },
            nestedEntities: (input.nestedEntities || []).map((entity: any) => ({
                id: entity.id,
                name: entity.name,
                parentId: entity.parentId,
                propertyName: entity.propertyName,
                relationshipType: entity.relationshipType,
                columns: convertColumnsToLegacy(entity.columns || {})
            })),
            resultFormat: input.resultFormat,
            emptyResult: input.emptyResult
        };
    }

    throw new Error('Unsupported mapping format');
}

/**
 * Converts enhanced mapping to legacy format for backward compatibility.
 */
export function toLegacyMapping(enhanced: EnhancedJsonMapping): LegacyJsonMapping {

    return {
        rootName: enhanced.rootName,
        rootEntity: {
            id: enhanced.rootEntity.id,
            name: enhanced.rootEntity.name,
            columns: convertColumnsToLegacy(enhanced.rootEntity.columns)
        },
        nestedEntities: enhanced.nestedEntities.map(entity => ({
            id: entity.id,
            name: entity.name,
            parentId: entity.parentId,
            propertyName: entity.propertyName,
            relationshipType: entity.relationshipType,
            columns: convertColumnsToLegacy(entity.columns)
        })),
        resultFormat: enhanced.resultFormat,
        emptyResult: enhanced.emptyResult
    };
}

/**
 * Extracts type protection configuration from enhanced mapping.
 */
export function extractTypeProtection(enhanced: EnhancedJsonMapping): TypeProtectionConfig {
    const protectedStringFields: string[] = [];
    const dateFields: string[] = [];
    const numberFields: string[] = [];

    // Use existing type protection if available
    if (enhanced.typeProtection) {
        return {
            protectedStringFields: enhanced.typeProtection.protectedStringFields || [],
            dateFields: enhanced.typeProtection.dateFields,
            numberFields: enhanced.typeProtection.numberFields,
            customTransforms: enhanced.typeProtection.customTransforms
        };
    }

    // Process root entity
    for (const [key, config] of Object.entries(enhanced.rootEntity.columns)) {
        if (typeof config === 'object' && config.type) {
            const columnName = config.column;
            switch (config.type) {
                case 'string':
                    protectedStringFields.push(columnName);
                    break;
                case 'date':
                    dateFields.push(columnName);
                    break;
                case 'number':
                    numberFields.push(columnName);
                    break;
            }
        }
    }

    // Process nested entities
    for (const entity of enhanced.nestedEntities) {
        for (const [key, config] of Object.entries(entity.columns)) {
            if (typeof config === 'object' && config.type) {
                const columnName = config.column;
                switch (config.type) {
                    case 'string':
                        protectedStringFields.push(columnName);
                        break;
                    case 'date':
                        dateFields.push(columnName);
                        break;
                    case 'number':
                        numberFields.push(columnName);
                        break;
                }
            }
        }
    }

    return {
        protectedStringFields,
        dateFields: dateFields.length > 0 ? dateFields : undefined,
        numberFields: numberFields.length > 0 ? numberFields : undefined,
        customTransforms: undefined
    };
}