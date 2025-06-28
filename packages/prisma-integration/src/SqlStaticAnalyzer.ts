/**
 * SQL Static Analysis Library
 * 
 * Provides unified API for static analysis of SQL files, including:
 * - SQL file discovery and loading
 * - Schema validation using SqlSchemaValidator
 * - JSON mapping compatibility validation
 * - Comprehensive validation reports
 */

import { SelectQueryParser, SqlSchemaValidator, PostgresJsonQueryBuilder, JsonMapping, convertModelDrivenMapping } from 'rawsql-ts';
import { PrismaSchemaResolver } from './PrismaSchemaResolver';
import * as fs from 'fs';
import * as path from 'path';

export interface SqlFileInfo {
    filename: string;
    fullPath: string;
    baseName: string;
    content: string;
    relativePath?: string;
}

export interface SqlValidationResult {
    filename: string;
    isValid: boolean;
    errors: string[];
    parseResult?: any;
    hasJsonMapping: boolean;
    jsonMappingValid?: boolean;
    jsonMappingErrors?: string[];
}

export interface SqlStaticAnalysisReport {
    totalFiles: number;
    validFiles: number;
    invalidFiles: number;
    filesWithMapping: number;
    validMappings: number;
    invalidMappings: number;
    results: SqlValidationResult[];
    summary: string;
}

export interface SqlStaticAnalyzerOptions {
    sqlDirectory: string;
    schemaResolver: PrismaSchemaResolver;
    debug?: boolean;
}

export class SqlStaticAnalyzer {
    private options: SqlStaticAnalyzerOptions;
    private tableColumnResolver: (tableName: string) => string[];

    constructor(options: SqlStaticAnalyzerOptions) {
        this.options = options;
        this.tableColumnResolver = options.schemaResolver.createTableColumnResolver();
    }

    /**
     * Discover all SQL files in the configured directory
     */
    discoverSqlFiles(): SqlFileInfo[] {
        const { sqlDirectory, debug } = this.options;

        if (!fs.existsSync(sqlDirectory)) {
            throw new Error(`SQL directory does not exist: ${sqlDirectory}`);
        }

        // Recursively find all SQL files
        const sqlFiles: SqlFileInfo[] = [];

        const searchDirectory = (dir: string) => {
            const entries = fs.readdirSync(dir);

            for (const entry of entries) {
                const fullPath = path.join(dir, entry);
                const stat = fs.statSync(fullPath);

                if (stat.isDirectory()) {
                    searchDirectory(fullPath);
                } else if (stat.isFile() && entry.endsWith('.sql')) {
                    const content = fs.readFileSync(fullPath, 'utf-8');
                    const baseName = path.basename(entry, '.sql');
                    const relativePath = path.relative(sqlDirectory, fullPath);

                    sqlFiles.push({
                        filename: entry,
                        fullPath,
                        baseName,
                        content,
                        relativePath
                    });
                }
            }
        };

        searchDirectory(sqlDirectory);

        if (debug) {
            console.log(`📄 Found ${sqlFiles.length} SQL files in ${sqlDirectory}:`, sqlFiles.map(f => f.relativePath || f.filename));
        }

        return sqlFiles;
    }

    /**
     * Validate a single SQL file
     */
    async validateSqlFile(sqlFile: SqlFileInfo): Promise<SqlValidationResult> {
        const { debug } = this.options;
        const result: SqlValidationResult = {
            filename: sqlFile.filename,
            isValid: false,
            errors: [],
            hasJsonMapping: false
        };

        try {
            if (debug) {
                console.log(`🔍 Validating ${sqlFile.filename}...`);
            }

            // Parse SQL content
            const parseResult = SelectQueryParser.parse(sqlFile.content);
            if (!parseResult) {
                result.errors.push('Failed to parse SQL content');
                return result;
            }
            result.parseResult = parseResult;

            // Validate schema
            try {
                SqlSchemaValidator.validate(parseResult, this.tableColumnResolver);
            } catch (schemaError: any) {
                result.errors.push(`Schema validation failed: ${schemaError.message}`);
                return result;
            }

            // Check for JSON mapping
            const jsonPath = path.join(path.dirname(sqlFile.fullPath), `${sqlFile.baseName}.json`);
            result.hasJsonMapping = fs.existsSync(jsonPath);

            if (result.hasJsonMapping) {
                const jsonValidationResult = await this.validateJsonMapping(sqlFile, jsonPath, parseResult);
                result.jsonMappingValid = jsonValidationResult.isValid;
                result.jsonMappingErrors = jsonValidationResult.errors;
            }

            // Mark as valid if SQL parsing and schema validation passed
            result.isValid = result.errors.length === 0;

            if (debug && result.isValid) {
                console.log(`✅ ${sqlFile.filename}: Validation passed`);
            }

        } catch (error: any) {
            result.errors.push(`Unexpected error: ${error.message}`);
        }

        return result;
    }

    /**
     * Validate JSON mapping for a SQL file
     */
    private async validateJsonMapping(sqlFile: SqlFileInfo, jsonPath: string, parseResult: any): Promise<{ isValid: boolean; errors: string[] }> {
        const { debug } = this.options;
        const result = { isValid: false, errors: [] as string[] };

        try {
            if (debug) {
                console.log(`✅ Found JSON mapping: ${sqlFile.baseName}.json`);
            }

            // Read and parse JSON mapping using unified processor
            const jsonContent = fs.readFileSync(jsonPath, 'utf-8');
            let jsonMapping: JsonMapping;

            try {
                const rawMapping = JSON.parse(jsonContent);
                
                // Check if this is a Model-driven mapping (has typeInfo and structure)
                if (rawMapping.typeInfo && rawMapping.structure) {
                    // Use the convertModelDrivenMapping function
                    const conversionResult = convertModelDrivenMapping(rawMapping);
                    jsonMapping = conversionResult.jsonMapping;
                } else if (rawMapping.rootName && rawMapping.rootEntity) {
                    // Already in legacy format
                    jsonMapping = rawMapping as JsonMapping;
                } else {
                    // Invalid format
                    result.errors.push('JSON mapping must be either Model-driven format (with typeInfo and structure) or Legacy format (with rootName and rootEntity)');
                    return result;
                }
            } catch (parseError: any) {
                result.errors.push(`Failed to process JSON mapping: ${parseError.message}`);
                return result;
            }

            // Basic validation - the unified processor ensures correct structure
            if (!jsonMapping || !jsonMapping.rootName || !jsonMapping.rootEntity) {
                result.errors.push('Invalid JSON mapping structure after processing');
                return result;
            }

            // Test JSON query building
            try {
                const jsonQueryBuilder = new PostgresJsonQueryBuilder();
                const jsonQuery = jsonQueryBuilder.buildJsonQuery(parseResult, jsonMapping);

                if (!jsonQuery) {
                    result.errors.push('Failed to build JSON query');
                    return result;
                }
            } catch (buildError: any) {
                result.errors.push(`JSON query building failed: ${buildError.message}`);
                return result;
            }

            result.isValid = true;

            if (debug) {
                console.log(`🎯 ${sqlFile.filename}: SQL + JSON mapping validation passed`);
            }

        } catch (error: any) {
            result.errors.push(`JSON mapping validation error: ${error.message}`);
        }

        return result;
    }

    /**
     * Validate all SQL files in the directory
     */
    async validateAllSqlFiles(): Promise<SqlValidationResult[]> {
        const sqlFiles = this.discoverSqlFiles();
        const results: SqlValidationResult[] = [];

        for (const sqlFile of sqlFiles) {
            const result = await this.validateSqlFile(sqlFile);
            results.push(result);
        }

        return results;
    }

    /**
     * Generate comprehensive analysis report
     */
    async generateAnalysisReport(): Promise<SqlStaticAnalysisReport> {
        const results = await this.validateAllSqlFiles();

        const totalFiles = results.length;
        const validFiles = results.filter(r => r.isValid).length;
        const invalidFiles = totalFiles - validFiles;
        const filesWithMapping = results.filter(r => r.hasJsonMapping).length;
        const validMappings = results.filter(r => r.hasJsonMapping && r.jsonMappingValid).length;
        const invalidMappings = filesWithMapping - validMappings;

        const summary = [
            `📊 SQL Static Analysis Report`,
            `Total SQL files: ${totalFiles}`,
            `Valid SQL files: ${validFiles}`,
            `Invalid SQL files: ${invalidFiles}`,
            `Files with JSON mapping: ${filesWithMapping}`,
            `Valid JSON mappings: ${validMappings}`,
            `Invalid JSON mappings: ${invalidMappings}`,
            validFiles === totalFiles && validMappings === filesWithMapping ?
                '🎉 All validations passed!' :
                '⚠️  Some validations failed - check details below'
        ].join('\n');

        return {
            totalFiles,
            validFiles,
            invalidFiles,
            filesWithMapping,
            validMappings,
            invalidMappings,
            results,
            summary
        };
    }

    /**
     * Validate schema availability and table information
     */
    validateSchemaInfo(): { isValid: boolean; tableNames: string[]; errors: string[] } {
        const result = { isValid: false, tableNames: [] as string[], errors: [] as string[] };

        try {
            const tableNames = this.options.schemaResolver.getTableNames();

            if (!tableNames || tableNames.length === 0) {
                result.errors.push('No tables found in schema');
                return result;
            }

            result.tableNames = tableNames;
            result.isValid = true;

            if (this.options.debug) {
                console.log(`🏗️  Available tables: ${tableNames.join(', ')}`);
            }

        } catch (error: any) {
            result.errors.push(`Schema validation error: ${error.message}`);
        }

        return result;
    }
}

/**
 * Convenience function for quick SQL static analysis
 */
export async function analyzeSqlFiles(options: SqlStaticAnalyzerOptions): Promise<SqlStaticAnalysisReport> {
    const analyzer = new SqlStaticAnalyzer(options);
    return await analyzer.generateAnalysisReport();
}

/**
 * Convenience function for validating a single SQL file
 */
export async function validateSqlFile(sqlFilePath: string, schemaResolver: PrismaSchemaResolver): Promise<SqlValidationResult> {
    const sqlDirectory = path.dirname(sqlFilePath);
    const filename = path.basename(sqlFilePath);

    const analyzer = new SqlStaticAnalyzer({
        sqlDirectory,
        schemaResolver,
        debug: false
    });

    const sqlFiles = analyzer.discoverSqlFiles();
    const targetFile = sqlFiles.find(f => f.filename === filename);

    if (!targetFile) {
        return {
            filename,
            isValid: false,
            errors: [`File not found: ${sqlFilePath}`],
            hasJsonMapping: false
        };
    }

    return await analyzer.validateSqlFile(targetFile);
}
