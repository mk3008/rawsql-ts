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
 * Statistics calculation helpers
 */
interface PerformanceStats {
    mean: number;
    stdDev: number;
    standardError: number;
    min: number;
    max: number;
    iterations: number;
}

function calculateStats(measurements: number[]): PerformanceStats {
    const n = measurements.length;
    const mean = measurements.reduce((sum, val) => sum + val, 0) / n;
    const variance = measurements.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / (n - 1);
    const stdDev = Math.sqrt(variance);
    const standardError = stdDev / Math.sqrt(n);

    return {
        mean: Number(mean.toFixed(2)),
        stdDev: Number(stdDev.toFixed(2)),
        standardError: Number(standardError.toFixed(2)),
        min: Math.min(...measurements),
        max: Math.max(...measurements),
        iterations: n
    };
}

/**
 * Test Prisma ORM implementation
 */
async function testPrismaSearchImplementation() {
    console.log('🔍 Testing Prisma ORM Todo Search Implementation');
    console.log('='.repeat(60));

    const service = new PrismaTodoSearchService(prisma); for (const testCase of testCases) {
        console.log(`\n📋 Test: ${testCase.name}`);
        console.log('-'.repeat(40));

        try {
            // Performance measurement with warm-up and multiple runs
            const warmupRuns = 2;
            const measurementRuns = 5;
            const executionTimes: number[] = [];
            let finalResult: any;
            let totalResponseSize = 0;
            let totalQueryCount = 0;
            let sqlQuery = '';

            // Warm-up runs (ignored for performance measurement)
            console.log('🔥 Warming up...');
            for (let i = 0; i < warmupRuns; i++) {
                await service.searchTodos(testCase.params);
            }

            // Measurement runs
            console.log(`📊 Running ${measurementRuns} measurement iterations...`);
            for (let i = 0; i < measurementRuns; i++) {
                const result = await service.searchTodos(testCase.params);
                executionTimes.push(result.metrics.executionTimeMs);
                totalResponseSize += result.metrics.responseSizeBytes;
                totalQueryCount += result.metrics.queryCount;
                sqlQuery = result.metrics.sqlQuery; // Keep last SQL query

                if (i === measurementRuns - 1) {
                    finalResult = result; // Keep last result for display
                }
            }

            // Calculate statistics
            const { mean: avgTime, stdDev, min: minTime, max: maxTime } = calculateStats(executionTimes);
            const avgResponseSize = Math.round(totalResponseSize / measurementRuns);
            const avgQueryCount = totalQueryCount / measurementRuns;

            console.log(`✅ Found ${finalResult.result.items.length} todos`);
            console.log(`⏱️  Execution time: ${avgTime.toFixed(2)}ms avg (min: ${minTime}ms, max: ${maxTime}ms, σ: ${stdDev.toFixed(2)}ms)`);
            console.log(`🔢 Query count: ${avgQueryCount.toFixed(1)}`);
            console.log(`📦 Response size: ${avgResponseSize} bytes (avg)`);
            console.log(`🗄️  Has more: ${finalResult.result.pagination.hasMore}`);            // Store test result for summary (using average values)
            addTestResultWithDefaults({
                implementation: 'Prisma ORM',
                testType: 'search',
                testName: testCase.name,
                success: true,
                executionTimeMs: Math.round(avgTime * 100) / 100, // Round to 2 decimal places
                queryCount: Math.round(avgQueryCount * 10) / 10,   // Round to 1 decimal place
                responseSizeBytes: avgResponseSize,
                resultCount: finalResult.result.items.length,
                sqlQuery: sqlQuery
            });// Show first few results
            finalResult.result.items.slice(0, 3).forEach((item: any, index: number) => {
                console.log(`   ${index + 1}. "${item.title}" by ${item.user.userName} (${item.category.categoryName}) [${item.commentCount} comments]`);
            });

            if (finalResult.result.items.length > 3) {
                console.log(`   ... and ${finalResult.result.items.length - 3} more`);
            }

            // Show SQL query (truncated)
            const cleanedSql = cleanSqlForDisplay(sqlQuery);
            const sqlPreview = cleanedSql.length > 200
                ? cleanedSql.substring(0, 200) + '...'
                : cleanedSql;
            console.log(`🗄️  SQL: ${sqlPreview}`);

        } catch (error) {
            console.error(`❌ Error in test "${testCase.name}":`, error);            // Store failed test result
            addTestResultWithDefaults({
                implementation: 'Prisma ORM',
                testType: 'search',
                testName: testCase.name,
                success: false,
                executionTimeMs: 0,
                queryCount: 0,
                responseSizeBytes: 0,
                resultCount: 0,
                sqlQuery: ''
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
    } for (const testCase of testCases) {
        console.log(`\n📋 Test: ${testCase.name}`);
        console.log('-'.repeat(40));

        try {
            // Performance measurement with warm-up and multiple runs
            const warmupRuns = 2;
            const measurementRuns = 5;
            const executionTimes: number[] = [];
            let finalResult: any;
            let totalResponseSize = 0;
            let totalQueryCount = 0;
            let sqlQuery = '';

            // Warm-up runs (ignored for performance measurement)
            console.log('🔥 Warming up...');
            for (let i = 0; i < warmupRuns; i++) {
                await service.searchTodos(testCase.params);
            }

            // Measurement runs
            console.log(`📊 Running ${measurementRuns} measurement iterations...`);
            for (let i = 0; i < measurementRuns; i++) {
                const result = await service.searchTodos(testCase.params);
                executionTimes.push(result.metrics.executionTimeMs);
                totalResponseSize += result.metrics.responseSizeBytes;
                totalQueryCount += result.metrics.queryCount;
                sqlQuery = result.metrics.sqlQuery; // Keep last SQL query

                if (i === measurementRuns - 1) {
                    finalResult = result; // Keep last result for display
                }
            }

            // Calculate statistics
            const { mean: avgTime, stdDev, min: minTime, max: maxTime } = calculateStats(executionTimes);
            const avgResponseSize = Math.round(totalResponseSize / measurementRuns);
            const avgQueryCount = totalQueryCount / measurementRuns;

            console.log(`✅ Found ${finalResult.result.items.length} todos`);
            console.log(`⏱️  Execution time: ${avgTime.toFixed(2)}ms avg (min: ${minTime}ms, max: ${maxTime}ms, σ: ${stdDev.toFixed(2)}ms)`);
            console.log(`🔢 Query count: ${avgQueryCount.toFixed(1)}`);
            console.log(`📦 Response size: ${avgResponseSize} bytes (avg)`);
            console.log(`🗄️  Has more: ${finalResult.result.pagination.hasMore}`);            // Store test result for summary (using average values)
            addTestResultWithDefaults({
                implementation: 'rawsql-ts',
                testType: 'search',
                testName: testCase.name,
                success: true,
                executionTimeMs: Math.round(avgTime * 100) / 100, // Round to 2 decimal places
                queryCount: Math.round(avgQueryCount * 10) / 10,   // Round to 1 decimal place
                responseSizeBytes: avgResponseSize,
                resultCount: finalResult.result.items.length,
                sqlQuery: sqlQuery
            });// Show first few results
            finalResult.result.items.slice(0, 3).forEach((item: any, index: number) => {
                console.log(`   ${index + 1}. "${item.title}" by ${item.user.userName} (${item.category.categoryName}) [${item.commentCount} comments]`);
            });

            if (finalResult.result.items.length > 3) {
                console.log(`   ... and ${finalResult.result.items.length - 3} more`);
            }

            // Show SQL query (truncated)
            const cleanedSql = cleanSqlForDisplay(sqlQuery);
            const sqlPreview = cleanedSql.length > 200
                ? cleanedSql.substring(0, 200) + '...'
                : cleanedSql;
            console.log(`🗄️  SQL: ${sqlPreview}`);

        } catch (error) {
            console.error(`❌ Error in test "${testCase.name}":`, error);            // Store failed test result
            addTestResultWithDefaults({
                implementation: 'rawsql-ts',
                testType: 'search',
                testName: testCase.name,
                success: false,
                executionTimeMs: 0,
                queryCount: 0,
                responseSizeBytes: 0,
                resultCount: 0,
                sqlQuery: ''
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
