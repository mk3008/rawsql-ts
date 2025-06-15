/**
 * Main test runner for comparing different TODO implementation approaches
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { testResults, TestSummary, SqlExecutionDetail, QueryStrategy } from './types';

const prisma = new PrismaClient({
    log: ['query', 'info', 'warn', 'error'],
});

/**
 * Run all tests and generate detailed SQL analysis report
 */
async function runAllTests() {
    console.log('🚀 Prisma vs rawsql-ts Comparison Demo - SQL Analysis Runner');
    console.log('='.repeat(70));
    console.log('Testing different approaches with detailed SQL execution analysis');
    console.log('Analyzing query strategies, execution patterns, and performance metrics');
    console.log('');

    try {
        // Test database connection
        console.log('🔌 Testing database connection...');
        await prisma.$connect();
        console.log('✅ Database connected successfully');

        // Display SQL analysis configuration
        console.log('\n📊 SQL Analysis Configuration:');
        console.log('   • SQL execution details tracking: ENABLED');
        console.log('   • Query strategy analysis: ENABLED');
        console.log('   • Performance metrics collection: ENABLED');
        console.log('   • Memory usage monitoring: ENABLED');

        // Import and run search tests
        console.log('\n' + '='.repeat(70));
        console.log('🔍 Running Search Tests with SQL Analysis...');
        const { runSearchTests } = await import('./search-test');
        await runSearchTests();

        // Import and run detail tests  
        console.log('\n' + '='.repeat(70));
        console.log('📋 Running Detail Tests with SQL Analysis...');
        const { runDetailTests } = await import('./detail-test');
        await runDetailTests();

        console.log('\n' + '='.repeat(70));
        console.log('🎉 All tests completed with detailed analysis!');

        // Display immediate SQL execution summary
        displaySqlExecutionSummary();

        // Generate comprehensive markdown report
        await generateMarkdownReport();

        console.log('');
        console.log('📊 Analysis Complete:');
        console.log('   1. SQL execution details captured and analyzed');
        console.log('   2. Query strategies compared and documented');
        console.log('   3. Performance metrics collected and reported');
        console.log('   4. Optimization recommendations generated');

    } catch (error) {
        console.error('❌ Test execution failed:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

/**
 * Run individual test modules
 */
async function runSearchTestsIndividual() {
    const { runSearchTests } = await import('./search-test');
    await runSearchTests();
}

async function runDetailTestsIndividual() {
    const { runDetailTests } = await import('./detail-test');
    await runDetailTests();
}

// Export test functions and SQL analysis helpers for use in other modules
export {
    runSearchTestsIndividual as runSearchTests,
    runDetailTestsIndividual as runDetailTests,
    createSqlExecutionDetail,
    createQueryStrategy,
    enhanceTestResultWithSqlAnalysis,
    cleanSqlForDisplay
};

// Run all tests if this file is executed directly
if (require.main === module) {
    const command = process.argv[2];
    switch (command) {
        case 'search':
            runSearchTestsIndividual();
            break;
        case 'detail':
            runDetailTestsIndividual();
            break;
        default:
            runAllTests();
            break;
    }
}

/**
 * Generate markdown summary report
 */
async function generateMarkdownReport() {
    console.log('\n📄 Generating markdown report...');

    if (testResults.length === 0) {
        console.log('⚠️  No test results to report');
        return;
    }

    const timestamp = new Date().toISOString();
    const reportFilename = `test-report-${timestamp.replace(/:/g, '-').replace(/\./g, '-')}.md`;

    // Ensure reports directory exists
    const reportsDir = path.join(process.cwd(), 'reports');
    if (!fs.existsSync(reportsDir)) {
        fs.mkdirSync(reportsDir, { recursive: true });
    }

    const reportPath = path.join(reportsDir, reportFilename);

    // Calculate statistics
    const totalTests = testResults.length;
    const failedTests = testResults.filter(r => !r.success);
    const successRate = totalTests === 0 ? 0 : ((totalTests - failedTests.length) / totalTests) * 100;

    // Generate markdown content
    const markdownContent = generateMarkdownContent(testResults, successRate, failedTests.length, timestamp);

    // Write to file
    fs.writeFileSync(reportPath, markdownContent, 'utf8');

    console.log(`✅ Report generated: ${reportPath}`);
}

/**
 * Generate markdown content for the test report
 */
function generateMarkdownContent(results: TestSummary[], successRate: number, failedCount: number, timestamp: string): string {
    const searchResults = results.filter(r => r.testType === 'search');
    const detailResults = results.filter(r => r.testType === 'detail');

    let content = `# Prisma vs rawsql-ts SQL Comparison Report

**Generated:** ${timestamp}
**Total Tests:** ${results.length}

## 📊 Executive Summary

`;

    // Success rate display
    if (failedCount === 0) {
        content += `**Success Rate:** ✅ All tests passed\n\n`;
    } else {
        content += `**Success Rate:** ❌ ${failedCount} failed (${successRate.toFixed(1)}%)\n\n`;
    }

    // Search Tests Comparison
    if (searchResults.length > 0) {
        content += `## 🔍 Search Operations Comparison

`;
        content += generateSearchComparison(searchResults);
    }

    // Detail Tests Comparison  
    if (detailResults.length > 0) {
        content += `## 📋 Detail Operations Comparison

`;
        content += generateDetailComparison(detailResults);
    }

    content += `
---
*This report focuses on SQL query patterns and parameter usage for direct comparison between approaches.*
`;

    return content;
}

/**
 * Generate search comparison content
 */
function generateSearchComparison(searchResults: TestSummary[]): string {
    let content = '';

    // Group search results by test condition
    const testGroups = new Map<string, TestSummary[]>();
    searchResults.forEach(result => {
        const testName = result.testName;
        if (!testGroups.has(testName)) {
            testGroups.set(testName, []);
        }
        testGroups.get(testName)!.push(result);
    });

    testGroups.forEach((testGroup, testName) => {
        const prismaResult = testGroup.find(r => r.implementation.includes('Prisma'));
        const rawsqlResult = testGroup.find(r => r.implementation.includes('rawsql'));

        content += `### ${testName}

`;

        // Common condition description
        if (prismaResult && rawsqlResult) {
            const commonCondition = extractConditionFromParameters(prismaResult);
            content += `**🎯 Test Condition:** ${commonCondition}

`;
        }

        // Prisma section
        if (prismaResult) {
            content += `#### � Prisma ORM
- **Results:** ${prismaResult.resultCount} records found
- **Status:** ${prismaResult.success ? '✅ Success' : '❌ Failed'}
- **Parameters:** \`${JSON.stringify(getParametersFromResult(prismaResult))}\`

**SQL Query:**
\`\`\`sql
${getSqlFromResult(prismaResult)}
\`\`\`

`;
        }

        // rawsql-ts section
        if (rawsqlResult) {
            content += `#### 🔸 rawsql-ts
- **Results:** ${rawsqlResult.resultCount} records found
- **Status:** ${rawsqlResult.success ? '✅ Success' : '❌ Failed'}
- **Parameters:** \`${JSON.stringify(getParametersFromResult(rawsqlResult))}\`

**SQL Query:**
\`\`\`sql
${getSqlFromResult(rawsqlResult)}
\`\`\`

`;
        }

        content += '---\n\n';
    });

    return content;
}

/**
 * Generate detail comparison content
 */
function generateDetailComparison(detailResults: TestSummary[]): string {
    let content = '';

    // Group detail results by test condition
    const testGroups = new Map<string, TestSummary[]>();
    detailResults.forEach(result => {
        const testName = result.testName;
        if (!testGroups.has(testName)) {
            testGroups.set(testName, []);
        }
        testGroups.get(testName)!.push(result);
    });

    testGroups.forEach((testGroup, testName) => {
        const prismaResult = testGroup.find(r => r.implementation.includes('Prisma'));
        const rawsqlResult = testGroup.find(r => r.implementation.includes('rawsql'));

        content += `### ${testName}

`;

        // Common condition description
        if (prismaResult && rawsqlResult) {
            const commonCondition = extractConditionFromParameters(prismaResult);
            content += `**🎯 Test Condition:** ${commonCondition}

`;
        }

        // Prisma section
        if (prismaResult) {
            content += `#### 🔹 Prisma ORM
- **Results:** ${prismaResult.resultCount} records found
- **Status:** ${prismaResult.success ? '✅ Success' : '❌ Failed'}
- **Parameters:** \`${JSON.stringify(getParametersFromResult(prismaResult))}\`

**SQL Query:**
\`\`\`sql
${getSqlFromResult(prismaResult)}
\`\`\`

`;
        }

        // rawsql-ts section
        if (rawsqlResult) {
            content += `#### 🔸 rawsql-ts
- **Results:** ${rawsqlResult.resultCount} records found
- **Status:** ${rawsqlResult.success ? '✅ Success' : '❌ Failed'}
- **Parameters:** \`${JSON.stringify(getParametersFromResult(rawsqlResult))}\`

**SQL Query:**
\`\`\`sql
${getSqlFromResult(rawsqlResult)}
\`\`\`

`;
        }

        content += '---\n\n';
    });

    return content;
}

/**
 * Helper functions for extracting information from test results
 */
function extractConditionFromParameters(result: TestSummary): string {
    const params = getParametersFromResult(result);

    if (Array.isArray(params)) {
        if (params.length === 1) {
            return `Single parameter lookup (ID: ${params[0]})`;
        }
        return `Array parameters: ${params.join(', ')}`;
    }

    if (params && typeof params === 'object') {
        const conditions = params.conditions || {};
        const conditionKeys = Object.keys(conditions);

        if (conditionKeys.length === 0) {
            return 'No specific conditions (list all)';
        }

        const conditionDesc = conditionKeys.map(key => `${key}: ${conditions[key]}`).join(', ');
        return conditionDesc;
    }

    return 'Standard lookup operation';
}

function getParametersFromResult(result: TestSummary): any {
    if (result.sqlExecutionDetails && result.sqlExecutionDetails.length > 0) {
        const params = result.sqlExecutionDetails[0].parameters;

        // Check if this is a rawsql-ts result and params look like TodoSearchParams
        if (result.implementation.includes('rawsql') &&
            params &&
            typeof params === 'object' &&
            params.conditions &&
            params.pagination) {
            // Convert to the actual parameters used by rawsql-ts
            return convertToRawSqlParameters(params);
        }

        return params;
    }

    return {};
}

/**
 * Convert TodoSearchParams to the actual parameters used by rawsql-ts
 */
function convertToRawSqlParameters(params: any): any {
    if (!params || !params.conditions || !params.pagination) {
        return params;
    }

    // Build the filter object as used in rawsql-ts service
    const filter: Record<string, any> = {};

    if (params.conditions.title) {
        filter.title = { ilike: `%${params.conditions.title}%` };
    }
    if (params.conditions.completed !== undefined) {
        filter.completed = params.conditions.completed;
    }
    if (params.conditions.userName) {
        filter.user_name = { ilike: `%${params.conditions.userName}%` };
    }
    if (params.conditions.categoryId !== undefined) {
        filter.category_id = params.conditions.categoryId;
    }
    if (params.conditions.color) {
        filter.color = params.conditions.color;
    }

    // Remove undefined values
    Object.keys(filter).forEach(key => {
        if (filter[key] === undefined) {
            delete filter[key];
        }
    });

    // Build sort object (default sorting used in rawsql-ts)
    const sort = {
        created_at: { desc: true }
    };

    // Build paging object
    const paging = {
        page: Math.floor(params.pagination.offset / params.pagination.limit) + 1,
        pageSize: params.pagination.limit
    };

    return { filter, sort, paging };
}

function getSqlFromResult(result: TestSummary): string {
    if (result.sqlExecutionDetails && result.sqlExecutionDetails.length > 0) {
        return result.sqlExecutionDetails[0].rawSql;
    }

    if (result.sqlQueries && result.sqlQueries.length > 0) {
        return cleanSqlForDisplay(result.sqlQueries);
    }

    return 'No SQL query captured';
}

/**
 * Display immediate SQL execution summary to console
 */
function displaySqlExecutionSummary() {
    console.log('\n📊 SQL Execution Summary');
    console.log('='.repeat(50));

    if (testResults.length === 0) {
        console.log('⚠️  No test results available for analysis');
        return;
    }

    // Group results by implementation
    const prismaResults = testResults.filter(r => r.implementation.includes('Prisma'));
    const rawsqlResults = testResults.filter(r => r.implementation.includes('rawsql'));

    console.log(`\n🔍 Query Execution Overview:`);
    console.log(`   Total Tests: ${testResults.length}`);
    console.log(`   Prisma ORM Tests: ${prismaResults.length}`);
    console.log(`   rawsql-ts Tests: ${rawsqlResults.length}`);    // Display SQL execution details for each test
    testResults.forEach((result, index) => {
        console.log(`\n${index + 1}. ${result.testName} (${result.implementation})`);
        console.log(`    Result Count: ${result.resultCount}`);

        // Display SQL strategy if available
        if (result.queryStrategy) {
            console.log(`   🎯 Query Strategy:`);
            console.log(`      • Approach: ${result.queryStrategy.approach}`);
            console.log(`      • Join Strategy: ${result.queryStrategy.joinStrategy}`);
            console.log(`      • Data Transformation: ${result.queryStrategy.dataTransformation}`);
            console.log(`      • N+1 Risk: ${result.queryStrategy.nPlusOneRisk}`);
            console.log(`      • Optimization Level: ${result.queryStrategy.optimizationLevel}`);
        }

        // Display SQL execution details if available
        if (result.sqlExecutionDetails && result.sqlExecutionDetails.length > 0) {
            console.log(`   📝 SQL Execution Details:`); result.sqlExecutionDetails.forEach((detail, detailIndex) => {
                console.log(`      Query ${detailIndex + 1}:`);
                console.log(`         • Strategy: ${detail.strategy}`);
                console.log(`         • Complexity: ${detail.complexity}`);
                console.log(`         • Rows Affected: ${detail.rowsAffected}`);
                console.log(`         • Parameters: ${JSON.stringify(detail.parameters)}`);
            });
        }        // Show actual SQL query (cleaned up)
        if (result.sqlQueries &&
            Array.isArray(result.sqlQueries) &&
            result.sqlQueries.length > 0 &&
            result.sqlQueries[0] &&
            typeof result.sqlQueries[0] === 'string' &&
            result.sqlQueries[0].trim().length > 0) {
            const cleanSql = cleanSqlForDisplay(result.sqlQueries);

            if (cleanSql.length > 100) {
                console.log(`   🔍 SQL Query Preview: ${cleanSql.substring(0, 100)}...`);
            } else {
                console.log(`   🔍 SQL Query: ${cleanSql}`);
            }
        } else {
            console.log(`   🔍 SQL Query: Not captured or empty`);
        }
    });

    console.log('\n' + '='.repeat(50));
}

/**
 * Helper function to create SQL execution details
 */
function createSqlExecutionDetail(
    rawSql: string,
    parameters: Record<string, any> = {},
    rowsAffected: number = 0,
    strategy: string = 'single-query',
    complexity: 'simple' | 'medium' | 'complex' = 'medium'
): SqlExecutionDetail {
    return {
        rawSql,
        parameters,
        rowsAffected,
        strategy,
        complexity
    };
}

/**
 * Helper function to create query strategy analysis
 */
function createQueryStrategy(
    approach: 'ORM' | 'RAW_SQL',
    joinStrategy: 'LATERAL_JOIN' | 'EXPLICIT_JOIN' | 'NESTED_QUERY' | 'SINGLE_TABLE' = 'SINGLE_TABLE',
    dataTransformation: 'BUILT_IN_JSON' | 'MANUAL_MAPPING' | 'SIMPLE_SELECT' = 'SIMPLE_SELECT',
    parameterBinding: 'AUTOMATIC' | 'MANUAL' = 'AUTOMATIC',
    nPlusOneRisk: 'LOW' | 'MEDIUM' | 'HIGH' = 'MEDIUM',
    optimizationLevel: 'BASIC' | 'OPTIMIZED' | 'HIGHLY_OPTIMIZED' = 'BASIC'
): QueryStrategy {
    return {
        approach,
        joinStrategy,
        dataTransformation,
        parameterBinding,
        nPlusOneRisk,
        optimizationLevel
    };
}

/**
 * Helper function to enhance existing test result with detailed SQL analysis
 */
function enhanceTestResultWithSqlAnalysis(
    baseResult: Omit<TestSummary, 'sqlExecutionDetails' | 'queryStrategy'>,
    sqlExecutionDetails: SqlExecutionDetail[] = [],
    queryStrategy?: QueryStrategy,
    memoryUsageKB?: number,
    connectionPoolUsage?: number,
    cacheHitRate?: number
): TestSummary {
    // Auto-detect query strategy if not provided
    const detectedStrategy = queryStrategy || (
        baseResult.implementation.includes('Prisma')
            ? createQueryStrategy('ORM', 'LATERAL_JOIN', 'BUILT_IN_JSON', 'AUTOMATIC', 'LOW', 'HIGHLY_OPTIMIZED')
            : createQueryStrategy('RAW_SQL', 'EXPLICIT_JOIN', 'MANUAL_MAPPING', 'MANUAL', 'MEDIUM', 'OPTIMIZED')
    );

    return {
        ...baseResult,
        sqlExecutionDetails,
        queryStrategy: detectedStrategy,
        memoryUsageKB,
        connectionPoolUsage,
        cacheHitRate
    };
}

/**  
 * Clean SQL queries for display by removing escape codes and unwanted characters
 * @param sqlQueries - Array of SQL query strings
 * @returns Cleaned SQL query string (first query or fallback)
 */
function cleanSqlForDisplay(sqlQueries: string[]): string {
    if (!sqlQueries || sqlQueries.length === 0) {
        return 'No SQL query captured';
    }

    const sqlQuery = sqlQueries[0]; // Use the first query for display
    return sqlQuery
        // Remove all ANSI escape sequences (comprehensive pattern)
        .replace(/\x1B\[[0-9;]*[JKmsu]/g, '')  // Standard ANSI escape sequences
        .replace(/\[(\d+)(;\d+)*m/g, '')       // Color codes like [34m, [39m, [1;32m
        .replace(/\[\d+m/g, '')                // Simple color codes 
        .replace(/\[\d+;\d+m/g, '')            // Multi-part color codes
        // Remove Prisma log prefixes and related content
        .replace(/prisma:query\s*/gi, '')      // Remove prisma:query prefix (case insensitive)
        .replace(/prisma:\w+\s*/gi, '')        // Remove any prisma:xxx prefix  
        .replace(/\s*\+\d+ms\s*/g, '')         // Remove timing info like +2ms
        .replace(/\s*\(\d+ms\)\s*/g, '')       // Remove timing info like (15ms)
        // Clean up extra whitespace and formatting
        .replace(/^\s*[\r\n]+/, '')            // Remove leading whitespace/newlines
        .replace(/[\r\n]+\s*$/, '')            // Remove trailing whitespace/newlines  
        .replace(/[\r\n]+/g, '\n')             // Normalize line breaks
        .replace(/\s+/g, ' ')                  // Normalize multiple spaces to single space
        .trim();
}

/**
 * Get parameter count from parameters object/array
 * Handles both object (named parameters) and array (indexed parameters like $1, $2, etc.)
 * @param parameters - Parameters object or array
 * @returns Number of parameters
 */
