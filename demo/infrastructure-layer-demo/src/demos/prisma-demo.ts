/**
 * Prisma Demo - Compare Prisma ORM approach with rawsql-ts approach
 * This demo showcases the architectural differences between ORM and SQL-first patterns
 */

import { PrismaTodoRepository } from '../infrastructure/prisma-infrastructure';
import { RawSQLTodoRepository } from '../infrastructure/rawsql-infrastructure';
import { TodoSearchCriteria } from '../contracts/search-criteria';

async function runPrismaVsRawSQLComparison() {
    console.log('🚀 Prisma vs RawSQL Architecture Comparison Demo');
    console.log('='.repeat(60));

    // Initialize both repositories for comparison
    const prismaRepo = new PrismaTodoRepository(true); // Enable debug logging
    const rawSqlRepo = new RawSQLTodoRepository(true); // Enable debug logging

    try {
        // Test connection for both approaches
        console.log('\n📡 Testing Database Connections:');
        console.log('-'.repeat(40));

        const prismaConnection = await prismaRepo.testConnection();
        const rawSqlConnection = await rawSqlRepo.testConnection();

        console.log(`Prisma Connection: ${prismaConnection ? '✅ Success' : '❌ Failed'}`);
        console.log(`RawSQL Connection: ${rawSqlConnection ? '✅ Success' : '❌ Failed'}`);

        if (!prismaConnection && !rawSqlConnection) {
            console.log('\n⚠️ No database connections available. Please ensure PostgreSQL is running.');
            return;
        }

        // Define test search criteria
        const searchCriteria: TodoSearchCriteria = {
            title: 'test',
            status: 'pending',
            priority: 'high'
        };

        console.log('\n🔍 Search Criteria Comparison:');
        console.log('-'.repeat(40));
        console.log('Searching for:', JSON.stringify(searchCriteria, null, 2));

        // Compare query generation approaches
        if (rawSqlConnection) {
            console.log('\n🛠️ RawSQL Approach - Query Generation:');
            console.log('-'.repeat(40));
            const rawSqlQuery = rawSqlRepo.buildSearchQuery(searchCriteria);
            console.log('Generated SQL:');
            console.log(rawSqlQuery.formattedSql);
            console.log('Parameters:', rawSqlQuery.params);
        }

        if (prismaConnection) {
            console.log('\n🎯 Prisma Approach - Query Object:');
            console.log('-'.repeat(40));
            await prismaRepo.showGeneratedQuery(searchCriteria);
        }

        // Performance comparison (if both connections work)
        if (prismaConnection && rawSqlConnection) {
            console.log('\n⚡ Performance Comparison:');
            console.log('-'.repeat(40));

            // RawSQL timing
            const rawSqlStart = performance.now();
            const rawSqlResults = await rawSqlRepo.findByCriteria(searchCriteria);
            const rawSqlEnd = performance.now();
            const rawSqlTime = rawSqlEnd - rawSqlStart;

            // Prisma timing
            const prismaStart = performance.now();
            const prismaResults = await prismaRepo.findByCriteria(searchCriteria);
            const prismaEnd = performance.now();
            const prismaTime = prismaEnd - prismaStart; console.log(`RawSQL Execution: ${rawSqlTime.toFixed(2)}ms - Found ${rawSqlResults.length} todos`);
            console.log(`Prisma Execution: ${prismaTime.toFixed(2)}ms - Found ${prismaResults.length} todos (MOCK)`);

            const faster = rawSqlTime < prismaTime ? 'RawSQL' : 'Prisma (MOCK)';
            const timeDiff = Math.abs(rawSqlTime - prismaTime).toFixed(2);
            console.log(`🏆 ${faster} was faster by ${timeDiff}ms`);

            console.log('\n📝 Note: Prisma results are mocked for demonstration.');
            console.log('   Install Prisma with: npm install @prisma/client prisma');
            console.log('   Then run: npm run prisma:generate && npm run prisma:push');
        }

        // Architecture comparison summary
        console.log('\n📋 Architecture Comparison Summary:');
        console.log('='.repeat(60));

        console.log('\n🔧 RawSQL Approach (rawsql-ts):');
        console.log('✅ Full SQL control and visibility');
        console.log('✅ Type-safe parameter injection');
        console.log('✅ Custom SQL formatting and optimization');
        console.log('✅ Zero ORM overhead');
        console.log('✅ Direct database schema mapping');
        console.log('⚠️ More manual query construction');
        console.log('⚠️ Requires SQL knowledge');

        console.log('\n🎯 Prisma Approach (ORM):');
        console.log('✅ Type-safe query building');
        console.log('✅ Automatic relation handling');
        console.log('✅ Built-in migration system');
        console.log('✅ Database introspection');
        console.log('✅ Developer-friendly API');
        console.log('⚠️ Less direct SQL control');
        console.log('⚠️ ORM abstraction layer overhead');
        console.log('⚠️ Generated code dependency');

        console.log('\n🎪 Use Cases:');
        console.log('📊 Choose RawSQL when:');
        console.log('   • Complex queries requiring SQL optimization');
        console.log('   • Performance is critical');
        console.log('   • Working with existing database schemas');
        console.log('   • Team has strong SQL expertise');

        console.log('\n🚀 Choose Prisma when:');
        console.log('   • Rapid development is priority');
        console.log('   • Team prefers type-safe abstractions');
        console.log('   • Database schema is evolving frequently');
        console.log('   • Strong TypeScript integration needed');

    } catch (error) {
        console.error('❌ Demo error:', error);
    } finally {
        // Clean up connections
        await prismaRepo.close();
        await rawSqlRepo.close();

        console.log('\n🔒 Connections closed');
        console.log('Demo completed! 🎉');
    }
}

// Advanced comparison scenarios
async function runAdvancedScenarios() {
    console.log('\n\n🧪 Advanced Architecture Scenarios:');
    console.log('='.repeat(60));

    const prismaRepo = new PrismaTodoRepository(false); // Disable logging for cleaner output
    const rawSqlRepo = new RawSQLTodoRepository(false);

    try {
        // Scenario 1: Complex date range queries
        console.log('\n📅 Scenario 1: Date Range Queries');
        console.log('-'.repeat(40));

        const dateRangeCriteria: TodoSearchCriteria = {
            fromDate: new Date('2024-01-01'),
            toDate: new Date('2024-12-31'),
            status: 'completed'
        };

        console.log('Searching for completed todos in 2024...');

        // Show how each approach handles date ranges
        if (await rawSqlRepo.testConnection()) {
            const rawSqlQuery = rawSqlRepo.buildSearchQuery(dateRangeCriteria);
            console.log('RawSQL handles dates via parameter injection with operators');
        }

        if (await prismaRepo.testConnection()) {
            console.log('Prisma handles dates via native Date objects in where clauses');
        }

        // Scenario 2: Nested relation queries
        console.log('\n🔗 Scenario 2: Nested Relations');
        console.log('-'.repeat(40));

        const nestedCriteria: TodoSearchCriteria = {
            categoryName: 'Work'
        };

        console.log('Searching todos by category name (requires JOIN)...');
        console.log('RawSQL: Manual JOIN construction with SqlParamInjector');
        console.log('Prisma: Automatic relation traversal via nested where clauses');

        // Scenario 3: Performance with large datasets
        console.log('\n📈 Scenario 3: Scalability Considerations');
        console.log('-'.repeat(40));
        console.log('RawSQL Advantages:');
        console.log('• Direct query optimization');
        console.log('• Minimal query overhead');
        console.log('• Custom indexing strategies');

        console.log('\nPrisma Advantages:');
        console.log('• Built-in connection pooling');
        console.log('• Automatic query optimization');
        console.log('• Query result caching');

    } catch (error) {
        console.error('❌ Advanced scenarios error:', error);
    } finally {
        await prismaRepo.close();
        await rawSqlRepo.close();
    }
}

// Educational code structure comparison
function showCodeStructureComparison() {
    console.log('\n\n📚 Code Structure Comparison:');
    console.log('='.repeat(60));

    console.log('\n🔧 RawSQL Repository Structure:');
    console.log('```typescript');
    console.log('class RawSQLTodoRepository {');
    console.log('  private sqlParamInjector: SqlParamInjector;');
    console.log('  private sqlFormatter: SqlFormatter;');
    console.log('  private postgresJsonQueryBuilder: PostgresJsonQueryBuilder;');
    console.log('');
    console.log('  async findByCriteria(criteria) {');
    console.log('    const searchState = this.convertToSearchState(criteria);');
    console.log('    const query = this.sqlParamInjector.inject(baseSql, searchState);');
    console.log('    const { formattedSql, params } = this.sqlFormatter.format(query);');
    console.log('    const result = await this.pool.query(formattedSql, params);');
    console.log('    return result.rows.map(row => this.mapRowToTodo(row));');
    console.log('  }');
    console.log('}');
    console.log('```');

    console.log('\n🎯 Prisma Repository Structure:');
    console.log('```typescript');
    console.log('class PrismaTodoRepository {');
    console.log('  private prisma: PrismaClient;');
    console.log('');
    console.log('  async findByCriteria(criteria) {');
    console.log('    const whereClause = this.convertToWhereClause(criteria);');
    console.log('    const todos = await this.prisma.todo.findMany({');
    console.log('      where: whereClause,');
    console.log('      include: { category: true }');
    console.log('    });');
    console.log('    return todos.map(todo => this.mapPrismaToTodo(todo));');
    console.log('  }');
    console.log('}');
    console.log('```');

    console.log('\n💡 Key Differences:');
    console.log('• RawSQL: Explicit SQL construction with typed parameters');
    console.log('• Prisma: Declarative query objects with automatic SQL generation');
    console.log('• RawSQL: Direct control over SQL formatting and optimization');
    console.log('• Prisma: Built-in type safety and relation handling');
}

// Main execution
async function main() {
    try {
        await runPrismaVsRawSQLComparison();
        await runAdvancedScenarios();
        showCodeStructureComparison();
    } catch (error) {
        console.error('❌ Main demo error:', error);
        process.exit(1);
    }
}

// Execute if run directly
if (require.main === module) {
    main().catch(console.error);
}

export { runPrismaVsRawSQLComparison, runAdvancedScenarios, showCodeStructureComparison };
