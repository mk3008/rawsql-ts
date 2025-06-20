/**
 * Model-driven JSON mapping file processor for rawsql-ts integration.
 * Handles detection and conversion of both UnifiedJsonMapping and ModelDrivenJsonMapping formats.
 */

import * as fs from 'fs';
import * as path from 'path';
import {
    JsonMapping,
    UnifiedJsonMapping,
    convertUnifiedMapping,
    ModelDrivenJsonMapping,
    convertModelDrivenMapping,
    validateModelDrivenMapping,
    TypeProtectionConfig
} from 'rawsql-ts';

/**
 * Supported JSON mapping file formats.
 */
export type MappingFileFormat = 'unified' | 'model-driven' | 'legacy';

/**
 * Result of mapping file detection and conversion.
 */
export interface MappingFileResult {
    format: MappingFileFormat;
    jsonMapping: JsonMapping;
    typeProtection: TypeProtectionConfig;
    sourceFile: string;
}

/**
 * Detect the format of a JSON mapping file based on its structure.
 */
export function detectMappingFormat(mappingData: any): MappingFileFormat {
    // Check for ModelDrivenJsonMapping format
    if (mappingData.typeInfo && mappingData.structure && typeof mappingData.structure === 'object') {
        return 'model-driven';
    }

    // Check for UnifiedJsonMapping format  
    if (mappingData.rootEntity && mappingData.rootEntity.id && mappingData.rootEntity.columns) {
        return 'unified';
    }

    // Check for legacy JsonMapping format
    if (mappingData.rootName && mappingData.rootEntity && mappingData.rootEntity.name) {
        return 'legacy';
    }

    return 'legacy'; // Default fallback
}

/**
 * Load and convert a JSON mapping file to the standard JsonMapping format.
 * Supports both UnifiedJsonMapping and ModelDrivenJsonMapping formats.
 */
export function loadAndConvertMappingFile(filePath: string): MappingFileResult {
    if (!fs.existsSync(filePath)) {
        throw new Error(`Mapping file not found: ${filePath}`);
    }

    const fileContent = fs.readFileSync(filePath, 'utf-8');
    let mappingData: any;

    try {
        mappingData = JSON.parse(fileContent);
    } catch (error) {
        throw new Error(`Invalid JSON in mapping file ${filePath}: ${error}`);
    }

    const format = detectMappingFormat(mappingData);

    switch (format) {
        case 'model-driven': {
            const modelMapping = mappingData as ModelDrivenJsonMapping;

            // Validate the model-driven mapping
            const validationErrors = validateModelDrivenMapping(modelMapping);
            if (validationErrors.length > 0) {
                throw new Error(`Invalid ModelDrivenJsonMapping in ${filePath}: ${validationErrors.join(', ')}`);
            }

            const result = convertModelDrivenMapping(modelMapping);
            return {
                format: 'model-driven',
                jsonMapping: result.jsonMapping,
                typeProtection: result.typeProtection,
                sourceFile: filePath
            };
        }

        case 'unified': {
            const unifiedMapping = mappingData as UnifiedJsonMapping;
            const result = convertUnifiedMapping(unifiedMapping);
            return {
                format: 'unified',
                jsonMapping: result.jsonMapping,
                typeProtection: result.typeProtection,
                sourceFile: filePath
            };
        }

        case 'legacy':
        default: {
            // Assume it's already in JsonMapping format
            const jsonMapping = mappingData as JsonMapping;
            return {
                format: 'legacy',
                jsonMapping,
                typeProtection: { protectedStringFields: [] },
                sourceFile: filePath
            };
        }
    }
}

/**
 * Search for mapping files in a directory and return conversion results.
 * Supports multiple file naming patterns:
 * - *.model-driven.json (ModelDrivenJsonMapping format)
 * - *.unified.json (UnifiedJsonMapping format) 
 * - *.json (legacy JsonMapping format)
 */
export function findAndConvertMappingFiles(baseDir: string): MappingFileResult[] {
    const results: MappingFileResult[] = [];

    if (!fs.existsSync(baseDir)) {
        return results;
    }

    const searchPatterns = [
        '**/*.model-driven.json',
        '**/*.unified.json',
        '**/*.json'
    ];

    // Simple recursive file search
    const searchDirectory = (dir: string) => {
        const entries = fs.readdirSync(dir);

        for (const entry of entries) {
            const fullPath = path.join(dir, entry);
            const stat = fs.statSync(fullPath);

            if (stat.isDirectory()) {
                searchDirectory(fullPath);
            } else if (stat.isFile() && entry.endsWith('.json')) {
                // Prioritize model-driven files
                if (entry.endsWith('.model-driven.json')) {
                    try {
                        const result = loadAndConvertMappingFile(fullPath);
                        results.push(result);
                    } catch (error) {
                        console.warn(`Failed to load model-driven mapping file ${fullPath}:`, error);
                    }
                } else if (entry.endsWith('.unified.json')) {
                    try {
                        const result = loadAndConvertMappingFile(fullPath);
                        results.push(result);
                    } catch (error) {
                        console.warn(`Failed to load unified mapping file ${fullPath}:`, error);
                    }
                } else if (!entry.includes('.model-driven.') && !entry.includes('.unified.')) {
                    // Regular JSON file - try to detect format
                    try {
                        const result = loadAndConvertMappingFile(fullPath);
                        results.push(result);
                    } catch (error) {
                        // Silently skip files that aren't mapping files
                    }
                }
            }
        }
    };

    searchDirectory(baseDir);
    return results;
}

/**
 * Get mapping file statistics for a directory.
 */
export function getMappingFileStats(baseDir: string): {
    totalFiles: number;
    byFormat: Record<MappingFileFormat, number>;
    files: { path: string; format: MappingFileFormat }[];
} {
    const results = findAndConvertMappingFiles(baseDir);

    const stats = {
        totalFiles: results.length,
        byFormat: {
            'model-driven': 0,
            'unified': 0,
            'legacy': 0
        } as Record<MappingFileFormat, number>,
        files: results.map(r => ({ path: r.sourceFile, format: r.format }))
    };

    for (const result of results) {
        stats.byFormat[result.format]++;
    }

    return stats;
}
