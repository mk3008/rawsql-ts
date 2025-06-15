/**
 * SQL Static Analysis Tests
 * 
 * This test suite validates SQL files in the rawsql-ts folder using rawsql-ts SqlSchemaValidator
 * and Prisma schema information through PrismaSchemaResolver.
 * 
 * Test Structure: AAA (Arrange, Act, Assert)
 * Framework: vitest
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { PrismaSchemaResolver } from '../../../packages/prisma-integration/src/PrismaSchemaResolver';
import { SqlSchemaValidator } from '../../../packages/core/src/utils/SqlSchemaValidator';
import { SelectQueryParser } from '../../../packages/core/src/parsers/SelectQueryParser';
import { PostgresJsonQueryBuilder, JsonMapping, QueryBuilder } from '../../../packages/core/src';
import * as fs from 'fs';
import * as path from 'path';

describe('SQL Static Analysis Tests', () => {
    let prismaSchemaResolver: PrismaSchemaResolver;
    let tableColumnResolver: (tableName: string) => string[];

    beforeAll(async () => {
        // Arrange: Initialize Prisma schema resolver
        const prismaClient = new PrismaClient();
        prismaSchemaResolver = new PrismaSchemaResolver({
            defaultSchema: 'public',
            debug: true
        });

        // Resolve schema information from Prisma
        await prismaSchemaResolver.resolveSchema(prismaClient);

        // Create table column resolver for SqlSchemaValidator
        tableColumnResolver = prismaSchemaResolver.createTableColumnResolver();

        // Disconnect Prisma client
        await prismaClient.$disconnect();
    });

    describe('SQL File Discovery', () => {
        it('should find SQL files in rawsql-ts folder', () => {
            // Arrange: Get rawsql-ts directory path
            const rawsqlTsDir = path.join(__dirname, '..', 'rawsql-ts');

            // Act: Scan for SQL files
            const files = fs.readdirSync(rawsqlTsDir);
            const sqlFiles = files.filter(file => file.endsWith('.sql'));

            // Assert: SQL files should be discovered
            expect(sqlFiles).toBeDefined();
            expect(sqlFiles.length).toBeGreaterThan(0);

            console.log(`📄 Found ${sqlFiles.length} SQL files:`, sqlFiles);
        });
    });

    describe('Schema Validation', () => {
        it('should have valid Prisma schema resolver', () => {
            // Assert: Schema resolver should be properly initialized
            expect(prismaSchemaResolver).toBeDefined();
            expect(tableColumnResolver).toBeDefined();
            expect(typeof tableColumnResolver).toBe('function');
        });

        it('should detect available tables from schema', () => {
            // Arrange: Get table names from schema
            const tableNames = prismaSchemaResolver.getTableNames();

            // Assert: Should have expected tables
            expect(tableNames).toBeDefined();
            expect(tableNames.length).toBeGreaterThan(0);

            console.log(`🏗️  Available tables: ${tableNames.join(', ')}`);
        });
    });

    describe('SQL File Validation', () => {
        it('should validate all SQL files in rawsql-ts folder', () => {
            // Arrange: Get all SQL files from rawsql-ts directory
            const rawsqlTsDir = path.join(__dirname, '..', 'rawsql-ts');
            const files = fs.readdirSync(rawsqlTsDir);
            const sqlFiles = files.filter(file => file.endsWith('.sql'));

            // Assert: Should have SQL files to test
            expect(sqlFiles.length).toBeGreaterThan(0);

            // Act & Assert: Validate each SQL file
            sqlFiles.forEach(filename => {
                console.log(`\n🔍 Validating ${filename}...`);

                // Arrange: Read SQL file content
                const sqlPath = path.join(rawsqlTsDir, filename);
                expect(fs.existsSync(sqlPath)).toBe(true);

                const content = fs.readFileSync(sqlPath, 'utf-8');

                // Act: Parse SQL (no preprocessing needed for 1 file = 1 SQL)
                const parseResult = SelectQueryParser.parse(content);

                // Assert: Should parse successfully
                expect(parseResult).toBeDefined();

                // Act: Validate schema
                expect(() => {
                    SqlSchemaValidator.validate(parseResult, tableColumnResolver);
                }).not.toThrow();

                console.log(`✅ ${filename}: Validation passed`);
            });

            console.log(`\n🎉 All ${sqlFiles.length} SQL files validated successfully!`);
        });
    });

    describe('SQL + JSON Mapping Serialization Tests', () => {
        it('should validate SQL with JSON mapping when available', () => {
            // Arrange: Get all SQL files from rawsql-ts directory
            const rawsqlTsDir = path.join(__dirname, '..', 'rawsql-ts');
            const files = fs.readdirSync(rawsqlTsDir);
            const sqlFiles = files.filter(file => file.endsWith('.sql'));

            // Assert: Should have SQL files to test
            expect(sqlFiles.length).toBeGreaterThan(0);

            // Act & Assert: Check each SQL file for corresponding JSON mapping
            sqlFiles.forEach(sqlFilename => {
                const baseName = path.basename(sqlFilename, '.sql');
                const jsonFilename = `${baseName}.json`;
                const jsonPath = path.join(rawsqlTsDir, jsonFilename);

                console.log(`\n🔍 Checking ${sqlFilename} for JSON mapping...`);

                if (fs.existsSync(jsonPath)) {
                    console.log(`✅ Found JSON mapping: ${jsonFilename}`);

                    // Arrange: Read SQL and JSON files
                    const sqlPath = path.join(rawsqlTsDir, sqlFilename);
                    const sqlContent = fs.readFileSync(sqlPath, 'utf-8');
                    const jsonContent = fs.readFileSync(jsonPath, 'utf-8');

                    // Act: Parse SQL
                    const parseResult = SelectQueryParser.parse(sqlContent);
                    expect(parseResult).toBeDefined();

                    // Act: Parse JSON mapping
                    let jsonMapping: JsonMapping;
                    expect(() => {
                        jsonMapping = JSON.parse(jsonContent);
                    }).not.toThrow();                    // Assert: JSON mapping should have required structure
                    expect(jsonMapping!.rootName).toBeDefined();
                    expect(jsonMapping!.rootEntity).toBeDefined();
                    expect(jsonMapping!.rootEntity.columns).toBeDefined();

                    // Act: Build JSON query using PostgresJsonQueryBuilder
                    // Now supports any SelectQuery type (automatically converts internally)
                    const jsonQueryBuilder = new PostgresJsonQueryBuilder();
                    let jsonQuery: any;
                    expect(() => {
                        jsonQuery = jsonQueryBuilder.buildJsonQuery(parseResult, jsonMapping!);
                    }).not.toThrow();

                    // Assert: JSON query should be built successfully
                    expect(jsonQuery).toBeDefined();

                    console.log(`🎯 ${sqlFilename}: SQL + JSON mapping validation passed`);
                } else {
                    console.log(`⚠️  No JSON mapping found for ${sqlFilename} - ignoring serialization test`);
                }
            });

            console.log(`\n🎉 SQL + JSON mapping validation completed!`);
        });
    });
});
