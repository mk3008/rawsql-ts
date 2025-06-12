/**
 * Main test runner for comparing different TODO implementation approaches
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
    log: ['query', 'info', 'warn', 'error'],
});

/**
 * Run all tests and generate comparison report
 */
async function runAllTests() {
    console.log('🚀 Prisma Comparison Demo - Test Runner');
    console.log('='.repeat(60));
    console.log('Testing different approaches for TODO search and detail retrieval');
    console.log('');

    try {
        // Test database connection
        console.log('🔌 Testing database connection...');
        await prisma.$connect();
        console.log('✅ Database connected successfully');        // Import and run search tests
        console.log('\n' + '='.repeat(60));
        console.log('🔍 Running Search Tests...');
        const { runSearchTests } = await import('./search-test');
        await runSearchTests();

        // Import and run detail tests  
        console.log('\n' + '='.repeat(60));
        console.log('📋 Running Detail Tests...');
        const { runDetailTests } = await import('./detail-test');
        await runDetailTests();

        console.log('\n' + '='.repeat(60));
        console.log('🎉 All tests completed!');
        console.log('');
        console.log('📊 Next steps:');
        console.log('   1. Implement TypedSQL approach');
        console.log('   2. Implement rawsql-ts approach');
        console.log('   3. Run performance comparison');
        console.log('   4. Generate detailed report');

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

// Export test functions for use in other modules
export { runSearchTestsIndividual as runSearchTests, runDetailTestsIndividual as runDetailTests };

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
