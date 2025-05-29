import { DatabaseConnection, defaultDatabaseConfig } from '../infrastructure/DatabaseConnection';
import { PostgresTodoRepository } from '../infrastructure/PostgresTodoRepository';
import { SearchTodosUseCase } from '../application/SearchTodosUseCase';
import { TodoSearchCriteria } from '../domain/Todo';

/**
 * Demo script to showcase the todo search functionality
 * This demonstrates the onion architecture in action
 */
async function runDemo() {
    console.log('🎯 Running Onion Todo API Demo...\n');

    let dbConnection: DatabaseConnection | null = null;

    try {
        // Initialize dependencies (following onion architecture)
        console.log('🔧 Initializing dependencies...');
        dbConnection = new DatabaseConnection(defaultDatabaseConfig);
        const pool = dbConnection.getPool();

        // Infrastructure layer
        const todoRepository = new PostgresTodoRepository(pool);

        // Application layer
        const searchTodosUseCase = new SearchTodosUseCase(todoRepository);

        console.log('✅ Dependencies initialized\n');

        // Demo 1: Search all todos
        console.log('📋 Demo 1: Search all todos');
        const allTodos = await searchTodosUseCase.execute({});
        console.log(`Found ${allTodos.length} todos:`);
        allTodos.slice(0, 3).forEach(todo => {
            console.log(`  - ${todo.title} (${todo.status}, ${todo.priority})`);
        });
        console.log('');

        // Demo 2: Search by status
        console.log('🔍 Demo 2: Search pending todos');
        const pendingCriteria: TodoSearchCriteria = { status: 'pending' };
        const pendingTodos = await searchTodosUseCase.execute(pendingCriteria);
        console.log(`Found ${pendingTodos.length} pending todos:`);
        pendingTodos.slice(0, 3).forEach(todo => {
            console.log(`  - ${todo.title} (${todo.priority})`);
        });
        console.log('');

        // Demo 3: Search by priority
        console.log('⚡ Demo 3: Search high priority todos');
        const highPriorityCriteria: TodoSearchCriteria = { priority: 'high' };
        const highPriorityTodos = await searchTodosUseCase.execute(highPriorityCriteria);
        console.log(`Found ${highPriorityTodos.length} high priority todos:`);
        highPriorityTodos.forEach(todo => {
            console.log(`  - ${todo.title} (${todo.status})`);
        });
        console.log('');

        // Demo 4: Search by title
        console.log('🔎 Demo 4: Search todos containing "プレゼン"');
        const titleCriteria: TodoSearchCriteria = { title: 'プレゼン' };
        const titleTodos = await searchTodosUseCase.execute(titleCriteria);
        console.log(`Found ${titleTodos.length} todos matching title:`);
        titleTodos.forEach(todo => {
            console.log(`  - ${todo.title}`);
        });
        console.log('');

        // Demo 5: Complex search
        console.log('🎯 Demo 5: Complex search (pending + high priority)');
        const complexCriteria: TodoSearchCriteria = {
            status: 'pending',
            priority: 'high'
        };
        const complexTodos = await searchTodosUseCase.execute(complexCriteria);
        console.log(`Found ${complexTodos.length} pending high priority todos:`);
        complexTodos.forEach(todo => {
            console.log(`  - ${todo.title}`);
        });
        console.log('');

        // Demo 6: Date range search
        console.log('📅 Demo 6: Search todos from last 7 days');
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        const dateCriteria: TodoSearchCriteria = {
            fromDate: weekAgo
        };
        const recentTodos = await searchTodosUseCase.execute(dateCriteria);
        console.log(`Found ${recentTodos.length} todos from last 7 days:`);
        recentTodos.slice(0, 3).forEach(todo => {
            console.log(`  - ${todo.title} (created: ${todo.createdAt.toDateString()})`);
        });

        console.log('\n🎉 Demo completed successfully!');
        console.log('💡 Try starting the API server with: npm run dev');

    } catch (error) {
        console.error('\n❌ Demo failed:', error);

        if (error instanceof Error) {
            if (error.message.includes('ECONNREFUSED')) {
                console.log('💡 Make sure PostgreSQL is running: docker-compose up -d');
            } else if (error.message.includes('relation "todos" does not exist')) {
                console.log('💡 Make sure to initialize the database: docker-compose up -d');
            }
        }

        process.exit(1);
    } finally {
        if (dbConnection) {
            await dbConnection.close();
            console.log('👋 Database connection closed');
        }
    }
}

// Run demo if this script is executed directly
if (require.main === module) {
    runDemo().catch((error) => {
        console.error('💥 Demo script failed:', error);
        process.exit(1);
    });
}

export { runDemo };
