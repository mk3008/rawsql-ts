/**
 * Unified Static Analysis Orchestrator
 * 
 * Provides a single entry point for comprehensive static analysis of SQL files,
 * JSON mappings, and domain model compatibility validation.
 * 
 * This orchestrator combines:
 * - SQL Static Analysis (schema validation, syntax checking)
 * - Domain Model Compatibility (JSON mapping vs TypeScript interface validation)
 * 
 * Usage:
 * ```typescript
 * const orchestrator = new StaticAnalysisOrchestrator(options);
 * const report = await orchestrator.runFullAnalysis();
 * ```
 */

import { SqlStaticAnalyzer, SqlStaticAnalysisReport, SqlStaticAnalyzerOptions } from './SqlStaticAnalyzer';
import { DomainModelCompatibilityTester } from './DomainModelCompatibilityTester';
import { PrismaSchemaResolver } from './PrismaSchemaResolver';
import {
    UnifiedJsonMapping,
    ColumnMappingConfig
} from 'rawsql-ts';

// Model-driven types are not available, using any for now
type ModelDrivenJsonMapping = any;
type FieldMapping = any;
type StructureFields = any;
import { findAndConvertMappingFiles } from './MappingFileProcessor';
import * as path from 'path';
import * as fs from 'fs';

export interface StaticAnalysisOptions {
    /** Base directory for the project (typically where package.json is) */
    baseDir: string;
    /** Directory containing SQL and JSON mapping files */
    mappingDir: string;
    /** Prisma client instance (optional - will create if not provided) */
    prismaClient?: any;
    /** Schema name for Prisma resolution (default: 'public') */
    defaultSchema?: string;
    /** String field protection severity level (default: 'error') */
    stringFieldProtectionLevel?: 'error' | 'warning' | 'off';
    /** Enable debug logging */
    debug?: boolean;
}

export interface StringFieldValidationIssue {
    fieldName: string;
    columnName: string;
    entityName: string;
    filePath: string;
    hasStringType: boolean;
    severity: 'warning' | 'error';
    recommendation: string;
}

export interface StringFieldValidationReport {
    totalMappingFiles: number;
    totalStringFields: number;
    protectedFields: number;
    unprotectedFields: number;
    issues: StringFieldValidationIssue[];
    summary: string;
}

export interface ComprehensiveAnalysisReport {
    sqlAnalysis: SqlStaticAnalysisReport;
    domainModelAnalysis: {
        totalMappingFiles: number;
        validCompatibility: number;
        invalidCompatibility: number;
        results: Record<string, any>;
        summary: string;
    };
    stringFieldValidation: StringFieldValidationReport;
    overall: {
        allPassed: boolean;
        totalIssues: number;
        summary: string;
    };
    timestamp: string;
    /** Generate concise per-file summary */
    getConciseFileSummary?: () => string[];
}

export class StaticAnalysisOrchestrator {
    private options: StaticAnalysisOptions;
    private sqlAnalyzer?: SqlStaticAnalyzer;
    private domainModelTester?: DomainModelCompatibilityTester;
    private schemaResolver?: PrismaSchemaResolver;
    private ownsPrismaClient: boolean = false;
    private lastDomainModelResults?: Record<string, any>;
    private lastStringFieldValidation?: StringFieldValidationReport;
    private lastSqlReport?: SqlStaticAnalysisReport; constructor(options: StaticAnalysisOptions) {
        this.options = {
            defaultSchema: 'public',
            stringFieldProtectionLevel: 'error',
            debug: false,
            ...options
        };
    }

    /**
     * Initialize all analysis components
     */
    async initialize(): Promise<void> {
        const { debug } = this.options;

        if (debug) {
            console.log('🚀 Initializing Static Analysis Orchestrator...');
        }

        // Initialize Prisma client if not provided
        let prismaClient = this.options.prismaClient;
        if (!prismaClient) {
            // Import PrismaClient dynamically to avoid issues with generated client path
            try {
                const { PrismaClient } = await import('@prisma/client');
                prismaClient = new PrismaClient();
                this.ownsPrismaClient = true;
            } catch (error) {
                throw new Error('Failed to import PrismaClient. Make sure to run "npx prisma generate" first.');
            }
        }
        // Find schema.prisma file path from baseDir
        const schemaPath = this.findSchemaPath();

        // Initialize schema resolver
        this.schemaResolver = new PrismaSchemaResolver({
            defaultSchema: this.options.defaultSchema!,
            schemaPath: schemaPath, // Pass the discovered schema path
            debug: debug || false
        });

        await this.schemaResolver.resolveSchema(prismaClient);

        // Initialize SQL analyzer
        this.sqlAnalyzer = new SqlStaticAnalyzer({
            sqlDirectory: this.options.mappingDir,
            schemaResolver: this.schemaResolver,
            debug: debug || false
        });

        // Initialize domain model compatibility tester
        this.domainModelTester = new DomainModelCompatibilityTester({
            baseDir: this.options.baseDir,
            mappingDir: this.options.mappingDir,
            debug: debug || false
        });

        if (debug) {
            console.log('✅ Static Analysis Orchestrator initialized');
        }
    }

    /**
     * Run comprehensive static analysis covering both SQL and domain model aspects
     */
    async runFullAnalysis(): Promise<ComprehensiveAnalysisReport> {
        if (!this.sqlAnalyzer || !this.domainModelTester) {
            await this.initialize();
        }

        const { debug } = this.options;

        if (debug) {
            console.log('📊 Running comprehensive static analysis...');
        }        // Run SQL static analysis
        const sqlAnalysis = await this.sqlAnalyzer!.generateAnalysisReport();
        // Store SQL report for later use
        this.lastSqlReport = sqlAnalysis;

        // Run domain model compatibility analysis
        const domainModelResults = await this.domainModelTester!.validateAllMappingFiles();

        // Store results for concise summary
        this.lastDomainModelResults = domainModelResults;

        // Process domain model results
        const domainModelAnalysis = this.processDomainModelResults(domainModelResults);        // Run string field validation
        const stringFieldValidation = await this.validateStringFields();

        // Store results for concise summary
        this.lastStringFieldValidation = stringFieldValidation;

        // Generate overall summary
        const overall = this.generateOverallSummary(sqlAnalysis, domainModelAnalysis, stringFieldValidation);

        const report: ComprehensiveAnalysisReport = {
            sqlAnalysis,
            domainModelAnalysis,
            stringFieldValidation,
            overall,
            timestamp: new Date().toISOString(),
            getConciseFileSummary: () => this.generateMarkdownFileSummary()
        };

        if (debug) {
            console.log('🎉 Comprehensive static analysis completed');
            console.log(overall.summary);
        }

        return report;
    }

    /**
     * Run only SQL static analysis
     */
    async runSqlAnalysis(): Promise<SqlStaticAnalysisReport> {
        if (!this.sqlAnalyzer) {
            await this.initialize();
        }
        return await this.sqlAnalyzer!.generateAnalysisReport();
    }

    /**
     * Run only domain model compatibility analysis
     */
    async runDomainModelAnalysis(): Promise<Record<string, any>> {
        if (!this.domainModelTester) {
            await this.initialize();
        }
        return await this.domainModelTester!.validateAllMappingFiles();
    }

    /**
     * Validate a specific SQL file
     */
    async validateSpecificSqlFile(filename: string) {
        if (!this.sqlAnalyzer) {
            await this.initialize();
        }

        const sqlFiles = this.sqlAnalyzer!.discoverSqlFiles();
        const targetFile = sqlFiles.find(f => f.filename === filename);

        if (!targetFile) {
            throw new Error(`SQL file not found: ${filename}`);
        }

        return await this.sqlAnalyzer!.validateSqlFile(targetFile);
    }

    /**
     * Validate a specific JSON mapping file for domain model compatibility
     */
    async validateSpecificMappingFile(filename: string) {
        if (!this.domainModelTester) {
            await this.initialize();
        }
        return await this.domainModelTester!.validateMappingFile(filename);
    }

    /**
     * Clean up resources
     */
    async cleanup(): Promise<void> {
        if (this.ownsPrismaClient && this.options.prismaClient) {
            await this.options.prismaClient.$disconnect();
        }
    }

    /**
     * Process domain model results into standardized format
     */
    private processDomainModelResults(results: Record<string, any>) {
        const entries = Object.entries(results).filter(([key]) => key !== 'error');
        const totalMappingFiles = entries.length;
        const validCompatibility = entries.filter(([, result]) => (result as any).isValid).length;
        const invalidCompatibility = totalMappingFiles - validCompatibility;

        const summary = [
            `📋 Domain Model Compatibility Analysis`,
            `Total JSON mapping files with typeInfo: ${totalMappingFiles}`,
            `Valid compatibility: ${validCompatibility}`,
            `Invalid compatibility: ${invalidCompatibility}`,
            validCompatibility === totalMappingFiles ?
                '🎉 All domain model compatibility checks passed!' :
                '⚠️  Some domain model compatibility issues found'
        ].join('\n');

        return {
            totalMappingFiles,
            validCompatibility,
            invalidCompatibility,
            results,
            summary
        };
    }

    /**
     * Generate overall analysis summary
     */    private generateOverallSummary(
        sqlAnalysis: SqlStaticAnalysisReport,
        domainModelAnalysis: any,
        stringFieldValidation: StringFieldValidationReport
    ) {
        const sqlPassed = sqlAnalysis.validFiles === sqlAnalysis.totalFiles &&
            sqlAnalysis.validMappings === sqlAnalysis.filesWithMapping;
        const domainModelPassed = domainModelAnalysis.validCompatibility === domainModelAnalysis.totalMappingFiles;
        const stringFieldPassed = stringFieldValidation.unprotectedFields === 0;

        const allPassed = sqlPassed && domainModelPassed && stringFieldPassed;
        const totalIssues = sqlAnalysis.invalidFiles + sqlAnalysis.invalidMappings +
            domainModelAnalysis.invalidCompatibility + stringFieldValidation.unprotectedFields;

        // Create more detailed summary with better visual distinction
        const sqlStatus = sqlPassed ? '✅ Passed' : '🚨 ERRORS FOUND';
        const domainModelStatus = domainModelPassed ? '✅ Passed' : '⚠️  Warnings';
        const stringFieldStatus = stringFieldPassed ? '✅ All Protected' : '⚠️  Unprotected Fields';

        const summary = [
            `🏆 Overall Static Analysis Results`,
            `SQL Analysis: ${sqlStatus}`,
            `Domain Model Analysis: ${domainModelStatus}`,
            `String Field Protection: ${stringFieldStatus}`,
            `Total Issues: ${totalIssues}`,
            allPassed ? '🎉 All static analysis checks passed!' :
                (sqlPassed ? (stringFieldPassed ? '⚠️  Some warnings to review' : '⚠️  String field protection issues found') : '🚨 CRITICAL ERRORS - Action required!')
        ].join('\n');

        return {
            allPassed,
            totalIssues,
            summary
        };
    }

    /**
     * Generate markdown-style concise file summary
     * Format: 
     * ## SQL_filename
     * - SQL Static Syntax Check: ✅ Passed
     * - SQL to JSON Query Convert Check: ✅ Passed  
     * - JSON to Model Structure Check: ✅ Passed
     */
    generateMarkdownFileSummary(): string[] {
        if (!this.sqlAnalyzer || !this.domainModelTester) {
            return ['⚠️  Analysis not initialized. Call initialize() first.'];
        }

        // Use the last generated SQL report if available, or throw error if not available
        const sqlReport = this.lastSqlReport;
        if (!sqlReport) {
            throw new Error('No SQL analysis report available. Call runFullAnalysis() first.');
        }
        const results: string[] = [];

        // Process each SQL file
        for (const sqlResult of sqlReport.results) {
            const filename = sqlResult.filename;

            results.push(`## ${filename}`);

            // 1. SQL Static Syntax Check
            const sqlSyntaxStatus = sqlResult.isValid ? '✅ Passed' : '🚨 Failed';
            results.push(`- SQL Static Syntax Check: ${sqlSyntaxStatus}`);

            // 2. SQL to JSON Query Convert Check  
            let sqlToJsonStatus = '';
            if (sqlResult.hasJsonMapping) {
                sqlToJsonStatus = sqlResult.jsonMappingValid ? '✅ Passed' : '🚨 Failed';
            } else {
                sqlToJsonStatus = '⚠️ No JSON Mapping';
            }
            results.push(`- SQL to JSON Query Convert Check: ${sqlToJsonStatus}`);

            // 3. JSON to Model Structure Check
            let jsonToModelStatus = '';
            const domainResults = this.lastDomainModelResults;

            // If no JSON mapping exists, skip the domain model check
            if (!sqlResult.hasJsonMapping) {
                jsonToModelStatus = '⏭️ Skipped (No JSON mapping file)';
            } else if (domainResults && filename.replace('.sql', '.json') in domainResults) {
                const domainResult = domainResults[filename.replace('.sql', '.json')];
                if (domainResult && typeof domainResult === 'object' && 'isValid' in domainResult) {
                    jsonToModelStatus = domainResult.isValid ? '✅ Passed' : '⚠️ Warning';
                } else {
                    jsonToModelStatus = '⚠️ No TypeInfo';
                }
            } else {
                jsonToModelStatus = '⚠️ No Domain Model';
            }
            results.push(`- JSON to Model Structure Check: ${jsonToModelStatus}`);

            // Add detailed explanations for warnings/errors
            const issues: string[] = [];
            const jsonFileName = filename.replace('.sql', '.json'); if (!sqlResult.isValid && sqlResult.errors.length > 0) {
                const errorList = sqlResult.errors.join('; ');
                issues.push(`**🚨 SQL Syntax Errors**: ${errorList}. Please fix these SQL syntax issues to ensure proper query execution. Check for missing semicolons, incorrect table/column names, or invalid SQL constructs.`);
            }

            if (sqlResult.hasJsonMapping && !sqlResult.jsonMappingValid && sqlResult.jsonMappingErrors) {
                const errorList = sqlResult.jsonMappingErrors.join('; ');
                issues.push(`**🚨 JSON Mapping Errors**: ${errorList}. Review your \`${filename.replace('.sql', '.json')}\` file and ensure the JSON structure is valid and matches the expected format for query parameters and return types.`);
            } if (!sqlResult.hasJsonMapping) {
                issues.push(`**⚠️ Missing JSON Mapping**: Create \`${jsonFileName}\` to define how SQL results map to TypeScript types. This file should include query parameters, return type definitions, and optional TypeScript interface definitions for domain model validation. For detailed examples, see the usage guides in the \`docs/usage-guides/\` directory.`);
            }

            // Only check for specific domain model issues if JSON mapping exists
            if (sqlResult.hasJsonMapping) {
                if (jsonToModelStatus.includes('No TypeInfo')) {
                    issues.push(`**⚠️ Missing Type Information**: Add a "typeInfo" field to \`${jsonFileName}\` to enable type compatibility validation. This field should contain TypeScript interface definitions that match your domain models. Example: { "typeInfo": { "User": "interface User { id: number; name: string; }" } }`);
                }

                if (jsonToModelStatus.includes('No Domain Model')) {
                    issues.push(`**⚠️ No Domain Model Found**: Unable to locate domain model definitions in \`${jsonFileName}\`. Ensure the file contains proper domain model structure for type compatibility checking.`);
                }
            } if (jsonToModelStatus.includes('Warning')) {
                const domainResult = domainResults?.[filename.replace('.sql', '.json')];
                if (domainResult && domainResult.details) {
                    issues.push(`**⚠️ Model Compatibility Issue**: ${domainResult.details}. Review your SQL query and ensure the returned columns match the expected TypeScript interface structure.`);
                } else if (domainResult && domainResult.errors) {
                    // Use the specific error information from domain analysis
                    const errorText = domainResult.errors.join('; '); if (errorText.includes('No typeInfo specified')) {
                        // This will be handled by the unified message above
                    } else {
                        issues.push(`**⚠️ Model Compatibility Issue**: ${errorText}. Review your SQL query and ensure the returned columns match the expected TypeScript interface structure.`);
                    }
                } else {
                    // Debug: Add more specific warning information
                    console.log(`Debug - Warning details for ${filename}: jsonToModelStatus=${jsonToModelStatus}, domainResult=`, domainResult);
                    issues.push(`**⚠️ Model Compatibility Warning**: Domain model analysis found compatibility issues. Check your TypeScript interfaces and SQL query result structure.`);
                }
            }

            // Check for string field protection issues for this specific file
            if (sqlResult.hasJsonMapping && this.lastStringFieldValidation) {
                const fileStringIssues = this.lastStringFieldValidation.issues.filter(issue =>
                    issue.filePath.endsWith(jsonFileName)
                );
                if (fileStringIssues.length > 0) {
                    const fieldList = fileStringIssues.map(issue => `${issue.entityName}.${issue.fieldName}`).join(', ');
                    issues.push(`**⚠️ String Field Protection**: ${fileStringIssues.length} string field(s) lack protection: ${fieldList}. Add "type": "string" to these fields to ensure proper string type conversion and prevent type coercion issues. This is especially important for user-generated content fields.`);
                }
            }

            if (issues.length > 0) {
                results.push('');
                issues.forEach(issue => results.push(`${issue}`));
            }

            results.push(''); // Empty line between files
        }

        return results;
    }

    /**
     * Find schema.prisma file path starting from baseDir
     * This method searches common locations to support both terminal and VS Code test execution
     */
    private findSchemaPath(): string | undefined {
        const fs = require('fs');
        const { baseDir } = this.options;

        // Common schema.prisma locations relative to baseDir
        const commonPaths = [
            path.join(baseDir, 'prisma', 'schema.prisma'), // Standard location
            path.join(baseDir, 'schema.prisma'), // Root location
            path.join(baseDir, '..', 'prisma', 'schema.prisma'), // Parent directory
            path.join(baseDir, '..', 'schema.prisma'), // Parent root
            // Fallback to process.cwd() for backwards compatibility
            path.join(process.cwd(), 'prisma', 'schema.prisma'),
            path.join(process.cwd(), 'schema.prisma'),
        ];

        for (const schemaPath of commonPaths) {
            try {
                if (fs.existsSync(schemaPath) && fs.statSync(schemaPath).isFile()) {
                    if (this.options.debug) {
                        console.log(`🎯 Found schema.prisma at: ${schemaPath}`);
                    }
                    return schemaPath;
                }
            } catch (error) {
                // Continue checking other paths
                continue;
            }
        }

        if (this.options.debug) {
            console.warn(`⚠️  schema.prisma not found. Searched paths:`, commonPaths);
        }
        return undefined;
    }    /**
     * Validate string field protection in unified JSON mappings
     */
    async validateStringFields(): Promise<StringFieldValidationReport> {
        const { debug, stringFieldProtectionLevel } = this.options;

        // If protection is disabled, return empty report
        if (stringFieldProtectionLevel === 'off') {
            return {
                totalMappingFiles: 0,
                totalStringFields: 0,
                protectedFields: 0,
                unprotectedFields: 0,
                issues: [],
                summary: '⏭️ String field protection validation is disabled'
            };
        }

        const issues: StringFieldValidationIssue[] = [];
        let totalStringFields = 0;
        let protectedFields = 0;

        // Known string fields from common database schemas
        // This could be enhanced to read from Prisma schema dynamically
        const knownStringFields = new Set([
            'title', 'description', 'name', 'user_name', 'email',
            'category_name', 'color', 'comment_text', 'content',
            'address', 'phone', 'note', 'message', 'slug'
        ]);

        if (debug) {
            console.log('🔍 Validating string field protection...');
        }

        // Find all JSON mapping files using the new processor
        const mappingResults = findAndConvertMappingFiles(this.options.mappingDir);
        let totalMappingFiles = mappingResults.length;

        for (const mappingResult of mappingResults) {
            try {
                const { jsonMapping, typeProtection, sourceFile } = mappingResult;

                // Helper function to check columns in an entity
                const checkEntityColumns = (entityName: string, columns: Record<string, string>) => {
                    for (const [fieldName, columnName] of Object.entries(columns)) {
                        // Check if this column maps to a known string field in the database
                        if (knownStringFields.has(columnName)) {
                            totalStringFields++;

                            // Check if this field is protected by type protection
                            const isProtected = typeProtection.protectedStringFields.includes(columnName);

                            if (isProtected) {
                                protectedFields++;
                            } else {
                                issues.push({
                                    fieldName,
                                    columnName,
                                    entityName,
                                    filePath: path.relative(this.options.baseDir, sourceFile),
                                    hasStringType: false,
                                    severity: stringFieldProtectionLevel as 'warning' | 'error',
                                    recommendation: 'Add "type": "string" to ensure proper string type conversion and prevent type coercion issues'
                                });
                            }
                        }
                    }
                };

                // Check root entity
                if (jsonMapping.rootEntity) {
                    checkEntityColumns(jsonMapping.rootEntity.name, jsonMapping.rootEntity.columns);
                }

                // Check nested entities
                if (jsonMapping.nestedEntities) {
                    for (const entity of jsonMapping.nestedEntities) {
                        checkEntityColumns(entity.name, entity.columns);
                    }
                }
            } catch (error) {
                if (debug) {
                    console.warn(`⚠️  Failed to process mapping file ${mappingResult.sourceFile}:`, error);
                }
            }
        }

        const unprotectedFields = totalStringFields - protectedFields;
        const summary = unprotectedFields === 0
            ? `✅ All ${totalStringFields} string fields are properly protected`
            : `⚠️  ${unprotectedFields} of ${totalStringFields} string fields lack type protection`;

        if (debug) {
            console.log(`📊 String field validation: ${protectedFields}/${totalStringFields} protected`);
        }

        return {
            totalMappingFiles,
            totalStringFields,
            protectedFields,
            unprotectedFields,
            issues,
            summary
        };
    }

}

/**
 * Convenience function for running full static analysis
 */
export async function runComprehensiveStaticAnalysis(options: StaticAnalysisOptions): Promise<ComprehensiveAnalysisReport> {
    const orchestrator = new StaticAnalysisOrchestrator(options);
    try {
        const report = await orchestrator.runFullAnalysis();
        // Bind the method to the orchestrator context
        report.getConciseFileSummary = () => orchestrator.generateMarkdownFileSummary();
        return report;
    } finally {
        await orchestrator.cleanup();
    }
}

/**
 * Convenience function for running only SQL analysis
 */
export async function runSqlStaticAnalysis(options: StaticAnalysisOptions): Promise<SqlStaticAnalysisReport> {
    const orchestrator = new StaticAnalysisOrchestrator(options);
    try {
        return await orchestrator.runSqlAnalysis();
    } finally {
        await orchestrator.cleanup();
    }
}

/**
 * Convenience function for running only domain model analysis
 */
export async function runDomainModelAnalysis(options: StaticAnalysisOptions): Promise<Record<string, any>> {
    const orchestrator = new StaticAnalysisOrchestrator(options);
    try {
        return await orchestrator.runDomainModelAnalysis();
    } finally {
        await orchestrator.cleanup();
    }
}
