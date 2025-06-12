/**
 * SQL execution details for detailed analysis
 */
export interface SqlExecutionDetail {
    rawSql: string;
    parameters: Record<string, any>;
    rowsAffected: number;
    strategy: string; // 'single-query' | 'multiple-queries' | 'lateral-join' | 'explicit-join'
    complexity: 'simple' | 'medium' | 'complex';
}

/**
 * Query strategy analysis
 */
export interface QueryStrategy {
    approach: 'ORM' | 'RAW_SQL';
    joinStrategy: 'LATERAL_JOIN' | 'EXPLICIT_JOIN' | 'NESTED_QUERY' | 'SINGLE_TABLE';
    dataTransformation: 'BUILT_IN_JSON' | 'MANUAL_MAPPING' | 'SIMPLE_SELECT';
    parameterBinding: 'AUTOMATIC' | 'MANUAL';
    nPlusOneRisk: 'LOW' | 'MEDIUM' | 'HIGH';
    optimizationLevel: 'BASIC' | 'OPTIMIZED' | 'HIGHLY_OPTIMIZED';
}

/**
 * Enhanced test result summary interface with detailed SQL analysis
 */
export interface TestSummary {
    implementation: string;
    testType: 'search' | 'detail';
    testName: string;
    success: boolean;
    resultCount: number;
    sqlQueries: string[];
    // Enhanced SQL analysis fields
    sqlExecutionDetails: SqlExecutionDetail[];
    queryStrategy: QueryStrategy;
    memoryUsageKB?: number;
    connectionPoolUsage?: number;
    cacheHitRate?: number;
}

/**
 * Global test results storage
 */
export const testResults: TestSummary[] = [];

/**
 * Add test result to global collection
 */
export function addTestResult(result: TestSummary) {
    testResults.push(result);
}

/**
 * Helper function to add test result with default SQL analysis fields
 */
export function addTestResultWithDefaults(
    baseResult: Omit<TestSummary, 'sqlExecutionDetails' | 'queryStrategy'>
): void {
    const defaultSqlDetails: SqlExecutionDetail[] = [{
        rawSql: (baseResult.sqlQueries && baseResult.sqlQueries.length > 0) ? baseResult.sqlQueries[0] : '',
        parameters: {},
        rowsAffected: baseResult.resultCount,
        strategy: baseResult.implementation.includes('Prisma') ? 'lateral-join' : 'explicit-join',
        complexity: 'medium'
    }];

    const defaultQueryStrategy: QueryStrategy = {
        approach: baseResult.implementation.includes('Prisma') ? 'ORM' : 'RAW_SQL',
        joinStrategy: baseResult.implementation.includes('Prisma') ? 'LATERAL_JOIN' : 'EXPLICIT_JOIN',
        dataTransformation: baseResult.implementation.includes('Prisma') ? 'BUILT_IN_JSON' : 'MANUAL_MAPPING',
        parameterBinding: baseResult.implementation.includes('Prisma') ? 'AUTOMATIC' : 'MANUAL',
        nPlusOneRisk: baseResult.implementation.includes('Prisma') ? 'LOW' : 'MEDIUM',
        optimizationLevel: baseResult.implementation.includes('Prisma') ? 'HIGHLY_OPTIMIZED' : 'OPTIMIZED'
    };

    const fullResult: TestSummary = {
        ...baseResult,
        sqlExecutionDetails: defaultSqlDetails,
        queryStrategy: defaultQueryStrategy
    };

    testResults.push(fullResult);
}
