import { RawSQLTodoRepository } from './rawsql-infrastructure';
import { ITodoRepository } from './infrastructure-interface';
import { exampleCriteria, Todo } from './domain';

/**
 * rawsql-ts Infrastructure Layer DTO Pattern Demo with Real PostgreSQL Database
 * 
 * This demo showcases how rawsql-ts enables clean separation between 
 * domain and infrastructure layers using the DTO pattern with real database operations.
 */

async function runDemo() {
    console.log('🎯 rawsql-ts Infrastructure Layer DTO Pattern Demo (Real PostgreSQL)');
    console.log('================================================================\n');    // Using interface for clean architecture (DI would be used in real apps)
    const todoRepository: ITodoRepository = new RawSQLTodoRepository();

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
        // Demo each example criteria with real database queries
        for (let index = 0; index < exampleCriteria.length; index++) {
            const criteria = exampleCriteria[index];

            console.log(`📋 Example ${index + 1}: ${getExampleDescription(index)}`);
            console.log('─'.repeat(50));

            // Show original domain criteria
            console.log('🏛️  Domain Criteria:');
            console.log(JSON.stringify(criteria, null, 2));
            console.log();            // Build query using rawsql-ts (for display purposes)
            // Cast to concrete implementation for demo-specific methods
            const rawSqlRepo = todoRepository as RawSQLTodoRepository;
            const queryResult = rawSqlRepo.buildSearchQuery(criteria);
            const searchState = rawSqlRepo.convertToSearchState(criteria);

            // Show DTO transformation
            console.log('🔧 Infrastructure State (DTO):');
            console.log(JSON.stringify(searchState, null, 2));
            console.log();

            // Show generated SQL and parameters before execution
            console.log('🔍 Generated SQL:');
            console.log(`   ${queryResult.formattedSql.replace(/\s+/g, ' ').trim()}`);
            console.log();

            console.log('⚙️  Parameters:');
            console.log(`   ${JSON.stringify(queryResult.params)}`);
            console.log();            // Execute real database query using repository interface
            console.log('💾 Executing against PostgreSQL database...');
            const todos = await todoRepository.findByCriteria(criteria);
            const count = await todoRepository.countByCriteria(criteria);// Show results
            console.log(`📊 Query Results: Found ${count} todos`);
            todos.slice(0, 3).forEach((todo: Todo, i: number) => {
                console.log(`   ${i + 1}. ${todo.title} (${todo.status}, ${todo.priority})`);
            });
            if (todos.length > 3) {
                console.log(`   ... and ${todos.length - 3} more`);
            }
            console.log(); console.log('✨ rawsql-ts Benefits Demonstrated:');
            console.log('   • Automatic WHERE clause injection');
            console.log('   • Type-safe parameter binding');
            console.log('   • Clean domain-infrastructure separation');
            console.log('   • Dynamic query building without string concatenation');
            console.log('   • Real database execution with connection pooling');
            console.log();
            console.log('═'.repeat(70));
            console.log();
        }

        console.log('🎉 Demo completed successfully!');
        console.log('💡 Key Takeaways:');
        console.log('   • DTO pattern enables clean architecture');
        console.log('   • rawsql-ts handles SQL complexity automatically');
        console.log('   • Domain logic stays pure and testable');
        console.log('   • Infrastructure layer is reusable and maintainable');
        console.log('   • Real database operations work seamlessly');

    } catch (error) {
        console.error('❌ Demo failed:', error instanceof Error ? error.message : 'Unknown error');
    } finally {
        // Clean up database connection
        await (todoRepository as RawSQLTodoRepository).close();
        console.log('👋 Database connection closed');
    }
}

function getExampleDescription(index: number): string {
    const descriptions = [
        'Empty criteria (all records)',
        'Title search with LIKE pattern',
        'Status filter (exact match)',
        'Priority filter (exact match)',
        'Date range search',
        'Single date boundary',
        'Complex multi-field search'
    ];
    return descriptions[index] || 'Unknown example';
}

// Run the demo
runDemo().catch(console.error);
