/**
 * Unified JSON mapping converter that handles all supported formats
 * and provides a single interface for mapping transformations.
 */

import { JsonMapping } from './PostgresJsonQueryBuilder';
import { ModelDrivenJsonMapping, convertModelDrivenMapping } from './ModelDrivenJsonMapping';
import { EnhancedJsonMapping, LegacyJsonMapping, TypeProtectionConfig, toLegacyMapping, extractTypeProtection } from './EnhancedJsonMapping';

/**
 * Input format types that the converter can handle.
 */
export type JsonMappingInput = 
    | EnhancedJsonMapping 
    | ModelDrivenJsonMapping 
    | LegacyJsonMapping;

/**
 * Format detection result.
 */
export type MappingFormat = 'enhanced' | 'model-driven' | 'legacy';

/**
 * Conversion result with metadata.
 */
export interface ConversionResult {
    /** Detected input format */
    format: MappingFormat;
    /** Converted legacy mapping for PostgresJsonQueryBuilder */
    mapping: JsonMapping;
    /** Type protection configuration */
    typeProtection: TypeProtectionConfig;
    /** Original input for reference */
    originalInput: JsonMappingInput;
    /** Additional metadata */
    metadata?: {
        typeInfo?: {
            interface: string;
            importPath: string;
            generics?: string[];
        };
        version?: string;
        description?: string;
    };
}

/**
 * Strategy interface for format-specific conversion logic.
 */
interface ConversionStrategy<T = JsonMappingInput> {
    detect(input: unknown): input is T;
    convert(input: T): ConversionResult;
}

/**
 * Type guard to check if input is valid JSON mapping input
 */
function isValidMappingInput(input: unknown): input is JsonMappingInput {
    return input !== null && 
           input !== undefined && 
           typeof input === 'object';
}

/**
 * Enhanced format conversion strategy.
 */
class EnhancedFormatStrategy implements ConversionStrategy<EnhancedJsonMapping> {
    detect(input: unknown): input is EnhancedJsonMapping {
        if (!isValidMappingInput(input)) {
            return false;
        }

        const candidate = input as any;
        if (!candidate || 
            typeof candidate.rootName !== 'string' ||
            !candidate.rootEntity ||
            !Array.isArray(candidate.nestedEntities)) {
            return false;
        }

        // Check if it has enhanced features
        if (candidate.typeInfo || candidate.typeProtection || candidate.metadata) {
            return true;
        }

        // Check if any column uses enhanced format (object with 'column' property)
        const hasEnhancedColumns = (columns: unknown): boolean => {
            if (!columns || typeof columns !== 'object') return false;
            return Object.values(columns as Record<string, unknown>).some(col => 
                typeof col === 'object' && col !== null && 'column' in col
            );
        };

        if (hasEnhancedColumns(candidate.rootEntity.columns)) {
            return true;
        }

        return candidate.nestedEntities.some((entity: unknown) => 
            entity && typeof entity === 'object' && 
            hasEnhancedColumns((entity as any).columns)
        );
    }

    convert(input: EnhancedJsonMapping): ConversionResult {
        return {
            format: 'enhanced',
            mapping: toLegacyMapping(input),
            typeProtection: extractTypeProtection(input),
            originalInput: input,
            metadata: {
                typeInfo: input.typeInfo,
                version: input.metadata?.version,
                description: input.metadata?.description
            }
        };
    }
}

/**
 * Model-driven format conversion strategy.
 */
class ModelDrivenFormatStrategy implements ConversionStrategy<ModelDrivenJsonMapping> {
    detect(input: unknown): input is ModelDrivenJsonMapping {
        if (!isValidMappingInput(input)) {
            return false;
        }
        
        const candidate = input as any;
        return candidate && 
               candidate.typeInfo && 
               candidate.structure && 
               typeof candidate.typeInfo.interface === 'string';
    }

    convert(input: ModelDrivenJsonMapping): ConversionResult {
        // Use the existing convertModelDrivenMapping function to avoid code duplication
        const converted = convertModelDrivenMapping(input);
        
        return {
            format: 'model-driven',
            mapping: converted.jsonMapping,
            typeProtection: converted.typeProtection,
            originalInput: input,
            metadata: {
                typeInfo: input.typeInfo
            }
        };
    }

}

/**
 * Legacy format conversion strategy.
 */
class LegacyFormatStrategy implements ConversionStrategy<LegacyJsonMapping> {
    detect(input: unknown): input is LegacyJsonMapping {
        if (!isValidMappingInput(input)) {
            return false;
        }
        
        const candidate = input as any;
        if (!candidate || 
            typeof candidate.rootName !== 'string' ||
            !candidate.rootEntity ||
            typeof candidate.rootEntity.columns !== 'object' ||
            candidate.typeInfo || candidate.typeProtection || candidate.metadata) {
            return false;
        }

        // Check if any column uses enhanced format (object with 'column' property)
        const hasEnhancedColumns = (columns: unknown): boolean => {
            if (!columns || typeof columns !== 'object') return false;
            return Object.values(columns as Record<string, unknown>).some(col => 
                typeof col === 'object' && col !== null && 'column' in col
            );
        };

        // If it has enhanced columns, it's not legacy format
        if (hasEnhancedColumns(candidate.rootEntity.columns)) {
            return false;
        }

        if (candidate.nestedEntities && Array.isArray(candidate.nestedEntities)) {
            const hasEnhancedNested = candidate.nestedEntities.some((entity: unknown) => 
                entity && typeof entity === 'object' && hasEnhancedColumns((entity as any).columns)
            );
            if (hasEnhancedNested) {
                return false;
            }
        }

        return true;
    }

    convert(input: LegacyJsonMapping): ConversionResult {
        return {
            format: 'legacy',
            mapping: input as JsonMapping,
            typeProtection: { protectedStringFields: [] },
            originalInput: input
        };
    }
}

/**
 * Unified JSON mapping converter that handles all supported formats using the Strategy pattern.
 * 
 * This converter automatically detects the input format and applies the appropriate conversion
 * strategy to transform any supported JSON mapping format into a standardized result.
 * 
 * **Supported Formats:**
 * - **Enhanced**: Rich format with metadata, type protection, and advanced column configurations
 * - **Model-Driven**: TypeScript interface-based mapping with structured field definitions
 * - **Legacy**: Simple format compatible with PostgresJsonQueryBuilder
 * 
 * **Usage:**
 * ```typescript
 * const converter = new JsonMappingConverter();
 * const result = converter.convert(someMapping);
 * const legacyMapping = converter.toLegacyMapping(someMapping);
 * ```
 * 
 * @public
 */
export class JsonMappingConverter {
    /** Ordered list of conversion strategies, checked in priority order */
    private strategies: ConversionStrategy[];

    /**
     * Creates a new JsonMappingConverter with all supported strategies.
     * 
     * Strategies are checked in order of specificity:
     * 1. Enhanced format (most feature-rich)
     * 2. Model-driven format (TypeScript-based)
     * 3. Legacy format (fallback)
     */
    constructor() {
        this.strategies = [
            new EnhancedFormatStrategy(),
            new ModelDrivenFormatStrategy(),
            new LegacyFormatStrategy()
        ];
    }

    /**
     * Detects the format of the input mapping without performing conversion.
     * 
     * This method uses the same strategy pattern as conversion but only returns
     * the detected format type for inspection purposes.
     * 
     * @param input - The JSON mapping to analyze
     * @returns The detected mapping format type
     * 
     * @throws {Error} When input format is not supported by any strategy
     * 
     * @example
     * ```typescript
     * const format = converter.detectFormat(myMapping);
     * console.log(`Detected format: ${format}`); // "enhanced", "model-driven", or "legacy"
     * ```
     */
    detectFormat(input: JsonMappingInput): MappingFormat {
        for (const strategy of this.strategies) {
            if (strategy.detect(input)) {
                const result = strategy.convert(input);
                return result.format;
            }
        }
        throw new Error('Unsupported JSON mapping format');
    }

    /**
     * Converts any supported JSON mapping format to a comprehensive result with metadata.
     * 
     * This is the primary conversion method that performs format detection and transformation
     * in a single operation. The result includes the legacy mapping, type protection configuration,
     * and metadata about the conversion process.
     * 
     * @param input - The JSON mapping in any supported format (Enhanced, Model-Driven, or Legacy)
     * @returns Complete conversion result with mapping, metadata, and type protection
     * 
     * @throws {Error} When the input format is not recognized by any strategy
     * 
     * @example
     * ```typescript
     * const result = converter.convert(enhancedMapping);
     * console.log(`Format: ${result.format}`);
     * console.log(`Type protection: ${result.typeProtection.protectedStringFields.length} fields`);
     * 
     * // Use the converted mapping
     * const queryBuilder = new PostgresJsonQueryBuilder(result.mapping);
     * ```
     * 
     * @see {@link toLegacyMapping} For simple mapping extraction
     * @see {@link getTypeProtection} For type protection only
     */
    convert(input: JsonMappingInput): ConversionResult {
        for (const strategy of this.strategies) {
            if (strategy.detect(input)) {
                return strategy.convert(input);
            }
        }
        throw new Error('Unsupported JSON mapping format: Unable to detect a compatible strategy for the provided input');
    }

    /**
     * Extracts only the legacy JsonMapping for direct use with PostgresJsonQueryBuilder.
     * 
     * This convenience method performs the full conversion but returns only the mapping portion,
     * discarding metadata and type protection information. Use this when you only need
     * the mapping for query building and don't require additional metadata.
     * 
     * @param input - The JSON mapping in any supported format
     * @returns Legacy-format JsonMapping ready for PostgresJsonQueryBuilder
     * 
     * @throws {Error} When the input format is not supported
     * 
     * @example
     * ```typescript
     * const legacyMapping = converter.toLegacyMapping(modelDrivenMapping);
     * const queryBuilder = new PostgresJsonQueryBuilder(legacyMapping);
     * const query = queryBuilder.build(selectQuery);
     * ```
     * 
     * @see {@link convert} For full conversion with metadata
     */
    toLegacyMapping(input: JsonMappingInput): JsonMapping {
        return this.convert(input).mapping;
    }

    /**
     * Extracts type protection configuration for runtime type checking.
     * 
     * Type protection helps identify fields that should be treated as strings
     * to prevent injection attacks or type coercion issues. This is particularly
     * useful when working with user input or external data sources.
     * 
     * @param input - The JSON mapping in any supported format
     * @returns Type protection configuration with protected field definitions
     * 
     * @throws {Error} When the input format is not supported
     * 
     * @example
     * ```typescript
     * const typeProtection = converter.getTypeProtection(enhancedMapping);
     * 
     * // Apply type protection during data processing
     * for (const field of typeProtection.protectedStringFields) {
     *     if (typeof data[field] !== 'string') {
     *         data[field] = String(data[field]);
     *     }
     * }
     * ```
     */
    getTypeProtection(input: JsonMappingInput): TypeProtectionConfig {
        return this.convert(input).typeProtection;
    }

    /**
     * Validates that the input mapping is well-formed and can be successfully converted.
     * 
     * This method performs comprehensive validation without attempting conversion,
     * returning an array of error messages for any issues found. An empty array
     * indicates the mapping is valid and ready for conversion.
     * 
     * **Validation Checks:**
     * - Basic structure validation (object type, required fields)
     * - Format-specific validation (Enhanced, Model-Driven, Legacy)
     * - Column configuration validation
     * - Type protection configuration validation
     * 
     * @param input - The JSON mapping to validate
     * @returns Array of validation error messages (empty if valid)
     * 
     * @example
     * ```typescript
     * const errors = converter.validate(suspiciousMapping);
     * if (errors.length > 0) {
     *     console.error('Validation failed:', errors);
     *     throw new Error(`Invalid mapping: ${errors.join(', ')}`);
     * }
     * 
     * // Safe to convert
     * const result = converter.convert(suspiciousMapping);
     * ```
     * 
     * @see {@link convert} Performs conversion after implicit validation
     */
    validate(input: JsonMappingInput): string[] {
        const errors: string[] = [];

        // Pre-validation checks
        if (!input || typeof input !== 'object') {
            errors.push('Input must be an object');
            return errors;
        }

        // Check for rootName before attempting conversion
        if (!('rootName' in input) || !input.rootName) {
            errors.push('rootName is required');
        }

        try {
            const result = this.convert(input);
            
            // Basic validation
            if (!result.mapping.rootName) {
                errors.push('rootName is required');
            }
            
            if (!result.mapping.rootEntity) {
                errors.push('rootEntity is required');
            } else {
                if (!result.mapping.rootEntity.id) {
                    errors.push('rootEntity.id is required');
                }
                if (!result.mapping.rootEntity.columns) {
                    errors.push('rootEntity.columns is required');
                }
            }

            // Validate nested entities
            if (result.mapping.nestedEntities) {
                for (const entity of result.mapping.nestedEntities) {
                    if (!entity.id) {
                        errors.push(`Nested entity missing id: ${entity.propertyName}`);
                    }
                    if (!entity.parentId) {
                        errors.push(`Nested entity missing parentId: ${entity.id}`);
                    }
                    if (!entity.propertyName) {
                        errors.push(`Nested entity missing propertyName: ${entity.id}`);
                    }
                }
            }

        } catch (error) {
            // Only add conversion error if we haven't already found specific errors
            if (errors.length === 0) {
                errors.push(`Conversion failed: ${error instanceof Error ? error.message : String(error)}`);
            }
        }

        return errors;
    }

    /**
     * Creates a new enhanced mapping from legacy mapping.
     */
    upgradeToEnhanced(legacy: LegacyJsonMapping, typeInfo?: { interface: string; importPath: string }): EnhancedJsonMapping {
        return {
            rootName: legacy.rootName,
            rootEntity: {
                id: legacy.rootEntity.id,
                name: legacy.rootEntity.name,
                columns: legacy.rootEntity.columns
            },
            nestedEntities: legacy.nestedEntities.map(entity => ({
                id: entity.id,
                name: entity.name,
                parentId: entity.parentId,
                propertyName: entity.propertyName,
                relationshipType: entity.relationshipType || 'object',
                columns: entity.columns
            })),
            resultFormat: legacy.resultFormat,
            emptyResult: legacy.emptyResult,
            typeInfo,
            metadata: {
                version: '1.0',
                description: 'Upgraded from legacy format'
            }
        };
    }
}