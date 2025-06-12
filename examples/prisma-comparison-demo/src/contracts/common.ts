/**
 * Common types used across multiple modules
 */

/**
 * Query execution metrics
 */
export interface QueryMetrics {
    /** Generated SQL query */
    sqlQuery: string;
    /** Query execution time in milliseconds */
    executionTimeMs: number;
    /** Number of database queries executed */
    queryCount: number;
    /** Size of response data in bytes */
    responseSizeBytes: number;
}
