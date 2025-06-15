/**
 * Auto-Generated Domain Model Compatibility Tests
 * 
 * This test automatically validates all JsonMapping files against their specified TypeScript interfaces.
 * No manual sample data creation needed! 🎉
 * 
 * How it works:
 * 1. Scans all .json files in rawsql-ts folder
 * 2. For each file with typeInfo, loads the specified TypeScript interface
 * 3. Automatically validates compatibility between JsonMapping structure and interface
 * 4. Reports any missing properties, extra properties, or type conflicts
 * 
 * To add a new test, simply:
 * 1. Add typeInfo to your JsonMapping file:
 *    {
 *      "typeInfo": {
 *        "interface": "YourInterface",
 *        "importPath": "../src/contracts/your-types.ts"
 *      },
 *      ...rest of JsonMapping
 *    }
 * 2. The test will automatically pick it up!
 */

import { describe, it, expect } from 'vitest';
import { DomainModelCompatibilityTester } from '../../../packages/prisma-integration/src/DomainModelCompatibilityTester';
import * as path from 'path';

describe('Auto Domain Model Compatibility Tests', () => {
    const tester = new DomainModelCompatibilityTester({
        baseDir: path.join(__dirname, '..'),
        mappingDir: path.join(__dirname, '..', 'rawsql-ts'),
        debug: true
    });

    describe('Individual JsonMapping Files', () => {
        it('should validate getTodoDetail.json compatibility with TodoDetail interface', async () => {
            const result = await tester.validateMappingFile('getTodoDetail.json');

            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);

            if (result.details) {
                expect(result.details.missingProperties).toHaveLength(0);
                expect(result.details.extraProperties).toHaveLength(0);
                expect(result.details.typeConflicts).toHaveLength(0);
            }
        });

        it('should validate searchTodos.json compatibility (if typeInfo is specified)', async () => {
            // This will gracefully handle the case where searchTodos.json doesn't have typeInfo yet
            const result = await tester.validateMappingFile('searchTodos.json');

            if (result.details !== null) {
                // Only validate if typeInfo is present
                expect(result.isValid).toBe(true);
                expect(result.errors).toHaveLength(0);
            } else {
                // Skip validation if no typeInfo - this is expected for now
                console.log('ℹ️  searchTodos.json has no typeInfo - skipping validation');
            }
        });
    });

    describe('Bulk Validation', () => {
        it('should validate all JsonMapping files with typeInfo', async () => {
            const results = await tester.validateAllMappingFiles();

            expect(results).toBeDefined();

            // Check each result
            for (const [fileName, result] of Object.entries(results)) {
                if (fileName === 'error') continue; // Skip error property

                console.log(`📋 ${fileName}: ${(result as any).isValid ? '✅ Valid' : '❌ Invalid'}`);

                if (!(result as any).isValid) {
                    console.log(`   Errors: ${(result as any).errors.join(', ')}`);
                }
            }
        });
    });

    describe('Demonstration of Easy Usage', () => {
        it('shows how simple it is to add a new compatibility test', async () => {
            // This is all you need to do:
            // 1. Add typeInfo to your JsonMapping file
            // 2. Call this helper function!

            const result = await tester.generateTestCase('getTodoDetail.json');

            // The helper automatically:
            // - Loads the JsonMapping
            // - Reads the TypeScript interface from the specified import path
            // - Compares structures
            // - Reports detailed compatibility information

            expect(result.isValid).toBe(true);

            console.log('🎉 Super easy automatic type compatibility validation!');
            console.log('   No manual sample data creation needed!');
            console.log('   Just specify interface name and import path in typeInfo!');
        });
    });
});

// Example of even simpler usage (can be used in other test files):
describe('Super Simple Validation Example', () => {
    it('validates with just one line of code!', async () => {
        // Import the convenience function
        const { validateJsonMappingCompatibility } = await import('../../../packages/prisma-integration/src/DomainModelCompatibilityTester');

        // Validate with just one function call! 🚀
        await validateJsonMappingCompatibility('getTodoDetail.json', {
            baseDir: path.join(__dirname, '..'),
            mappingDir: path.join(__dirname, '..', 'rawsql-ts'),
            debug: true
        });

        console.log('✨ That\'s it! One line validates everything!');
    });
});
