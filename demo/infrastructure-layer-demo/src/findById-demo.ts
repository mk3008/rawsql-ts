import { RawSQLTodoRepository } from './rawsql-infrastructure';
import { ITodoRepository } from './infrastructure-interface';
import { TodoDetail } from './domain';

/**
 * rawsql-ts Enhanced findById Demo
 * Showcases SqlParamInjector + PostgresJsonQueryBuilder integration
 */

async function runFindByIdDemo() {
    console.log('🎯 rawsql-ts Enhanced findById Demo');
    console.log('==========================================\n');

    // Initialize repository with debug logging
    const todoRepository: ITodoRepository = new RawSQLTodoRepository(true);

    // Test database connection
    console.log('🔌 Testing database connection...');
    const isConnected = await (todoRepository as RawSQLTodoRepository).testConnection();

    if (!isConnected) {
        console.log('❌ Database connection failed. Start Docker container:');
        console.log('   docker-compose up -d');
        process.exit(1);
    }

    console.log('✅ Database connected!\n'); try {
        // Test Case 1: Find existing todo with related data
        console.log('📋 Test Case 1: Find Todo with Related Data');
        console.log('─'.repeat(50));
        console.log('🔍 Searching for todo ID: 1');
        console.log('📝 Expected: Hierarchical JSON with category and comments\n');

        const todoDetail = await todoRepository.findById('1');

        if (todoDetail) {
            console.log('✅ Todo found!');
            console.log('📊 TodoDetail Structure:');
            console.log(JSON.stringify(todoDetail, null, 2));
            console.log();

            console.log('🎯 Key Features Demonstrated:');
            console.log('   • SqlParamInjector: Automatic WHERE clause generation');
            console.log('   • PostgresJsonQueryBuilder: Hierarchical JSON structure');
            console.log('   • Single query: Todo + Category + Comments');
            console.log('   • Type-safe result: TodoDetail interface\n');
        } else {
            console.log('❌ Todo not found');
        }        // Test Case 2: Find non-existing todo
        console.log('📋 Test Case 2: Find Non-Existing Todo');
        console.log('─'.repeat(50));
        console.log('🔍 Searching for todo ID: 999\n');

        const nonExistentTodo = await todoRepository.findById('999');

        if (nonExistentTodo === null) {
            console.log('✅ Correctly returned null for non-existent todo');
            console.log('🎯 Null handling verified\n');
        } else {
            console.log('❌ Unexpected result for non-existent todo\n');
        }

        // Test Case 3: Multiple todos comparison
        const testIds = ['2', '3'];
        console.log('📋 Test Case 3: Multiple Todos Structure Comparison');
        console.log('─'.repeat(50));

        for (const id of testIds) {
            console.log(`🔍 Todo ID: ${id}`);
            const todo = await todoRepository.findById(id);

            if (todo) {
                console.log(`   ✅ "${todo.title}" (${todo.status}, ${todo.priority})`);
                console.log(`   📂 Category: ${todo.category?.name || 'None'}`);
                console.log(`   💬 Comments: ${todo.comments?.length || 0}`);
            } else {
                console.log(`   ❌ Not found`);
            }
            console.log();
        }

        console.log('🎉 Demo completed successfully!');
        console.log('\n💡 Architecture Benefits:');
        console.log('   • Clean separation: domain vs infrastructure');
        console.log('   • Automatic SQL with type safety');
        console.log('   • Single query for hierarchical data');
        console.log('   • Configurable debug logging');

        // Debug logging control example
        console.log('\n🛠️ Debug Logging Control:');
        console.log('   const repo = new RawSQLTodoRepository(true);  // Enable');
        console.log('   repo.setDebugLogging(false);                  // Disable');

    } catch (error) {
        console.error('❌ Demo failed:', error);
    } finally {
        await (todoRepository as RawSQLTodoRepository).close();
        console.log('\n👋 Database connection closed');
    }
}

// Run demo if executed directly
if (require.main === module) {
    runFindByIdDemo().catch(console.error);
}

export { runFindByIdDemo };
