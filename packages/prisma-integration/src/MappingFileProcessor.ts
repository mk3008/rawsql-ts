/**
 * Model-driven JSON mapping file processor for rawsql-ts integration.
 * Handles detection and conversion of ModelDrivenJsonMapping formats.
 */

import * as fs from 'fs';
import * as path from 'path';
import { JsonMapping, TypeProtectionConfig, convertModelDrivenMapping } from 'rawsql-ts';


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
    success?: boolean;
    errors?: string[];
    convertedMapping?: JsonMapping;
}

/**
 * Detect the format of a JSON mapping file based on its structure.
 */
export function detectMappingFormat(mappingData: any): MappingFileFormat {
    // Check for ModelDrivenJsonMapping format
    if (mappingData.typeInfo && mappingData.structure && typeof mappingData.structure === 'object') {
        return 'model-driven';
    }


    // Check for legacy JsonMapping format
    if (mappingData.rootName && mappingData.rootEntity && mappingData.rootEntity.name) {
        return 'legacy';
    }

    return 'legacy'; // Default fallback
}

/**
 * Load and convert a JSON mapping file to the standard JsonMapping format.
 * Supports ModelDrivenJsonMapping format.
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

    // Convert different formats to legacy format
    let jsonMapping: JsonMapping;
    let typeProtection: TypeProtectionConfig = { protectedStringFields: [] };
    
    if (format === 'model-driven') {
        // Convert Model-Driven format to legacy format
        try {
            const conversionResult = convertModelDrivenMapping(mappingData);
            jsonMapping = conversionResult.jsonMapping;
            typeProtection = conversionResult.typeProtection;
        } catch (error) {
            throw new Error(`Failed to convert Model-Driven mapping ${filePath}: ${error}`);
        }
    } else if (mappingData.rootName && mappingData.rootEntity) {
        // Convert unified format to legacy format
        jsonMapping = {
            rootName: mappingData.rootName,
            rootEntity: {
                id: mappingData.rootEntity.id || 'root',
                name: mappingData.rootEntity.name || mappingData.rootName,
                columns: mappingData.rootEntity.columns || {}
            },
            nestedEntities: mappingData.nestedEntities || []
        };
    } else {
        // Assume it's already in legacy format
        jsonMapping = mappingData as JsonMapping;
    }

    return {
        format,
        jsonMapping,
        typeProtection,
        sourceFile: filePath,
        success: true,
        errors: [],
        convertedMapping: jsonMapping
    };
}

/**
 * Search for mapping files in a directory and return conversion results.
 * Supports multiple file naming patterns:
 * - *.model-driven.json (ModelDrivenJsonMapping format)
 
 * - *.json (legacy JsonMapping format)
 */
export function findAndConvertMappingFiles(baseDir: string): MappingFileResult[] {
    const results: MappingFileResult[] = [];

    if (!fs.existsSync(baseDir)) {
        return results;
    }

    // Simple recursive file search
    const searchDirectory = (dir: string) => {
        const entries = fs.readdirSync(dir);

        for (const entry of entries) {
            const fullPath = path.join(dir, entry);
            const stat = fs.statSync(fullPath);

            if (stat.isDirectory()) {
                searchDirectory(fullPath);
            } else if (stat.isFile() && entry.endsWith('.json')) {
                // Skip common non-mapping JSON files
                const nonMappingFiles = ['package.json', 'tsconfig.json', 'eslint.json', '.eslintrc.json', 'tsconfig.browser.json'];
                if (nonMappingFiles.includes(entry)) {
                    continue;
                }

                // Process model-driven files
                if (entry.endsWith('.model-driven.json')) {
                    try {
                        const result = loadAndConvertMappingFile(fullPath);
                        results.push(result);
                    } catch (error) {
                        console.warn(`Failed to load model-driven mapping file ${fullPath}:`, error);
                    }
                } else if (!entry.includes('.model-driven.')) {
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
