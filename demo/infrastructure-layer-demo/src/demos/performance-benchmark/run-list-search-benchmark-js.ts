/**
 * Runner for List Search Benchmark
 * 
 * Sets up database connections and executes the list search performance tests
 */

import { Client } from 'pg';
import { PrismaClient } from '@prisma/client';
import { PrismaTodoRepository } from '../../infrastructure/prisma-infrastructure.js';
import { RawSQLTodoRepository } from '../../infrastructure/rawsql-infrastructure.js';
import { DemoSqlLogger } from '../../contracts/sql-logger.js';
import { ListSearchBenchmarkJS } from './list-search-benchmark-js.js';

/**
 * Database configuration
 */
const dbConfig = {
    host: 'localhost',
    port: 5433,
    database: 'infrastructure_demo',
    user: 'demo_user',
    password: 'demo_password'
};

/**
 * Main benchmark execution function
 */
async function runListSearchBenchmark(): Promise<void> {
    console.log('🚀 Initializing List Search Benchmark Environment\n');

    // Create database connections
    const pgClient = new Client(dbConfig);
    const prismaClient = new PrismaClient();

    try {
        // Connect to PostgreSQL
        console.log('📡 Connecting to PostgreSQL...');
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

        // Pre-load queries into memory
        console.log('📁 Loading SQL queries into memory cache...');
        rawSqlRepo.buildSearchQuery({ status: 'pending' }); // Pre-load
        console.log('📁 Loaded queries into memory cache');

        console.log('🎯 Starting List Search Performance Benchmarks...');
        console.log('\n📊 Testing findByCriteria operations for various search patterns\n');

        // Create benchmark context
        const benchmarkContext = {
            pgClient,
            prismaClient,
            rawSqlRepo,
            prismaRepo
        };

        // Run benchmarks
        const benchmark = new ListSearchBenchmarkJS(benchmarkContext);
        await benchmark.runBenchmarks();

        console.log('\n🎉 All benchmarks completed successfully!');

    } catch (error) {
        console.error('❌ Benchmark execution failed:', error);
        process.exit(1);
    } finally {
        // Cleanup connections
        try {
            console.log('🔌 PostgreSQL connection closed');
            await pgClient.end();
        } catch (error) {
            console.error('⚠️ Error closing PostgreSQL connection:', error);
        }

        try {
            console.log('🔌 Prisma connection closed');
            await prismaClient.$disconnect();
        } catch (error) {
            console.error('⚠️ Error closing Prisma connection:', error);
        }
    }
}

/**
 * Script execution entry point
 */
runListSearchBenchmark()
    .then(() => {
        console.log('\n✨ List Search Benchmark runner finished');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n💥 List Search Benchmark runner failed:', error);
        process.exit(1);
    });

export { runListSearchBenchmark };
