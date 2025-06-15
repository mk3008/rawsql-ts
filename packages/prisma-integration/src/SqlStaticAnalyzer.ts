/**
 * SQL Static Analysis Library
 * 
 * Provides unified API for static analysis of SQL files, including:
 * - SQL file discovery and loading
 * - Schema validation using SqlSchemaValidator
 * - JSON mapping compatibility validation
 * - Comprehensive validation reports
 */

import { SelectQueryParser } from '../../core/src/parsers/SelectQueryParser';
import { SqlSchemaValidator } from '../../core/src/utils/SqlSchemaValidator';
import { PostgresJsonQueryBuilder, JsonMapping } from '../../core/src';
import { PrismaSchemaResolver } from './PrismaSchemaResolver';
import * as fs from 'fs';
import * as path from 'path';

export interface SqlFileInfo {
    filename: string;
    fullPath: string;
    baseName: string;
    content: string;
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

        const files = fs.readdirSync(sqlDirectory);
        const sqlFiles = files.filter(file => file.endsWith('.sql'));

        if (debug) {
            console.log(`📄 Found ${sqlFiles.length} SQL files in ${sqlDirectory}:`, sqlFiles);
        }

        return sqlFiles.map(filename => {
            const fullPath = path.join(sqlDirectory, filename);
            const content = fs.readFileSync(fullPath, 'utf-8');
            const baseName = path.basename(filename, '.sql');

            return {
                filename,
                fullPath,
                baseName,
                content
            };
        });
    }

    /**
     * Validate a single SQL file
     */
    validateSqlFile(sqlFile: SqlFileInfo): SqlValidationResult {
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
                const jsonValidationResult = this.validateJsonMapping(sqlFile, jsonPath, parseResult);
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
    private validateJsonMapping(sqlFile: SqlFileInfo, jsonPath: string, parseResult: any): { isValid: boolean; errors: string[] } {
        const { debug } = this.options;
        const result = { isValid: false, errors: [] as string[] };

        try {
            if (debug) {
                console.log(`✅ Found JSON mapping: ${sqlFile.baseName}.json`);
            }

            // Read and parse JSON mapping
            const jsonContent = fs.readFileSync(jsonPath, 'utf-8');
            let jsonMapping: JsonMapping;

            try {
                jsonMapping = JSON.parse(jsonContent);
            } catch (parseError: any) {
                result.errors.push(`Failed to parse JSON mapping: ${parseError.message}`);
                return result;
            }

            // Validate JSON mapping structure
            if (!jsonMapping.rootName) {
                result.errors.push('JSON mapping missing rootName');
            }
            if (!jsonMapping.rootEntity) {
                result.errors.push('JSON mapping missing rootEntity');
            }
            if (!jsonMapping.rootEntity?.columns) {
                result.errors.push('JSON mapping missing rootEntity.columns');
            }

            if (result.errors.length > 0) {
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
    validateAllSqlFiles(): SqlValidationResult[] {
        const sqlFiles = this.discoverSqlFiles();
        const results: SqlValidationResult[] = [];

        for (const sqlFile of sqlFiles) {
            const result = this.validateSqlFile(sqlFile);
            results.push(result);
        }

        return results;
    }

    /**
     * Generate comprehensive analysis report
     */
    generateAnalysisReport(): SqlStaticAnalysisReport {
        const results = this.validateAllSqlFiles();

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
    return analyzer.generateAnalysisReport();
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

    return analyzer.validateSqlFile(targetFile);
}
