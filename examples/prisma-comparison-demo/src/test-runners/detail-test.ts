/**
 * Test runner for TODO detail functionality
 * This will be used to compare different implementation approaches
 */

import { PrismaClient } from '@prisma/client';
import { PrismaTodoDetailService } from '../services/prisma-todo-detail.service';
import { RawSqlTodoDetailService } from '../services/rawsql-todo-detail.service';
import { addTestResultWithDefaults } from './types';
import { cleanSqlForDisplay } from './index';

const prisma = new PrismaClient({
    log: ['query', 'info', 'warn', 'error'],
});

/**
 * Test cases for TODO detail retrieval
 */
const testCases: Array<{
    name: string;
    todoId: number;
}> = [
        {
            name: 'Get TODO with multiple comments',
            todoId: 1, // "Complete project proposal" - should have 3 comments
        },
        {
            name: 'Get TODO with few comments',
            todoId: 4, // "Code review for feature X" - should have 2 comments
        },
        {
            name: 'Get TODO with no comments',
            todoId: 2, // "Buy groceries" - should have 0 comments
        },
        {
            name: 'Get non-existent TODO',
            todoId: 999, // Should return null
        },
    ];

/**
 * Test Prisma ORM implementation
 */
async function testPrismaDetailImplementation() {
    console.log('🔍 Testing Prisma ORM Todo Detail Implementation');
    console.log('='.repeat(60));

    const service = new PrismaTodoDetailService(prisma);

    for (const testCase of testCases) {
        console.log(`\n📋 Test: ${testCase.name} (ID: ${testCase.todoId})`);
        console.log('-'.repeat(40)); try {
            const result = await service.getTodoDetail(testCase.todoId);

            // Store test result for summary
            addTestResultWithDefaults({
                implementation: 'Prisma ORM',
                testType: 'detail',
                testName: testCase.name,
                success: true, // Success means no error occurred, regardless of whether result was found
                resultCount: result.result ? 1 : 0,
                sqlQueries: result.metrics.sqlQueries
            });

            if (result.result) {
                const todo = result.result;
                console.log(`✅ Found TODO: "${todo.title}"`);
                console.log(`   📝 Description: ${todo.description || 'No description'}`);
                console.log(`   ✅ Completed: ${todo.completed ? 'Yes' : 'No'}`);
                console.log(`   👤 User: ${todo.user.userName} (${todo.user.email})`);
                console.log(`   🏷️  Category: ${todo.category.categoryName} (${todo.category.color || 'No color'})`);
                console.log(`   📅 Created: ${todo.createdAt.toISOString()}`);
                console.log(`   📝 Comments (${todo.comments.length}):`);

                if (todo.comments.length > 0) {
                    todo.comments.forEach((comment, index) => {
                        const preview = comment.commentText.length > 50
                            ? comment.commentText.substring(0, 50) + '...'
                            : comment.commentText;
                        console.log(`      ${index + 1}. ${comment.user.userName}: "${preview}"`);
                    });
                } else {
                    console.log('      (No comments)');
                }
            } else {
                console.log('❌ TODO not found');
            }            // Show SQL queries (truncated)
            const cleanedSql = cleanSqlForDisplay(result.metrics.sqlQueries);
            const sqlPreview = result.metrics.sqlQueries.length > 1
                ? `${cleanedSql.substring(0, 100)}... (${result.metrics.sqlQueries.length} queries)`
                : cleanedSql.length > 200
                    ? cleanedSql.substring(0, 200) + '...'
                    : cleanedSql;
            console.log(`🗄️  SQL: ${sqlPreview}`);

        } catch (error) {
            console.error(`❌ Error in test "${testCase.name}":`, error);

            // Store failed test result
            addTestResultWithDefaults({
                implementation: 'Prisma ORM',
                testType: 'detail',
                testName: testCase.name,
                success: false,
                resultCount: 0,
                sqlQueries: []
            });
        }
    }
}

/**
 * Test rawsql-ts implementation
 */
async function testRawSqlDetailImplementation() {
    console.log('\n🔍 Testing rawsql-ts Todo Detail Implementation');
    console.log('='.repeat(60));

    const service = new RawSqlTodoDetailService(prisma, { debug: false });

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
            const result = await service.getTodoDetail(testCase.todoId);

            // Store test result for summary
            addTestResultWithDefaults({
                implementation: 'rawsql-ts',
                testType: 'detail',
                testName: testCase.name,
                success: true, // Success means no error occurred, regardless of whether result was found
                resultCount: result.result ? 1 : 0,
                sqlQueries: result.metrics.sqlQueries
            });

            if (result.result) {
                const todo = result.result;
                console.log(`✅ Found TODO: "${todo.title}"`);
                console.log(`   📝 Description: ${todo.description}`);
                console.log(`   ✅ Completed: ${todo.completed ? 'Yes' : 'No'}`);
                console.log(`   👤 User: ${todo.user.userName} (${todo.user.email})`);
                console.log(`   🏷️  Category: ${todo.category.categoryName} (${todo.category.color})`);
                console.log(`   📅 Created: ${todo.createdAt}`);
                console.log(`   📝 Comments (${todo.comments.length}):`);

                todo.comments.forEach((comment: any, index: number) => {
                    const commentPreview = comment.commentText.length > 50
                        ? comment.commentText.substring(0, 50) + '...'
                        : comment.commentText;
                    console.log(`      ${index + 1}. ${comment.user.userName}: "${commentPreview}"`);
                });

                if (todo.comments.length === 0) {
                    console.log('      (No comments)');
                }
            } else {
                console.log('❌ TODO not found');
            }

            // Show SQL queries (truncated)
            const cleanedSql = cleanSqlForDisplay(result.metrics.sqlQueries);
            const sqlPreview = cleanedSql.length > 200
                ? cleanedSql.substring(0, 200) + '...'
                : cleanedSql;
            console.log(`🗄️  SQL: ${sqlPreview}`);

        } catch (error) {
            console.error(`❌ Error in test "${testCase.name}":`, error);

            // Store failed test result
            addTestResultWithDefaults({
                implementation: 'rawsql-ts',
                testType: 'detail',
                testName: testCase.name,
                success: false,
                resultCount: 0,
                sqlQueries: []
            });
        }
    }
}

/**
 * Main test runner
 */
async function main() {
    try {
        await testPrismaDetailImplementation();
        await testRawSqlDetailImplementation();
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
export { main as runDetailTests };
