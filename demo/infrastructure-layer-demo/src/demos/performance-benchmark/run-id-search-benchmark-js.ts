/**
 * Runner for ID Search Benchmark using benchmark.js
 */

import { Client } from 'pg';
import { PrismaClient } from '@prisma/client';
import { PrismaTodoRepository } from '../../infrastructure/prisma-infrastructure.js';
import { RawSQLTodoRepository } from '../../infrastructure/rawsql-infrastructure.js';
import { DemoSqlLogger } from '../../contracts/sql-logger.js';
import { IdSearchBenchmarkJS } from './id-search-benchmark-js.js';

// Database configuration
const DATABASE_CONFIG = {
    user: 'demo_user',
    host: 'localhost',
    database: 'infrastructure_demo',
    password: 'demo_password',
    port: 5433,
    connectionTimeoutMillis: 10000,
};

async function main() {
    console.log('🔧 Initializing database connections for benchmark.js test...');

    // Initialize database connections
    const pgClient = new Client(DATABASE_CONFIG);
    const prismaClient = new PrismaClient();

    try {
        await pgClient.connect();
        // Initialize repositories
        const sqlLogger = new DemoSqlLogger();
        const rawSqlRepo = new RawSQLTodoRepository(false, undefined, sqlLogger);
        const prismaRepo = new PrismaTodoRepository(false);

        console.log('✅ Database connections established');

        // Test connections
        console.log('🧪 Testing connections...');
        await pgClient.query('SELECT 1 as test');
        await prismaClient.$queryRaw`SELECT 1 as test`;
        console.log('✅ Connections verified');

        // Load queries into memory
        console.log('📁 Loading SQL queries into memory cache...');
        rawSqlRepo.generateFindByIdQuery('1'); // Pre-load
        console.log('📁 Loaded queries into memory cache');

        console.log('🎯 Starting benchmark.js ID search test...');
        console.log('\n📊 This will compare results with our custom benchmark\n');

        // Run benchmark
        const benchmark = new IdSearchBenchmarkJS({
            pgClient,
            prismaClient,
            rawSqlRepo,
            prismaRepo
        });

        await benchmark.runBenchmark();

        console.log('\n✅ benchmark.js test completed successfully!');

    } catch (error) {
        console.error('❌ Benchmark failed:', error);
        process.exit(1);
    } finally {
        // Clean up connections
        try {
            console.log('🔌 PostgreSQL connection closed');
            await pgClient.end();
        } catch (error) {
            console.error('Warning: Error closing PostgreSQL connection:', error);
        }

        try {
            console.log('🔌 Prisma connection closed');
            await prismaClient.$disconnect();
        } catch (error) {
            console.error('Warning: Error closing Prisma connection:', error);
        }
    }
}

main().catch(console.error);
