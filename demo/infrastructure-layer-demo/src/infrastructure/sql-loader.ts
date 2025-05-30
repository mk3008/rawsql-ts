import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * SQL Query Loader
 * Handles loading and caching of SQL files for performance optimization
 */
export class SqlQueryLoader {
    private queries: Map<string, string> = new Map();
    private readonly sqlDirectory: string;

    constructor(sqlDirectory: string = './sql') {
        this.sqlDirectory = sqlDirectory;
    }

    /**
     * Load all SQL queries at startup for optimal performance
     * This prevents file I/O during query execution
     */
    public loadAllQueries(): void {
        const queryFiles = [
            'find-todos.sql',
            'count-todos.sql',
            'find-todo-with-relations.sql',
            'connection-test.sql'
        ];

        queryFiles.forEach(filename => {
            const queryName = this.getQueryName(filename);
            const sqlContent = this.loadSqlFile(filename);
            this.queries.set(queryName, sqlContent);
        });

        console.log(`📁 Loaded ${queryFiles.length} SQL queries into memory cache`);
    }

    /**
     * Get SQL query from memory cache
     * Returns immediately without file I/O after initial load
     */
    public getQuery(queryName: string): string {
        const sql = this.queries.get(queryName);
        if (!sql) {
            throw new Error(`SQL query not found: ${queryName}. Available queries: ${Array.from(this.queries.keys()).join(', ')}`);
        }
        return sql;
    }

    /**
     * Load SQL file synchronously (used during startup only)
     */
    private loadSqlFile(filename: string): string {
        try {
            const filePath = join(__dirname, this.sqlDirectory, filename);
            return readFileSync(filePath, 'utf8').trim();
        } catch (error) {
            throw new Error(`Failed to load SQL file ${filename}: ${error}`);
        }
    }

    /**
     * Convert filename to query name
     * Example: 'find-todos.sql' -> 'findTodos'
     */
    private getQueryName(filename: string): string {
        return filename
            .replace('.sql', '')
            .replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    }

    /**
     * Get all available query names for debugging
     */
    public getAvailableQueries(): string[] {
        return Array.from(this.queries.keys());
    }

    /**
     * Clear cache (useful for testing)
     */
    public clearCache(): void {
        this.queries.clear();
    }
}

// Singleton instance for application-wide use
export const sqlLoader = new SqlQueryLoader();
