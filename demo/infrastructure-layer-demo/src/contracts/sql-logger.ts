/**
 * SQL Logger Interface - Captures query execution details for analysis
 * This interface enables infrastructure implementations to delegate query logging
 * to external reporters for demo and monitoring purposes
 */

export interface SqlQueryLog {
    /** The executed SQL query */
    sql: string;
    /** Parameters passed to the query */
    params: any[];
    /** Query execution time in milliseconds */
    executionTimeMs: number;
    /** Timestamp when the query was executed */
    timestamp: Date;
    /** Optional query identifier or label */
    queryLabel?: string;
    /** Result metadata (rows affected, returned, etc.) */
    resultMeta?: {
        rowCount?: number;
        affectedRows?: number;
        hasResults?: boolean;
    };
}

export interface SqlLogger {
    /**
     * Log a SQL query execution
     */
    logQuery(log: SqlQueryLog): void;

    /**
     * Get all logged queries
     */
    getQueryLogs(): SqlQueryLog[];

    /**
     * Clear all logged queries
     */
    clearLogs(): void;

    /**
     * Get query statistics
     */
    getStatistics(): {
        totalQueries: number;
        totalExecutionTime: number;
        averageExecutionTime: number;
        queryTypes: { [key: string]: number };
    };
}

/**
 * Demo SQL Logger - Collects query execution information for reporting
 */
export class DemoSqlLogger implements SqlLogger {
    private queryLogs: SqlQueryLog[] = [];

    logQuery(log: SqlQueryLog): void {
        this.queryLogs.push({ ...log });
    }

    getQueryLogs(): SqlQueryLog[] {
        return [...this.queryLogs];
    }

    clearLogs(): void {
        this.queryLogs = [];
    }

    getStatistics() {
        const totalQueries = this.queryLogs.length;
        const totalExecutionTime = this.queryLogs.reduce((sum, log) => sum + log.executionTimeMs, 0);
        const averageExecutionTime = totalQueries > 0 ? totalExecutionTime / totalQueries : 0;

        // Analyze query types based on SQL keywords
        const queryTypes: { [key: string]: number } = {};
        this.queryLogs.forEach(log => {
            const sql = log.sql.trim().toLowerCase();
            let type = 'other';

            if (sql.startsWith('select')) type = 'select';
            else if (sql.startsWith('insert')) type = 'insert';
            else if (sql.startsWith('update')) type = 'update';
            else if (sql.startsWith('delete')) type = 'delete';
            else if (sql.startsWith('with')) type = 'cte';

            queryTypes[type] = (queryTypes[type] || 0) + 1;
        });

        return {
            totalQueries,
            totalExecutionTime,
            averageExecutionTime,
            queryTypes
        };
    }    /**
     * Format logs for markdown reporting - simple and concise format
     */
    formatForReport(title: string): string {
        let report = `### ${title}\n\n`;

        if (this.queryLogs.length > 0) {
            this.queryLogs.forEach((log, index) => {
                if (index > 0) report += '\n'; // Add spacing between queries

                // Add query header with counter
                report += `#### Query${index + 1}\n\n`;

                report += '```sql\n';
                report += log.sql;
                report += '\n```\n'; if (log.params && log.params.length > 0) {
                    report += `**Parameters:** \`${JSON.stringify(log.params)}\`\n`;
                }
            });
        } else {
            report += '*No queries executed*\n';
        }

        return report;
    }

    /**
     * Get simple statistics summary for concise reporting
     */
    getSimpleStats(): { queryCount: number; totalTime: number } {
        return {
            queryCount: this.queryLogs.length,
            totalTime: this.queryLogs.reduce((sum, log) => sum + log.executionTimeMs, 0)
        };
    }
}
