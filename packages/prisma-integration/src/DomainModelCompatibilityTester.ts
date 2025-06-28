/**
 * Generic Domain Model Compatibility Test Helper
 * 
 * Provides utility functions for automatically testing JsonMapping compatibility
 * with TypeScript interfaces using only interface name and import path.
 */

import { AutoTypeCompatibilityValidator } from './AutoTypeCompatibilityValidator';
import { EnhancedJsonMapping } from './EnhancedJsonMapping';
import * as fs from 'fs';
import * as path from 'path';

export interface TestValidationOptions {
    /**
     * Base directory for resolving import paths (defaults to process.cwd())
     */
    baseDir?: string;

    /**
     * Directory containing JsonMapping files (defaults to './rawsql-ts')
     */
    mappingDir?: string;

    /**
     * Enable debug logging
     */
    debug?: boolean;
}

/**
 * Generic test helper for domain model compatibility validation
 */
export class DomainModelCompatibilityTester {
    private validator: AutoTypeCompatibilityValidator;
    private options: TestValidationOptions;

    constructor(options: TestValidationOptions = {}) {
        // Use module directory as default base instead of process.cwd() for consistent resolution
        const moduleDir = path.dirname(__filename);
        const defaultBaseDir = path.resolve(moduleDir, '..');
        
        this.options = {
            baseDir: defaultBaseDir,
            mappingDir: './rawsql-ts',
            debug: false,
            ...options
        };

        this.validator = new AutoTypeCompatibilityValidator({
            baseDir: this.options.baseDir,
            debug: this.options.debug
        });
    }

    /**
     * Validate a single JsonMapping file against its specified interface
     * 
     * @param mappingFileName - Name of the JsonMapping file (e.g., 'getTodoDetail.json')
     * @returns Promise<{ isValid: boolean, errors: string[], details: any }>
     */
    public async validateMappingFile(mappingFileName: string) {
        const mappingPath = path.join(this.options.mappingDir!, mappingFileName);

        if (!fs.existsSync(mappingPath)) {
            return {
                isValid: false,
                errors: [`JsonMapping file not found: ${mappingPath}`],
                details: null
            };
        }

        try {
            // Load JsonMapping
            const mappingContent = fs.readFileSync(mappingPath, 'utf8');
            const jsonMapping: EnhancedJsonMapping = JSON.parse(mappingContent);

            if (!jsonMapping.typeInfo) {
                return {
                    isValid: false,
                    errors: ['No typeInfo specified in JsonMapping. Add typeInfo with interface and importPath.'],
                    details: null
                };
            }

            if (this.options.debug) {
                console.log(`🔍 Validating ${mappingFileName}:`);
                console.log(`   Interface: ${jsonMapping.typeInfo.interface}`);
                console.log(`   Import: ${jsonMapping.typeInfo.importPath}`);
            }

            // Validate using AutoTypeCompatibilityValidator
            const result = await this.validator.validateMapping(jsonMapping);

            return {
                isValid: result.isValid,
                errors: result.errors,
                details: {
                    missingProperties: result.missingProperties,
                    extraProperties: result.extraProperties,
                    typeConflicts: result.typeConflicts
                }
            };

        } catch (error) {
            return {
                isValid: false,
                errors: [`Failed to process JsonMapping: ${error instanceof Error ? error.message : String(error)}`],
                details: null
            };
        }
    }

    /**
     * Validate all JsonMapping files in the mapping directory
     * 
     * @returns Promise<{ [fileName: string]: ValidationResult }>
     */
    public async validateAllMappingFiles() {
        const mappingDir = this.options.mappingDir!;

        if (!fs.existsSync(mappingDir)) {
            return {
                error: `Mapping directory not found: ${mappingDir}`
            };
        }

        const files = fs.readdirSync(mappingDir);
        const jsonFiles = files.filter(file => file.endsWith('.json'));

        const results: { [fileName: string]: any } = {};

        for (const jsonFile of jsonFiles) {
            if (this.options.debug) {
                console.log(`\n📄 Processing ${jsonFile}...`);
            }

            results[jsonFile] = await this.validateMappingFile(jsonFile);
        }

        return results;
    }

    /**
     * Generate a vitest test case for a specific JsonMapping file
     * 
     * Usage in test files:
     * ```typescript
     * const tester = new DomainModelCompatibilityTester({ debug: true });
     * 
     * it('should validate getTodoDetail JsonMapping compatibility', async () => {
     *     await tester.generateTestCase('getTodoDetail.json');
     * });
     * ```
     */
    public async generateTestCase(mappingFileName: string) {
        const result = await this.validateMappingFile(mappingFileName);

        // Use expect from vitest/jest
        const { expect } = await import('vitest');

        expect(result.isValid).toBe(true);

        if (result.errors.length > 0) {
            expect.fail(`JsonMapping compatibility validation failed for ${mappingFileName}:\n${result.errors.join('\n')}`);
        }

        if (result.details) {
            expect(result.details.missingProperties).toHaveLength(0);
            expect(result.details.extraProperties).toHaveLength(0);
            expect(result.details.typeConflicts).toHaveLength(0);
        }

        // Return result for additional assertions if needed
        return result;
    }

    /**
     * Create a comprehensive test suite for all JsonMapping files
     * 
     * Usage:
     * ```typescript
     * describe('Domain Model Compatibility Tests', () => {
     *     const tester = new DomainModelCompatibilityTester();
     *     tester.createTestSuite();
     * });
     * ```
     */
    public createTestSuite() {
        const { describe, it } = require('vitest');
        const mappingDir = this.options.mappingDir!;

        describe('Auto-generated JsonMapping Compatibility Tests', () => {
            if (!fs.existsSync(mappingDir)) {
                it('should find mapping directory', () => {
                    throw new Error(`Mapping directory not found: ${mappingDir}`);
                });
                return;
            }

            const files = fs.readdirSync(mappingDir);
            const jsonFiles = files.filter(file => file.endsWith('.json'));

            if (jsonFiles.length === 0) {
                it('should find JsonMapping files', () => {
                    throw new Error(`No .json files found in ${mappingDir}`);
                });
                return;
            }

            for (const jsonFile of jsonFiles) {
                it(`should validate ${jsonFile} compatibility with TypeScript interface`, async () => {
                    await this.generateTestCase(jsonFile);
                });
            }
        });
    }
}

/**
 * Convenience function for quick validation in tests
 * 
 * Usage:
 * ```typescript
 * import { validateJsonMappingCompatibility } from './DomainModelCompatibilityTester';
 * 
 * it('should validate getTodoDetail compatibility', async () => {
 *     await validateJsonMappingCompatibility('getTodoDetail.json');
 * });
 * ```
 */
export async function validateJsonMappingCompatibility(
    mappingFileName: string,
    options: TestValidationOptions = {}
) {
    const tester = new DomainModelCompatibilityTester(options);
    return await tester.generateTestCase(mappingFileName);
}
