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
    baseResult: Omit<TestSummary, 'sqlExecutionDetails' | 'queryStrategy'>,
    actualParams?: any[] | any
): void {
    // Extract parameters from SQL query
    const sqlQuery = (baseResult.sqlQueries && baseResult.sqlQueries.length > 0) ? baseResult.sqlQueries[0] : '';
    const extractedParams = extractParametersFromSql(sqlQuery, actualParams);

    const defaultSqlDetails: SqlExecutionDetail[] = [{
        rawSql: sqlQuery ? cleanSqlForDisplay(baseResult.sqlQueries) : '',
        parameters: extractedParams,
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



/**
 * Clean SQL queries for display by removing escape codes and unwanted characters
 * @param sqlQueries - Array of SQL query strings  
 * @returns Cleaned SQL query string (first query or fallback)
 */
export function cleanSqlForDisplay(sqlQueries: string[]): string {
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
 * Extract parameters from SQL query by detecting $1, $2, $3... patterns
 * @param sqlQuery - SQL query string
 * @param actualParams - Optional actual parameter values to map
 * @returns Parameters array with actual values if provided, or empty array
 */
export function extractParametersFromSql(sqlQuery: string, actualParams?: any[] | any): any {
    if (!sqlQuery) {
        return [];
    }

    // Find all parameter placeholders like $1, $2, $3, etc.
    const paramMatches = sqlQuery.match(/\$(\d+)/g); if (!paramMatches || paramMatches.length === 0) {
        return actualParams || [];
    }

    // Extract unique parameter numbers and sort them
    const paramNumbers = [...new Set(paramMatches.map(match => parseInt(match.substring(1))))]
        .sort((a, b) => a - b);    // Return actual parameter values if provided
    if (actualParams) {
        // If it's an array, return as is (up to parameter count)
        if (Array.isArray(actualParams)) {
            return actualParams.slice(0, paramNumbers.length);
        }
        // If it's an object, return the object directly
        return actualParams;
    }

    // If no actual values, return empty array
    return [];
}
