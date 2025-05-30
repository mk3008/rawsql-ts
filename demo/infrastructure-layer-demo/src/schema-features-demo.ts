import { TodoZodSchema, CategoryZodSchema, TodoCommentZodSchema, schemaManager } from './schema-migrated';

/**
 * Schema Features Demo
 * Comprehensive demonstration of rawsql-ts schema management capabilities
 * Focuses on schema features without database integration
 */

async function runSchemaFeaturesDemo() {
    console.log('🛠️ Schema Features Demo');
    console.log('========================\n');

    console.log('🎯 Demonstrating rawsql-ts Schema Management Features\n');

    // Feature 1: Automatic Column List Generation
    console.log('🔧 Feature 1: Automatic Column List Generation');
    console.log('─'.repeat(50));
    console.log('Purpose: Generate column lists for SqlParamInjector');
    console.log('Tables: todo, category, todo_comment\n');

    ['todo', 'category', 'todo_comment'].forEach(table => {
        const columns = schemaManager.getTableColumns(table);
        console.log(`📊 ${table.toUpperCase()}:`);
        console.log(`   Columns: [${columns.join(', ')}]`);
        console.log(`   Count: ${columns.length} columns`);
    });
    console.log();

    // Feature 2: JSON Mapping Generation
    console.log('🎨 Feature 2: Automatic JSON Mapping Generation');
    console.log('─'.repeat(50));
    console.log('Purpose: Generate PostgresJsonQueryBuilder mappings');
    console.log('Testing hierarchical relationship mapping...\n');

    const todoMapping = schemaManager.createJsonMapping('todo');
    console.log('📋 Todo Mapping Structure:');
    console.log(`   Root Entity: ${todoMapping.rootEntity.name}`);
    console.log(`   Root Columns: ${todoMapping.rootEntity.columns.length}`);
    console.log('   Nested Entities:');
    todoMapping.nestedEntities.forEach((entity: any) => {
        console.log(`     • ${entity.name} (${entity.relationshipType})`);
        console.log(`       Columns: ${entity.columns.length}`);
    });
    console.log();

    // Feature 3: Multiple Table Mapping Comparison
    console.log('🔍 Feature 3: Multi-Table Mapping Analysis');
    console.log('─'.repeat(50));
    console.log('Comparing mapping complexity across tables...\n');

    ['todo', 'category', 'todo_comment'].forEach(table => {
        const mapping = schemaManager.createJsonMapping(table);
        console.log(`📈 ${table.toUpperCase()} Mapping:`)
        console.log(`   Complexity: ${mapping.nestedEntities.length} nested entities`);
        console.log(`   Root columns: ${mapping.rootEntity.columns.length}`);
    });
    console.log();

    // Feature 4: Comprehensive Zod Validation Testing
    console.log('✅ Feature 4: Zod Validation Framework');
    console.log('─'.repeat(50));
    console.log('Testing data validation with various scenarios...\n');

    // Test Case 1: Valid data for all schemas
    console.log('🧪 Test Case 1: Valid Data Validation');
    const validTodo = {
        todo_id: 1,
        title: "Schema Test Todo",
        description: "Testing schema validation features",
        status: "pending",
        priority: "high",
        category_id: 1,
        created_at: new Date(),
        updated_at: new Date()
    }; const validCategory = {
        category_id: 1,
        name: "Test Category",
        description: "A test category",
        color: "blue",
        created_at: new Date()
    }; const validComment = {
        todo_comment_id: 1,
        todo_id: 1,
        content: "This is a test comment",
        author_name: "Test Author",
        created_at: new Date()
    };

    try {
        TodoZodSchema.parse(validTodo);
        CategoryZodSchema.parse(validCategory);
        TodoCommentZodSchema.parse(validComment);
        console.log('   ✅ All valid data passed validation');
    } catch (error) {
        console.log('   ❌ Unexpected validation failure:', error);
    }

    // Test Case 2: Invalid data scenarios
    console.log('\n🧪 Test Case 2: Invalid Data Handling');

    const invalidTodo = {
        todo_id: 1,
        // title missing - required field
        description: "Invalid todo without title",
        status: "invalid_status", // invalid enum value
        priority: "high"
    };

    try {
        TodoZodSchema.parse(invalidTodo);
        console.log('   ❌ Invalid data unexpectedly passed');
    } catch (error) {
        console.log('   ✅ Invalid data correctly rejected');
        console.log('   📝 Validation ensures data integrity');
    }

    // Test Case 3: Type coercion and transformation
    console.log('\n🧪 Test Case 3: Type Safety Features');
    console.log('   • Automatic type coercion');
    console.log('   • Date object validation');
    console.log('   • Enum value restrictions');
    console.log('   • Required field enforcement');

    console.log('\n🎉 Schema Features Demo Complete!');
    console.log('\n📊 Feature Summary:');
    console.log('   ✅ Column List Generation - Automated for SqlParamInjector');
    console.log('   ✅ JSON Mapping Generation - Automated for PostgresJsonQueryBuilder');
    console.log('   ✅ Multi-Table Support - Consistent API across all tables');
    console.log('   ✅ Zod Validation - Runtime type safety and data validation');
    console.log('   ✅ Type Safety - Full TypeScript integration');

    console.log('\n💡 Integration Benefits:');
    console.log('   • Single source of truth eliminates configuration drift');
    console.log('   • Automatic generation reduces manual errors');
    console.log('   • Type safety catches issues at compile time');
    console.log('   • Validation ensures runtime data integrity');
    console.log('   • Easy to extend with new tables or modify existing ones');
}

// Run demo if executed directly
if (require.main === module) {
    runSchemaFeaturesDemo().catch(console.error);
}

export { runSchemaFeaturesDemo };
