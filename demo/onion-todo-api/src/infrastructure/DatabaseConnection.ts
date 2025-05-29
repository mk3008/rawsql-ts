import { Pool, PoolConfig } from 'pg';

/**
 * Database configuration
 */
export interface DatabaseConfig {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
    max?: number;
    idleTimeoutMillis?: number;
    connectionTimeoutMillis?: number;
}

/**
 * Database connection pool manager
 */
export class DatabaseConnection {
    private pool: Pool;

    constructor(config: DatabaseConfig) {
        const poolConfig: PoolConfig = {
            host: config.host,
            port: config.port,
            database: config.database,
            user: config.user,
            password: config.password,
            max: config.max || 10,
            idleTimeoutMillis: config.idleTimeoutMillis || 30000,
            connectionTimeoutMillis: config.connectionTimeoutMillis || 2000,
        };

        this.pool = new Pool(poolConfig);
    }

    /**
     * Get the database pool
     */
    getPool(): Pool {
        return this.pool;
    }

    /**
     * Close all connections in the pool
     */
    async close(): Promise<void> {
        await this.pool.end();
    }
}

/**
 * Default database configuration for demo
 */
export const defaultDatabaseConfig: DatabaseConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'todoapp',
    user: process.env.DB_USER || 'todouser',
    password: process.env.DB_PASSWORD || 'todopass',
};
