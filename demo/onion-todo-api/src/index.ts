import { serve } from '@hono/node-server';
import { DatabaseConnection, defaultDatabaseConfig } from './infrastructure/DatabaseConnection';
import { PostgresTodoRepository } from './infrastructure/PostgresTodoRepository';
import { SearchTodosUseCase } from './application/SearchTodosUseCase';
import { TodoController } from './presentation/TodoController';

/**
 * Application entry point
 * This file demonstrates the dependency injection for onion architecture
 */
async function main() {
    console.log('🚀 Starting Onion Todo API...');

    try {
        // Initialize database connection
        console.log('📦 Connecting to PostgreSQL database...');
        const dbConnection = new DatabaseConnection(defaultDatabaseConfig);
        const pool = dbConnection.getPool();

        // Test database connection
        await pool.query('SELECT 1');
        console.log('✅ Database connection established');

        // Initialize repository layer (Infrastructure)
        const todoRepository = new PostgresTodoRepository(pool);

        // Initialize use case layer (Application)
        const searchTodosUseCase = new SearchTodosUseCase(todoRepository);

        // Initialize controller layer (Presentation)
        const todoController = new TodoController(searchTodosUseCase);
        const app = todoController.getApp();

        // Start the server
        const port = parseInt(process.env.PORT || '3000');

        console.log(`🌐 Starting server on port ${port}...`);

        serve({
            fetch: app.fetch,
            port: port,
        });

        console.log(`✨ Server is running on http://localhost:${port}`);
        console.log(`📖 API documentation: http://localhost:${port}/docs`);
        console.log(`❤️ Health check: http://localhost:${port}/health`);
        console.log(`🔍 Search todos: http://localhost:${port}/todos/search`);

        // Graceful shutdown
        process.on('SIGINT', async () => {
            console.log('\n🛑 Shutting down gracefully...');
            await dbConnection.close();
            console.log('👋 Goodbye!');
            process.exit(0);
        });

    } catch (error) {
        console.error('❌ Failed to start application:', error);
        process.exit(1);
    }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('💥 Uncaught Exception:', error);
    process.exit(1);
});

// Start the application
main().catch((error) => {
    console.error('💥 Failed to start application:', error);
    process.exit(1);
});
