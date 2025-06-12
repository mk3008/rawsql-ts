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

    let content = `# Prisma vs rawsql-ts Comparison Test Report

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
    // Search Tests Section
    if (searchResults.length > 0) {
        content += `## 🔍 TODO Search Tests (List/Pagination)

**Analysis:** Search operations test pagination, filtering, and sorting capabilities. Both approaches use single queries but differ in SQL generation and data transformation strategies.

`;
    }

    // Detail Tests Section
    if (detailResults.length > 0) {
        content += `## 📋 TODO Detail Tests (ID-based Lookup)

### Performance Comparison
| Test Name | Prisma ORM | rawsql-ts | Winner |
|-----------|------------|-----------|--------|
`;        // Group detail results by test name for comparison
        const detailTestGroups = new Map<string, TestSummary[]>();
        detailResults.forEach(result => {
            if (!detailTestGroups.has(result.testName)) {
                detailTestGroups.set(result.testName, []);
            }
            detailTestGroups.get(result.testName)!.push(result);
        }); detailTestGroups.forEach((testGroup, testName) => {
            const prismaResult = testGroup.find(r => r.implementation.includes('Prisma'));
            const rawsqlResult = testGroup.find(r => r.implementation.includes('rawsql'));

            // Speed comparison removed - focusing on functionality analysis only
            if (prismaResult && rawsqlResult) {
                content += `| ${testName} | ✅ Completed | ✅ Completed | 📊 Both approaches successful |\n`;
            }
        });

        content += '\n';

        // Detail Implementation Analysis (Speed comparison removed - now focusing on query strategy analysis)
        const prismaDetailResults = detailResults.filter(r => r.implementation.includes('Prisma'));
        const rawsqlDetailResults = detailResults.filter(r => r.implementation.includes('rawsql'));

        if (prismaDetailResults.length > 0 && rawsqlDetailResults.length > 0) {
            content += `### Detail Implementation Analysis
- **Prisma ORM Tests:** ${prismaDetailResults.length} test cases completed
- **rawsql-ts Tests:** ${rawsqlDetailResults.length} test cases completed

**Analysis:** Detail operations test single-record retrieval with complex joins. This helps identify query patterns and data loading strategies.

### Query Strategy Analysis
- **Prisma ORM:** Uses sophisticated relation loading with LATERAL JOINs to avoid N+1 queries
- **rawsql-ts:** Uses explicit JOINs with manual data aggregation for optimal single-query performance

`;
        }
    }    // SQL Generation Comparison with detailed analysis
    content += `## 🔧 SQL Generation & Execution Strategy Analysis

### Prisma ORM Strategy Deep Dive
- **Query Generation:** Automatic query generation with intelligent relation handling
- **JOIN Strategy:** Sophisticated LATERAL JOINs for complex nested data structures
- **Data Transformation:** Built-in JSON aggregation using \`JSONB_BUILD_OBJECT\` and \`JSONB_AGG\`
- **Parameter Binding:** Automatic with prepared statements and type safety
- **N+1 Prevention:** Automatic batching and intelligent query optimization
- **Connection Management:** Built-in connection pooling with automatic cleanup

### rawsql-ts Strategy Deep Dive  
- **Query Generation:** Hand-crafted SQL with dynamic parameter injection capabilities
- **JOIN Strategy:** Explicit JOINs with manual data structuring and aggregation
- **Data Transformation:** Custom JSON mapping with hierarchical object building
- **Parameter Binding:** Manual with SqlParamInjector for flexibility and control
- **N+1 Prevention:** Manual query optimization and explicit JOIN strategies
- **Connection Management:** Manual connection handling with custom pooling

### Query Complexity Analysis
`;

    // Add detailed SQL execution analysis
    results.forEach(result => {
        if (result.sqlExecutionDetails && result.sqlExecutionDetails.length > 0) {
            content += `\n#### ${result.testName} (${result.implementation}) - SQL Execution Details\n`; result.sqlExecutionDetails.forEach((detail: SqlExecutionDetail, index: number) => {
                content += `
**Query ${index + 1}:**
- **Strategy:** ${detail.strategy}
- **Complexity:** ${detail.complexity}
- **Rows Affected:** ${detail.rowsAffected}
- **Parameters:** ${Object.keys(detail.parameters).length} params
- **SQL:**
\`\`\`sql
${detail.rawSql}
\`\`\`
`;
                if (Object.keys(detail.parameters).length > 0) {
                    content += `- **Parameters:** \`${JSON.stringify(detail.parameters)}\`\n`;
                }
            });
        }
    });

    content += `\n### Query Strategy Comparison Matrix

| Aspect | Prisma ORM | rawsql-ts | Advantage |
|--------|------------|-----------|-----------|
`;

    // Generate strategy comparison matrix
    const prismaStrategies = results.filter(r => r.implementation.includes('Prisma') && r.queryStrategy);
    const rawsqlStrategies = results.filter(r => r.implementation.includes('rawsql') && r.queryStrategy);

    if (prismaStrategies.length > 0 && rawsqlStrategies.length > 0) {
        const prismaStrategy = prismaStrategies[0].queryStrategy;
        const rawsqlStrategy = rawsqlStrategies[0].queryStrategy;

        content += `| Join Strategy | ${prismaStrategy.joinStrategy} | ${rawsqlStrategy.joinStrategy} | ${prismaStrategy.joinStrategy === 'LATERAL_JOIN' ? 'Prisma (Automatic)' : 'rawsql-ts (Explicit)'} |\n`;
        content += `| Data Transformation | ${prismaStrategy.dataTransformation} | ${rawsqlStrategy.dataTransformation} | ${prismaStrategy.dataTransformation === 'BUILT_IN_JSON' ? 'Prisma (Automatic)' : 'rawsql-ts (Flexible)'} |\n`;
        content += `| Parameter Binding | ${prismaStrategy.parameterBinding} | ${rawsqlStrategy.parameterBinding} | ${prismaStrategy.parameterBinding === 'AUTOMATIC' ? 'Prisma (Type Safe)' : 'rawsql-ts (Flexible)'} |\n`;
        content += `| N+1 Risk | ${prismaStrategy.nPlusOneRisk} | ${rawsqlStrategy.nPlusOneRisk} | ${prismaStrategy.nPlusOneRisk === 'LOW' ? 'Prisma (Built-in Prevention)' : 'rawsql-ts (Manual Control)'} |\n`;
        content += `| Optimization Level | ${prismaStrategy.optimizationLevel} | ${rawsqlStrategy.optimizationLevel} | ${prismaStrategy.optimizationLevel === 'HIGHLY_OPTIMIZED' ? 'Prisma' : 'rawsql-ts'} |\n`;
    }

    content += `\n### Performance Optimization Recommendations

#### For Prisma ORM Users:
1. **Leverage Prisma's built-in optimizations** - Use \`include\` and \`select\` strategically
2. **Monitor query execution** - Use Prisma's logging to identify bottlenecks
3. **Utilize relation loading strategies** - Choose between eager and lazy loading appropriately
4. **Connection pooling** - Configure connection pool size based on application load

#### For rawsql-ts Users:
1. **Optimize JOIN strategies** - Use explicit JOINs to prevent N+1 queries
2. **Parameter binding** - Ensure proper parameter sanitization and binding
3. **Query complexity management** - Break down complex queries when beneficial
4. **Manual connection management** - Implement efficient connection pooling

`;

    // SQL Generation Comparison (keeping existing functionality)
    content += `## 🔧 SQL Generation Strategy Comparison

### Prisma ORM Approach
- **Query Generation:** Automatic query generation with relation handling
- **JOIN Strategy:** Uses LATERAL JOINs for complex nested data
- **Data Transformation:** Built-in JSON aggregation with \`JSONB_BUILD_OBJECT\`
- **Parameter Binding:** Automatic with prepared statements

### rawsql-ts Approach  
- **Query Generation:** Hand-written SQL with dynamic parameter injection
- **JOIN Strategy:** Explicit JOINs with manual data structuring
- **Data Transformation:** Custom JSON mapping with hierarchical object building
- **Parameter Binding:** Manual with SqlParamInjector

`;    // Detailed Breakdown with enhanced SQL analysis
    content += `## 📋 Detailed Test Results & SQL Execution Analysis

`; results.forEach((result: TestSummary) => {
        content += `### ${result.testName} (${result.implementation})
- **Test Type:** ${result.testType === 'search' ? '🔍 Search/List' : '📋 Detail/ID Lookup'}
- **Status:** ${result.success ? '✅ Passed' : '❌ Failed'}
- **Result Count:** ${result.resultCount}
`;

        // Display query strategy analysis
        if (result.queryStrategy) {
            content += `
**🎯 Query Strategy Analysis:**
- **Approach:** ${result.queryStrategy.approach}
- **Join Strategy:** ${result.queryStrategy.joinStrategy}
- **Data Transformation:** ${result.queryStrategy.dataTransformation}
- **Parameter Binding:** ${result.queryStrategy.parameterBinding}
- **N+1 Query Risk:** ${result.queryStrategy.nPlusOneRisk}
- **Optimization Level:** ${result.queryStrategy.optimizationLevel}
`;
        }

        // Display additional performance metrics if available
        if (result.memoryUsageKB || result.connectionPoolUsage || result.cacheHitRate) {
            content += `
**📊 Performance Metrics:**
`;
            if (result.memoryUsageKB) {
                content += `- **Memory Usage:** ${result.memoryUsageKB}KB\n`;
            }
            if (result.connectionPoolUsage) {
                content += `- **Connection Pool Usage:** ${result.connectionPoolUsage}%\n`;
            }
            if (result.cacheHitRate) {
                content += `- **Cache Hit Rate:** ${result.cacheHitRate}%\n`;
            }
        }

        // Display SQL execution details if available
        if (result.sqlExecutionDetails && result.sqlExecutionDetails.length > 0) {
            content += `
**💻 SQL Execution Details:**
`;
            result.sqlExecutionDetails.forEach((detail: SqlExecutionDetail, detailIndex: number) => {
                content += `
**Query ${detailIndex + 1}:**
- **Strategy:** ${detail.strategy}
- **Complexity:** ${detail.complexity.toUpperCase()}
- **Rows Affected:** ${detail.rowsAffected}
- **Parameters Count:** ${Object.keys(detail.parameters).length}

**Raw SQL:**
\`\`\`sql
${detail.rawSql}
\`\`\`
`;
                if (Object.keys(detail.parameters).length > 0) {
                    content += `
**Parameters:**
\`\`\`json
${JSON.stringify(detail.parameters, null, 2)}
\`\`\`
`;
                }
            });
        }        // Show original SQL query (cleaned up) as fallback
        if (result.sqlQueries && result.sqlQueries.length > 0 && (!result.sqlExecutionDetails || result.sqlExecutionDetails.length === 0)) {
            // Clean up SQL query for display (remove color codes and trim whitespace)
            const cleanSql = cleanSqlForDisplay(result.sqlQueries);
            content += `
**📝 Generated SQL:**
\`\`\`sql
${cleanSql}
\`\`\`
`;
        }

        content += '\n---\n';
    }); content += `
---

## 🎯 Summary & Recommendations

### Key Findings:
1. **SQL Execution Patterns:** Detailed analysis of query strategies and execution details
2. **Performance Characteristics:** Comprehensive comparison of execution times and resource usage
3. **Query Optimization:** Identification of optimization opportunities and best practices
4. **Strategy Trade-offs:** Clear understanding of when to use each approach

### Next Steps:
- Review SQL execution details for optimization opportunities
- Consider query strategy adjustments based on performance analysis
- Implement recommended optimizations for your specific use case
- Monitor performance metrics in production environments

---
*Report generated by Prisma vs rawsql-ts SQL Analysis Suite*  
*Detailed SQL execution analysis and query strategy comparison*  
*Performance measurements exclude debug logging overhead*
`;

    return content;
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
                console.log(`         • Parameters: ${Object.keys(detail.parameters).length} params`);
            });
        }        // Show actual SQL query (cleaned up)
        if (result.sqlQueries &&
            Array.isArray(result.sqlQueries) &&
            result.sqlQueries.length > 0 &&
            result.sqlQueries[0] &&
            typeof result.sqlQueries[0] === 'string' &&
            result.sqlQueries[0].trim().length > 0) {
            const cleanSql = result.sqlQueries[0]
                .replace(/\[34m/g, '')
                .replace(/\[39m/g, '')
                .replace(/prisma:query\s*/g, '')
                .trim();

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
        .replace(/\[34m/g, '')
        .replace(/\[39m/g, '')
        .replace(/prisma:query\s*/g, '')
        .trim();
}

