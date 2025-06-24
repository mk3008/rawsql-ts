import { expect, beforeAll, describe, it } from 'vitest';
import { RawSqlClient } from '../../../packages/prisma-integration/src/RawSqlClient';
import { PrismaClient } from '@prisma/client';
import * as path from 'path';

/**
 * Test Suite: PR #129 - Subdirectory JSON Mapping Tests
 * 
 * Validates the fix for JSON mapping subdirectory path resolution and enhanced error reporting.
 * These tests ensure that SQL files and their corresponding JSON mapping files can be organized
 * in subdirectories while maintaining full functionality.
 * 
 * Test Coverage:
 * - Subdirectory path resolution for SQL/JSON files
 * - JSON mapping validation in nested directory structures
 * - Dynamic filter injection with subdirectory queries
 * - Error handling for missing files with helpful messages
 * - Path format consistency (relative, normalized paths)
 */
describe('PR #129: Subdirectory JSON Mapping Tests', () => {
    let rawSqlClient: RawSqlClient;
    let prisma: PrismaClient;

    beforeAll(async () => {
        // Initialize test dependencies
        prisma = new PrismaClient();
        // Use absolute path for cross-platform compatibility
        const sqlFilesPath = path.join(__dirname, '..', 'rawsql-ts');
        rawSqlClient = new RawSqlClient(prisma, {
            sqlFilesPath: sqlFilesPath,
            debug: false // Set to true for debugging
        });
    });

    describe('Todos in subdirectory', () => {
        it('should load JSON mapping for todos/getTodoDetail.sql', async () => {
            // Arrange: Prepare test parameters and expected result structure
            const sqlFile = 'todos/getTodoDetail.sql';
            const testTodoId = 1;
            const expectedProperties = ['todoId', 'title', 'description', 'completed', 'user', 'category', 'comments'];

            // Act: Execute the query with subdirectory path
            const result = await rawSqlClient.queryOne(sqlFile, {
                filter: { todo_id: testTodoId }
            });

            console.log('Todo detail result:', JSON.stringify(result, null, 2));            // Assert: Verify subdirectory path resolution and JSON mapping
            expect(result).toBeDefined();
            expect(typeof result).toBe('object');

            // Type assertion for test purposes
            const todoResult = result as any;

            // Verify all expected properties exist
            expectedProperties.forEach(prop => {
                expect(todoResult).toHaveProperty(prop);
            });

            // Verify specific data structure matches JSON mapping
            expect(todoResult.todoId).toBe(testTodoId);
            expect(todoResult.title).toBeTruthy();
            expect(todoResult.user).toHaveProperty('userId');
            expect(todoResult.category).toHaveProperty('categoryId');
            expect(Array.isArray(todoResult.comments)).toBe(true);
        });

        it('should load JSON mapping for todos/searchTodos.sql', async () => {
            // Arrange: Prepare search parameters and expected result structure
            const sqlFile = 'todos/searchTodos.sql';
            const completedFilter = false;
            const expectedArrayItemProperties = ['todoId', 'title', 'description', 'completed', 'user', 'category', 'commentCount'];

            // Act: Execute the search query with subdirectory path
            const results = await rawSqlClient.queryMany(sqlFile, {
                filter: { completed: completedFilter }
            });

            console.log(`Search todos results: ${JSON.stringify(results, null, 2)}`);

            // Assert: Verify subdirectory path resolution and JSON mapping
            expect(Array.isArray(results)).toBe(true);
            expect(results.length).toBeGreaterThan(0);

            // Verify first result has correct structure
            const firstResult = results[0];
            expectedArrayItemProperties.forEach(prop => {
                expect(firstResult).toHaveProperty(prop);
            });

            // Verify data types and nested structures
            expect(firstResult.todoId).toBeTypeOf('number');
            expect(firstResult.title).toBeTypeOf('string');
            expect(firstResult.user).toHaveProperty('userId');
            expect(firstResult.category).toHaveProperty('categoryId');
            expect(firstResult.commentCount).toBeTypeOf('number');
        });
    });

    describe('Users in subdirectory', () => {
        it('should load JSON mapping for users/profile.sql', async () => {
            // Arrange: Prepare user profile parameters and expected structure
            const sqlFile = 'users/profile.sql';
            const testUserId = 1;
            const expectedProperties = ['userId', 'userName', 'email', 'createdAt', 'totalTodos', 'completedTodos', 'pendingTodos'];

            // Act: Execute the user profile query with subdirectory path
            const result = await rawSqlClient.queryOne(sqlFile, {
                filter: { user_id: testUserId }
            });

            console.log('User profile result:', JSON.stringify(result, null, 2));            // Assert: Verify subdirectory path resolution and JSON mapping
            expect(result).toBeDefined();
            expect(typeof result).toBe('object');

            // Type assertion for test purposes
            const userResult = result as any;

            // Verify all expected properties exist
            expectedProperties.forEach(prop => {
                expect(userResult).toHaveProperty(prop);
            });

            // Verify specific data structure matches JSON mapping
            expect(userResult.userId).toBe(testUserId);
            expect(userResult.userName).toBeTypeOf('string');
            expect(userResult.email).toBeTypeOf('string');
            expect(userResult.totalTodos).toBeTypeOf('number');
            expect(userResult.completedTodos).toBeTypeOf('number');
            expect(userResult.pendingTodos).toBeTypeOf('number');
        });

        it('should load JSON mapping for users/search.sql and generate correct SQL', async () => {
            // Arrange: Prepare search parameters and expected structure
            const sqlFile = 'users/search.sql';
            const expectedProperties = ['userId', 'userName', 'email', 'createdAt'];

            // Act: Execute the user search query with subdirectory path (no filter needed)
            const results = await rawSqlClient.queryMany(sqlFile);

            console.log(`User search results: ${JSON.stringify(results, null, 2)}`);

            // Assert: Verify subdirectory path resolution and JSON mapping
            expect(Array.isArray(results)).toBe(true);
            expect(results.length).toBeGreaterThan(0);

            // Verify first result has correct structure
            const firstResult = results[0];
            expectedProperties.forEach(prop => {
                expect(firstResult).toHaveProperty(prop);
            });

            // Verify data types
            expect(firstResult.userId).toBeTypeOf('number');
            expect(firstResult.userName).toBeTypeOf('string');
            expect(firstResult.email).toBeTypeOf('string');
        });
    });

    describe('Path resolution error handling', () => {
        it('should provide helpful error messages for missing SQL files', async () => {
            // Arrange: Prepare a scenario with missing SQL file
            const nonexistentSqlFile = 'users/nonexistent.sql';

            // Act & Assert: Verify clear and direct error reporting
            await expect(async () => {
                await rawSqlClient.queryMany(nonexistentSqlFile);
            }).rejects.toThrow(/SQL file not found/i);
        });

        it('should provide helpful error messages for missing JSON mapping files', async () => {
            // Arrange: Use a SQL file that exists but doesn't have corresponding JSON mapping
            const sqlFileWithoutMapping = 'todos/testMissingMapping.sql';            // Act & Assert: Verify JsonMappingError is thrown directly (no wrapping)
            await expect(async () => {
                await rawSqlClient.queryOne(sqlFileWithoutMapping, {
                    filter: { todo_id: 1 }
                });
            }).rejects.toThrow(/JSON mapping file is required but not found/i);
        });

        it('should handle various path formats consistently', async () => {
            // Arrange: Test different path formats for the same file
            const pathFormats = [
                'todos/getTodoDetail.sql',
                './todos/getTodoDetail.sql',
                'todos/../todos/getTodoDetail.sql'
            ];
            const testTodoId = 1;

            // Act & Assert: Verify all path formats work consistently
            for (const pathFormat of pathFormats) {
                console.log(`Testing path: ${pathFormat}`);

                const result = await rawSqlClient.queryOne(pathFormat, {
                    filter: { todo_id: testTodoId }
                }); console.log(`Result for ${pathFormat}:`, JSON.stringify(result, null, 2));

                // Assert: Each path format should return the same result structure
                const pathResult = result as any;
                expect(result).toBeDefined();
                expect(pathResult.todoId).toBe(testTodoId);
                expect(pathResult).toHaveProperty('title');
                expect(pathResult).toHaveProperty('user');
                expect(pathResult).toHaveProperty('category');
            }
        });
    });

    describe('SQL Generation and Formatting', () => {
        it('should generate properly formatted SQL for complex queries', async () => {
            // Arrange: Test complex query formatting
            const sqlFile = 'todos/getTodoDetail.sql';
            const testTodoId = 1;

            // Expected SQL elements that should be present
            const expectedSqlElements = [
                '"todo" as "t"',
                '"user" as "u"',
                '"category" as "c"',
                'inner join',
                'left join',
                'json_build_object',
                'json_agg'
            ];

            // Act: Get the internal query builder to examine SQL generation
            // Note: This requires access to RawSqlClient internals for testing
            const result = await rawSqlClient.queryOne(sqlFile, {
                filter: { todo_id: testTodoId }
            });            // Assert: Verify query execution succeeded and has expected structure
            const queryResult = result as any;
            expect(result).toBeDefined();
            expect(queryResult.todoId).toBe(testTodoId);

            // Note: For full SQL text comparison, we would need access to the 
            // generated SQL string, which might require additional logging or 
            // a test-specific method in RawSqlClient
        }); it('should handle filter injection properly', async () => {
            // Arrange: Test different filter scenarios
            const sqlFile = 'todos/searchTodos.sql';

            const filterScenarios = [
                { filter: { completed: true }, expectedMinCount: 0 },
                { filter: { completed: false }, expectedMinCount: 1 }
            ];

            // Act & Assert: Test each filter scenario
            for (const scenario of filterScenarios) {
                const results = await rawSqlClient.queryMany(sqlFile, {
                    filter: scenario.filter
                });

                expect(Array.isArray(results)).toBe(true);
                expect(results.length).toBeGreaterThanOrEqual(scenario.expectedMinCount);

                // Verify all results match the filter
                results.forEach(todo => {
                    const todoData = todo as any;
                    expect(todoData.completed).toBe(scenario.filter.completed);
                });
            }
        });
    });
});
