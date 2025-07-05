/**
 * Post-processor for transforming database values to appropriate TypeScript types
 * after JSON serialization from PostgreSQL
 */

export interface TypeTransformationConfig {
    /** Column transformations mapping - takes precedence over value-based detection */
    columnTransformations?: {
        [columnName: string]: TypeTransformation;
    };
    /** Global transformation rules by SQL data type */
    globalTransformations?: {
        [sqlType: string]: TypeTransformation;
    };
    /** Custom transformation functions */
    customTransformers?: {
        [transformerName: string]: (value: unknown) => unknown;
    };
    /** Enable value-based type detection when column mapping is not provided (default: true) */
    enableValueBasedDetection?: boolean;
    /** Strict date detection - only convert ISO 8601 with 'T' separator (default: false) */
    strictDateDetection?: boolean;
}

export interface TypeTransformation {
    /** Source SQL data type */
    sourceType: 'DATE' | 'TIMESTAMP' | 'BIGINT' | 'NUMERIC' | 'JSONB' | 'custom';
    /** Target TypeScript type representation */
    targetType: 'Date' | 'bigint' | 'string' | 'number' | 'object' | 'custom';
    /** Custom transformer function name (for custom type) */
    customTransformer?: string;
    /** Whether to handle null values (default: true) */
    handleNull?: boolean;
    /** Validation function for the value */
    validator?: (value: unknown) => boolean;
}

/**
 * Applies type transformations to JSON results from PostgreSQL
 */
export class TypeTransformationPostProcessor {
    private config: TypeTransformationConfig; constructor(config: TypeTransformationConfig = {}) {
        this.config = {
            enableValueBasedDetection: true,
            strictDateDetection: false,
            ...config
        };
    }

    /**
     * Transform a single result object
     * @param result The result object from PostgreSQL JSON query
     * @returns Transformed result with proper TypeScript types
     */
    public transformResult<T = unknown>(result: unknown): T {
        if (result === null || result === undefined) {
            return result as T;
        }

        if (Array.isArray(result)) {
            return result.map(item => this.transformSingleObject(item)) as T;
        }

        return this.transformSingleObject(result) as T;
    }

    /**
     * Transform a single object recursively
     */
    private transformSingleObject(obj: unknown): unknown {
        if (obj === null || obj === undefined || typeof obj !== 'object') {
            return obj;
        }

        if (Array.isArray(obj)) {
            return obj.map(item => this.transformSingleObject(item));
        }

        const transformed: Record<string, unknown> = {};

        for (const [key, value] of Object.entries(obj)) {
            if (value === null || value === undefined) {
                transformed[key] = value;
                continue;
            }            // Check for column-specific transformation first (takes precedence)
            const columnTransform = this.config.columnTransformations?.[key];
            if (columnTransform) {
                transformed[key] = this.applyTransformation(value, columnTransform);
                continue;
            }

            // Only apply value-based detection if enabled and no column mapping exists
            if (this.config.enableValueBasedDetection) {
                const detectedTransform = this.detectValueBasedTransformation(value);
                if (detectedTransform) {
                    transformed[key] = this.applyTransformation(value, detectedTransform);
                    continue;
                }
            }

            // Apply global transformations based on SQL type (if available)
            const globalTransform = this.config.globalTransformations &&
                this.getGlobalTransformationForValue(value);
            if (globalTransform) {
                transformed[key] = this.applyTransformation(value, globalTransform);
                continue;
            }

            // Recursively transform nested objects
            if (typeof value === 'object' && !Array.isArray(value)) {
                transformed[key] = this.transformSingleObject(value);
                continue;
            }

            if (Array.isArray(value)) {
                transformed[key] = value.map(item =>
                    typeof item === 'object' ? this.transformSingleObject(item) : item
                );
                continue;
            }

            // No transformation needed
            transformed[key] = value;
        }

        return transformed;
    }

    /**
     * Detect value type and create appropriate transformation based on value characteristics
     * This is the core value-based detection logic
     */
    private detectValueBasedTransformation(value: any): TypeTransformation | null {
        // Date string detection
        if (typeof value === 'string' && this.isDateString(value)) {
            return {
                sourceType: 'TIMESTAMP',
                targetType: 'Date',
                handleNull: true,
                validator: (v) => typeof v === 'string' && !isNaN(Date.parse(v))
            };
        }

        // BigInt detection (number > MAX_SAFE_INTEGER)
        if (typeof value === 'number' && !Number.isSafeInteger(value)) {
            return {
                sourceType: 'BIGINT',
                targetType: 'bigint',
                handleNull: true,
                validator: (v) => {
                    try {
                        if (typeof v === 'string' || typeof v === 'number' || typeof v === 'bigint' || typeof v === 'boolean') {
                            BigInt(v);
                            return true;
                        }
                        return false;
                    } catch {
                        return false;
                    }
                }
            };
        }

        // Large string number detection (potential BIGINT)
        if (typeof value === 'string' && /^\d{16,}$/.test(value)) {
            return {
                sourceType: 'BIGINT',
                targetType: 'bigint',
                handleNull: true,
                validator: (v) => {
                    try {
                        if (typeof v === 'string' || typeof v === 'number' || typeof v === 'bigint' || typeof v === 'boolean') {
                            BigInt(v);
                            return true;
                        }
                        return false;
                    } catch {
                        return false;
                    }
                }
            };
        }

        return null;
    }

    /**
     * Get global transformation for a specific value (if any match)
     * This is separate from value-based detection and relies on configured global rules
     */
    private getGlobalTransformationForValue(value: any): TypeTransformation | null {
        if (!this.config.globalTransformations) {
            return null;
        }

        // This could be extended to match values against configured global rules
        // For now, it's a placeholder for future SQL-type-based global transformations
        return null;
    }

    /**
     * @deprecated Use detectValueBasedTransformation instead
     * Detect value type and get appropriate global transformation
     */
    private detectAndGetGlobalTransformation(value: any): TypeTransformation | null {
        return this.detectValueBasedTransformation(value);
    }

    /**
     * Check if string is a valid date string
     * Supports both strict (ISO 8601 with T separator) and loose detection
     */
    private isDateString(value: string): boolean {
        if (this.config.strictDateDetection) {
            // Strict: Only ISO 8601 with T separator (safer for user input)
            const strictIsoPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?(?:Z|[+-]\d{2}:\d{2})?$/;
            if (!strictIsoPattern.test(value)) {
                return false;
            }
        } else {
            // Loose: ISO 8601 date pattern (includes date-only strings)
            const isoDatePattern = /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{3})?(?:Z|[+-]\d{2}:\d{2})?)?$/;
            if (!isoDatePattern.test(value)) {
                return false;
            }
        }

        const date = new Date(value);
        return !isNaN(date.getTime());
    }

    /**
     * Apply a specific transformation to a value
     */
    private applyTransformation(value: any, transformation: TypeTransformation): any {
        // Handle null values
        if (value === null || value === undefined) {
            return transformation.handleNull !== false ? value : null;
        }

        // Validate value if validator is provided
        if (transformation.validator && !transformation.validator(value)) {
            console.warn(`TypeTransformationPostProcessor: Value validation failed for ${value}`);
            return value;
        }

        try {
            switch (transformation.targetType) {
                case 'Date':
                    return new Date(value); case 'bigint':
                    // Handle both string and number inputs for BIGINT
                    // For scientific notation numbers, convert to integer first
                    if (typeof value === 'number') {
                        // Convert scientific notation to integer string
                        const integerValue = Math.trunc(value);
                        return BigInt(integerValue.toString());
                    }
                    return BigInt(value);

                case 'string':
                    return value.toString();

                case 'number':
                    return typeof value === 'string' ? parseFloat(value) : Number(value);

                case 'object':
                    return typeof value === 'string' ? JSON.parse(value) : value;

                case 'custom':
                    if (transformation.customTransformer &&
                        this.config.customTransformers?.[transformation.customTransformer]) {
                        return this.config.customTransformers[transformation.customTransformer](value);
                    }
                    break;

                default:
                    return value;
            }
        } catch (error) {
            console.warn(`TypeTransformationPostProcessor: Transformation failed for ${value}:`, error);
            return value;
        }

        return value;
    }

    /**
     * Create a default configuration for common PostgreSQL types
     * Enables value-based detection with loose date detection by default
     */
    public static createDefaultConfig(): TypeTransformationConfig {
        return {
            enableValueBasedDetection: true,
            strictDateDetection: false,
            globalTransformations: {
                'DATE': {
                    sourceType: 'DATE',
                    targetType: 'Date',
                    handleNull: true,
                    validator: (value) => typeof value === 'string' && !isNaN(Date.parse(value))
                },
                'TIMESTAMP': {
                    sourceType: 'TIMESTAMP',
                    targetType: 'Date',
                    handleNull: true,
                    validator: (value) => typeof value === 'string' && !isNaN(Date.parse(value))
                },
                'BIGINT': {
                    sourceType: 'BIGINT',
                    targetType: 'bigint',
                    handleNull: true,
                    validator: (value) => {
                        try {
                            if (typeof value === 'string' || typeof value === 'number' || typeof value === 'bigint' || typeof value === 'boolean') {
                                BigInt(value);
                                return true;
                            }
                            return false;
                        } catch {
                            return false;
                        }
                    }
                }
            }
        };
    }

    /**
     * Create a safe configuration for handling user input
     * Disables value-based detection and uses strict date detection
     */
    public static createSafeConfig(columnMappings?: { [columnName: string]: TypeTransformation }): TypeTransformationConfig {
        return {
            enableValueBasedDetection: false,
            strictDateDetection: true,
            columnTransformations: columnMappings || {},
            globalTransformations: {
                'DATE': {
                    sourceType: 'DATE',
                    targetType: 'Date',
                    handleNull: true,
                    validator: (value) => typeof value === 'string' && !isNaN(Date.parse(value))
                },
                'TIMESTAMP': {
                    sourceType: 'TIMESTAMP',
                    targetType: 'Date',
                    handleNull: true,
                    validator: (value) => typeof value === 'string' && !isNaN(Date.parse(value))
                },
                'BIGINT': {
                    sourceType: 'BIGINT',
                    targetType: 'bigint',
                    handleNull: true,
                    validator: (value) => {
                        try {
                            if (typeof value === 'string' || typeof value === 'number' || typeof value === 'bigint' || typeof value === 'boolean') {
                                BigInt(value);
                                return true;
                            }
                            return false;
                        } catch {
                            return false;
                        }
                    }
                }
            }
        };
    }
}

/**
 * Convenience function to create and apply transformations
 */
export function transformDatabaseResult<T = unknown>(
    result: unknown,
    config?: TypeTransformationConfig
): T {
    const processor = new TypeTransformationPostProcessor(
        config || TypeTransformationPostProcessor.createDefaultConfig()
    );
    return processor.transformResult<T>(result);
}

/**
 * Type-safe transformation helpers
 */
export const TypeTransformers = {
    /**
     * Transform date string to Date object
     */
    toDate: (value: string | null): Date | null => {
        if (value === null || value === undefined) return null;
        const date = new Date(value);
        return isNaN(date.getTime()) ? null : date;
    },

    /**
     * Transform numeric string to BigInt
     */
    toBigInt: (value: string | number | null): bigint | null => {
        if (value === null || value === undefined) return null;
        try {
            return BigInt(value);
        } catch {
            return null;
        }
    },

    /**
     * Transform JSON string to object
     */
    toObject: <T = unknown>(value: string | null): T | null => {
        if (value === null || value === undefined) return null;
        try {
            return JSON.parse(value) as T;
        } catch {
            return null;
        }
    }
};
