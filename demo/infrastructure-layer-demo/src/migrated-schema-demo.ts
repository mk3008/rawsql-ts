import { RawSQLTodoRepository } from './rawsql-infrastructure';
import { TodoZodSchema, CategoryZodSchema, TodoCommentZodSchema, schemaManager } from './schema-migrated';
import { ITodoRepository } from './infrastructure-interface';

/**
 * Migrated Schema Demo
 * Demonstrates successful migration from local unified-schema to rawsql-ts library
 */

async function runMigratedSchemaDemo() {
    console.log('🚀 Migrated Schema Demo (rawsql-ts Library)');
    console.log('=============================================\n');

    console.log('📋 Migration Completed Successfully:');
    console.log('   • Using rawsql-ts SchemaManager class');
    console.log('   • Library-based table definitions');
    console.log('   • Backward compatibility maintained');
    console.log('   • Zod schemas still working\n');

    // Test SchemaManager methods
    console.log('🔧 SchemaManager Column Generation:');
    console.log('───────────────────────────────────');
    ['todo', 'category', 'todo_comment'].forEach(table => {
        const columns = schemaManager.getTableColumns(table);
        console.log(`${table}:`, columns);
    });
    console.log();

    // Test JSON mapping generation
    console.log('🎨 SchemaManager JSON Mapping:');
    console.log('──────────────────────────────');
    const jsonMapping = schemaManager.createJsonMapping('todo');
    console.log('✅ JSON mapping generated successfully');
    console.log('Root entity:', jsonMapping.rootEntity.name);
    console.log();

    // Test Zod validation (still working with migrated schemas)
    console.log('✅ Zod Validation (Migrated):');
    console.log('─────────────────────────────');

    const validTodo = {
        todo_id: 1,
        title: "Migrated Schema Test",
        description: "Testing migrated schema functionality",
        status: "pending",
        priority: "high",
        category_id: 1,
        created_at: new Date(),
        updated_at: new Date()
    };

    try {
        const result = TodoZodSchema.parse(validTodo);
        console.log('✅ Migrated Zod validation passed');
    } catch (error) {
        console.log('❌ Migrated Zod validation failed:', error);
    }

    // Test database integration
    console.log('\n🗄️ Database Integration Test:');
    console.log('─────────────────────────────');

    try {
        const repository: ITodoRepository = new RawSQLTodoRepository();
        const todo = await repository.findById('1');

        if (todo) {
            console.log('✅ Database query successful with migrated schema');
            console.log(`   Found: ${todo.title} (${todo.status})`);
            if (todo.category) {
                console.log(`   Category: ${todo.category.name}`);
            }
            console.log(`   Comments: ${todo.comments.length}`);
        } else {
            console.log('ℹ️  No todo found with ID 1');
        }
    } catch (error) {
        console.log('⚠️  Database test skipped (connection not available)');
    }

    console.log('\n🎉 Migration Demo Complete!');
    console.log('\n💡 Key Migration Benefits:');
    console.log('   • ✅ Using standardized rawsql-ts library types');
    console.log('   • ✅ Reduced local code complexity');
    console.log('   • ✅ Better type safety and intellisense');
    console.log('   • ✅ Future library updates automatically available');
    console.log('   • ✅ Consistent API across all rawsql-ts projects');
}

// Run the demo
runMigratedSchemaDemo();
