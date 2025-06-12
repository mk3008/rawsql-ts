/**
 * Test runner for TODO search functionality
 * This will be used to compare different implementation approaches
 */

import { PrismaClient } from '@prisma/client';
import { PrismaTodoSearchService } from '../services/prisma-todo-search.service';
import { RawSqlTodoSearchService } from '../services/rawsql-todo-search.service';
import { TodoSearchParams } from '../contracts';
import { addTestResultWithDefaults } from './types';
import { cleanSqlForDisplay } from './index';

const prisma = new PrismaClient({
    log: ['query', 'info', 'warn', 'error'],
});

/**
 * Test cases for TODO search
 */
const testCases: Array<{
    name: string;
    params: TodoSearchParams;
}> = [
        {
            name: 'Search all todos (first page)',
            params: {
                conditions: {},
                pagination: { offset: 0, limit: 5 },
            },
        },
        {
            name: 'Search by title "project"',
            params: {
                conditions: { title: 'project' },
                pagination: { offset: 0, limit: 10 },
            },
        },
        {
            name: 'Search completed todos only',
            params: {
                conditions: { completed: true },
                pagination: { offset: 0, limit: 10 },
            },
        },
        {
            name: 'Search by user name "Alice"',
            params: {
                conditions: { userName: 'Alice' },
                pagination: { offset: 0, limit: 10 },
            },
        },
        {
            name: 'Search Work category',
            params: {
                conditions: { categoryId: 1 }, // Assuming Work is ID 1
                pagination: { offset: 0, limit: 10 },
            },
        },
        {
            name: 'Search by color (blue)',
            params: {
                conditions: { color: '#3b82f6' },
                pagination: { offset: 0, limit: 10 },
            },
        },
        {
            name: 'Complex search: incomplete work todos',
            params: {
                conditions: {
                    completed: false,
                    categoryId: 1,
                },
                pagination: { offset: 0, limit: 10 },
            },
        },
    ];



/**
 * Test Prisma ORM implementation
 */
async function testPrismaSearchImplementation() {
    console.log('🔍 Testing Prisma ORM Todo Search Implementation');
    console.log('='.repeat(60));

    const service = new PrismaTodoSearchService(prisma);

    for (const testCase of testCases) {
        console.log(`\n📋 Test: ${testCase.name}`);
        console.log('-'.repeat(40)); try {
            // Execute test once for functionality verification
            const result = await service.searchTodos(testCase.params);

            console.log(`✅ Found ${result.result.items.length} todos`);
            console.log(`🗄️  Has more: ${result.result.pagination.hasMore}`);

            // Store test result for analysis (speed metrics removed)
            addTestResultWithDefaults({
                implementation: 'Prisma ORM',
                testType: 'search',
                testName: testCase.name,
                success: true,
                resultCount: result.result.items.length,
                sqlQueries: result.metrics.sqlQueries // Use captured SQL queries from metrics
            });

            // Show first few results
            result.result.items.slice(0, 3).forEach((item: any, index: number) => {
                console.log(`   ${index + 1}. "${item.title}" by ${item.user.userName} (${item.category.categoryName}) [${item.commentCount} comments]`);
            });
            if (result.result.items.length > 3) {
                console.log(`   ... and ${result.result.items.length - 3} more`);
            }

            // Show SQL queries (truncated)
            const cleanedSql = cleanSqlForDisplay(result.metrics.sqlQueries);
            const sqlPreview = result.metrics.sqlQueries.length > 1
                ? `${cleanedSql.substring(0, 100)}... (${result.metrics.sqlQueries.length} queries)`
                : cleanedSql.length > 200
                    ? cleanedSql.substring(0, 200) + '...'
                    : cleanedSql;
            console.log(`🗄️  SQL: ${sqlPreview}`);

        } catch (error) {
            console.error(`❌ Error in test "${testCase.name}":`, error);

            // Store failed test result (speed metrics removed)
            addTestResultWithDefaults({
                implementation: 'Prisma ORM',
                testType: 'search',
                testName: testCase.name,
                success: false,
                resultCount: 0,
                sqlQueries: [] // No SQL queries for failed tests
            });
        }
    }
}

/**
 * Test rawsql-ts implementation
 */
async function testRawSqlSearchImplementation() {
    console.log('\n🔍 Testing rawsql-ts Todo Search Implementation');
    console.log('='.repeat(60));

    const service = new RawSqlTodoSearchService(prisma, { debug: false });

    try {
        // Initialize the PrismaReader
        await service.initialize();
        console.log('✅ rawsql-ts PrismaReader initialized successfully');
    } catch (error) {
        console.error('❌ Failed to initialize rawsql-ts PrismaReader:', error);
        return;
    }

    for (const testCase of testCases) {
        console.log(`\n📋 Test: ${testCase.name}`);
        console.log('-'.repeat(40)); try {
            // Execute test once for functionality verification
            const result = await service.searchTodos(testCase.params);

            console.log(`✅ Found ${result.result.items.length} todos`);
            console.log(`🗄️  Has more: ${result.result.pagination.hasMore}`);

            // Store test result for analysis (speed metrics removed)
            addTestResultWithDefaults({
                implementation: 'rawsql-ts',
                testType: 'search',
                testName: testCase.name,
                success: true,
                resultCount: result.result.items.length,
                sqlQueries: result.metrics.sqlQueries // Use captured SQL queries from metrics
            });

            // Show first few results
            result.result.items.slice(0, 3).forEach((item: any, index: number) => {
                console.log(`   ${index + 1}. "${item.title}" by ${item.user.userName} (${item.category.categoryName}) [${item.commentCount} comments]`);
            });
            if (result.result.items.length > 3) {
                console.log(`   ... and ${result.result.items.length - 3} more`);
            }

            // Show SQL queries (truncated)
            const cleanedSql = cleanSqlForDisplay(result.metrics.sqlQueries);
            const sqlPreview = cleanedSql.length > 200
                ? cleanedSql.substring(0, 200) + '...'
                : cleanedSql;
            console.log(`🗄️  SQL: ${sqlPreview}`);

        } catch (error) {
            console.error(`❌ Error in test "${testCase.name}":`, error);

            // Store failed test result (speed metrics removed)
            addTestResultWithDefaults({
                implementation: 'rawsql-ts',
                testType: 'search',
                testName: testCase.name,
                success: false,
                resultCount: 0,
                sqlQueries: [] // No SQL queries for failed tests
            });
        }
    }
}

/**
 * Main test runner
 */
async function main() {
    try {
        await testPrismaSearchImplementation();
        await testRawSqlSearchImplementation();
    } catch (error) {
        console.error('❌ Test runner failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

// Run tests if this file is executed directly
if (require.main === module) {
    main();
}

// Export main function for use in other modules
export { main as runSearchTests };
