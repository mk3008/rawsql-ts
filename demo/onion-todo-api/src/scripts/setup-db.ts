import { Pool } from 'pg';
import { DatabaseConnection, defaultDatabaseConfig } from '../infrastructure/DatabaseConnection';

/**
 * Database setup script
 * This script can be used to verify database connection and setup
 */
async function setupDatabase() {
    console.log('🔧 Setting up database...');

    let dbConnection: DatabaseConnection | null = null;

    try {
        // Initialize database connection
        dbConnection = new DatabaseConnection(defaultDatabaseConfig);
        const pool = dbConnection.getPool();

        // Test connection
        console.log('📡 Testing database connection...');
        await pool.query('SELECT 1 as test');
        console.log('✅ Database connection successful');

        // Check if todos table exists
        console.log('🔍 Checking if todos table exists...');
        const tableResult = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'todos'
      );
    `);

        if (tableResult.rows[0].exists) {
            console.log('✅ Todos table exists');

            // Check sample data
            const countResult = await pool.query('SELECT COUNT(*) as count FROM todos');
            console.log(`📊 Found ${countResult.rows[0].count} todos in database`);

            // Show sample todos
            const sampleResult = await pool.query(`
        SELECT id, title, status, priority, created_at 
        FROM todos 
        ORDER BY created_at DESC 
        LIMIT 5
      `);

            console.log('📝 Sample todos:');
            sampleResult.rows.forEach(row => {
                console.log(`  - ${row.id}: ${row.title} (${row.status}, ${row.priority})`);
            });

        } else {
            console.log('❌ Todos table does not exist');
            console.log('💡 Please run docker-compose up to initialize the database');
        }

        console.log('🎉 Database setup completed successfully');

    } catch (error) {
        console.error('❌ Database setup failed:', error);

        if (error instanceof Error) {
            if (error.message.includes('ECONNREFUSED')) {
                console.log('💡 Make sure PostgreSQL is running: docker-compose up -d');
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

// Run setup if this script is executed directly
if (require.main === module) {
    setupDatabase().catch((error) => {
        console.error('💥 Setup script failed:', error);
        process.exit(1);
    });
}

export { setupDatabase };
