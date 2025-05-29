import { RawSQLTodoRepository } from './rawsql-infrastructure';
import { ITodoRepository } from './infrastructure-interface';
import { TodoDetail } from './domain';

/**
 * rawsql-ts Enhanced findById Demo with PostgresJsonQueryBuilder and SqlParamInjector
 * 
 * This demo showcases the enhanced findById method that uses:
 * - SqlParamInjector for automatic WHERE clause generation
 * - PostgresJsonQueryBuilder for hierarchical JSON structure
 * - Real PostgreSQL database operations
 */

async function runFindByIdDemo() {
    console.log('🎯 rawsql-ts Enhanced findById Demo with PostgresJsonQueryBuilder');
    console.log('================================================================\n');

    // Initialize repository with debug logging enabled for demonstration
    const todoRepository: ITodoRepository = new RawSQLTodoRepository(true); // Enable debug logging

    // Test database connection first
    console.log('🔌 Testing database connection...');
    const isConnected = await (todoRepository as RawSQLTodoRepository).testConnection();

    if (!isConnected) {
        console.log('❌ Failed to connect to database. Please ensure Docker container is running:');
        console.log('   docker-compose up -d');
        process.exit(1);
    }

    console.log('✅ Database connection successful!\n');

    try {
        // Test Case 1: Find existing todo with all related data
        console.log('📋 Test Case 1: Find Todo by ID with Related Data');
        console.log('─'.repeat(60));
        console.log('🔍 Searching for todo ID: 1');
        console.log('📝 Expected: Todo with category and comments in hierarchical JSON structure');
        console.log();

        const todoDetail = await todoRepository.findById('1');

        if (todoDetail) {
            console.log('✅ Todo found successfully!');
            console.log('📊 TodoDetail Structure:');
            console.log(JSON.stringify(todoDetail, null, 2));
            console.log();

            console.log('🎯 Key Benefits Demonstrated:');
            console.log('   • SqlParamInjector automatically generated WHERE clause');
            console.log('   • PostgresJsonQueryBuilder created hierarchical JSON');
            console.log('   • Single database query instead of multiple queries');
            console.log('   • Type-safe domain object returned');
            console.log('   • Zero manual JSON mapping required');
            console.log();
        } else {
            console.log('❌ Todo not found');
        }

        console.log('═'.repeat(60));
        console.log();

        // Test Case 2: Find non-existing todo
        console.log('📋 Test Case 2: Find Non-Existing Todo');
        console.log('─'.repeat(60));
        console.log('🔍 Searching for todo ID: 999');
        console.log('📝 Expected: null result');
        console.log();

        const nonExistentTodo = await todoRepository.findById('999');

        if (nonExistentTodo === null) {
            console.log('✅ Correctly returned null for non-existent todo');
            console.log('🎯 Proper null handling verified');
        } else {
            console.log('❌ Unexpected result for non-existent todo');
        }

        console.log();
        console.log('═'.repeat(60));
        console.log();

        // Test Case 3: Find multiple todos to show different structures
        const testIds = ['2', '3', '4'];
        console.log('📋 Test Case 3: Find Multiple Todos for Structure Comparison');
        console.log('─'.repeat(60));

        for (const id of testIds) {
            console.log(`🔍 Searching for todo ID: ${id}`);
            const todo = await todoRepository.findById(id);

            if (todo) {
                console.log(`   ✅ Found: "${todo.title}" (${todo.status}, ${todo.priority})`);
                console.log(`   📂 Category: ${todo.category?.name || 'None'}`);
                console.log(`   💬 Comments: ${todo.comments?.length || 0} comment(s)`);
            } else {
                console.log(`   ❌ Todo ${id} not found`);
            }
            console.log();
        }

        console.log('🎉 findById Demo completed successfully!');
        console.log('💡 Key Architecture Benefits:');
        console.log('   • Clean separation of concerns (domain vs infrastructure)');
        console.log('   • Automatic SQL generation with type safety');
        console.log('   • Hierarchical data fetching in single query');
        console.log('   • Domain objects without infrastructure dependencies');
        console.log('   • Reusable and maintainable code patterns');
        console.log('   • Configurable debug logging for development/production');

        // Demonstrate debug logging control
        console.log('\n🛠️ Debug Logging Control Example:');
        console.log('──────────────────────────────────');
        console.log('// Enable debug logging for development');
        console.log('const repo = new RawSQLTodoRepository(true);');
        console.log();
        console.log('// Disable debug logging for production');
        console.log('const repo = new RawSQLTodoRepository(false);');
        console.log();
        console.log('// Toggle during runtime');
        console.log('repo.setDebugLogging(false); // Disable logs');

    } catch (error) {
        console.error('❌ Demo failed:', error);
    } finally {
        // Close database connection
        await (todoRepository as RawSQLTodoRepository).close();
        console.log('👋 Database connection closed');
    }
}

// Run the demo if this file is executed directly
if (require.main === module) {
    runFindByIdDemo().catch(console.error);
}

export { runFindByIdDemo };
