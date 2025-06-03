/**
 * Prisma vs rawsql-ts Architecture Comparison Demo
 * Uses SQL logger delegates to capture actual query execution patterns
 * No hardcoded SQL - all information comes from real execution data
 */

import { PrismaTodoRepository } from '../infrastructure/prisma-infrastructure';
import { RawSQLTodoRepository } from '../infrastructure/rawsql-infrastructure';
import { TodoSearchCriteria } from '../contracts/search-criteria';
import { DemoSqlLogger } from '../contracts/sql-logger';
import * as fs from 'fs';
import * as path from 'path';

async function runPrismaVsRawSqlComparison() {
    // Create separate SQL loggers for each approach
    const rawSqlLogger = new DemoSqlLogger();
    const prismaLogger = new DemoSqlLogger();

    // Initialize repositories with their respective loggers
    const rawSqlRepo = new RawSQLTodoRepository(true, undefined, rawSqlLogger);
    const prismaRepo = new PrismaTodoRepository(true, prismaLogger); let report = '';
    report += '# Prisma vs rawsql-ts Architecture Comparison Report\n\n';
    report += `**Generated on:** ${new Date().toISOString()}\n\n`;
    report += '---\n\n';

    try {
        // Test connections
        report += '## 📡 Database Connection Test\n\n';

        let rawSqlConnection = false;
        let prismaConnection = false;

        try {
            rawSqlConnection = await rawSqlRepo.testConnection();
        } catch (error) {
            console.log('rawsql-ts connection failed:', error);
        }

        try {
            await prismaRepo.countByCriteria({});
            prismaConnection = true;
        } catch (error) {
            console.log('Prisma connection failed:', error);
        }

        report += `| Repository | Status |\n`;
        report += `|------------|--------|\n`;
        report += `| rawsql-ts | ${rawSqlConnection ? '✅ Connected' : '❌ Failed'} |\n`;
        report += `| Prisma | ${prismaConnection ? '✅ Connected' : '❌ Failed'} |\n\n`;

        if (!rawSqlConnection || !prismaConnection) {
            report += '⚠️ **Warning:** Some connections failed. Partial results below.\n\n';
        }        // === TABLE SEARCH COMPARISON ===
        if (rawSqlConnection && prismaConnection) {
            report += '## 📊 Table Search Comparison\n\n';

            // Add test background explanation
            report += '### Test Background\n\n';
            report += 'This test simulates a **search list functionality** commonly found in enterprise applications:\n\n';
            report += '- **Use Case**: Search functionality with multiple optional filter criteria\n';
            report += '- **Search Criteria**: Multiple optional fields (title, status, priority, date ranges, etc.)\n';
            report += '- **Result Format**: 2D array structure optimized for table display\n';
            report += '- **Data Structure**: Results ignore relational structure - flat data for UI tables\n';
            report += '- **Performance Focus**: Query efficiency for paginated list views\n\n'; report += '**Request:** Get todos matching title "project", status "pending", priority "high"\n\n';

            const searchCriteria: TodoSearchCriteria = {
                title: 'project',
                status: 'pending',
                priority: 'high'
            };

            // Clear logs before execution
            rawSqlLogger.clearLogs();
            prismaLogger.clearLogs();

            // Execute searches
            const rawSqlResults = await rawSqlRepo.findByCriteria(searchCriteria);


            const prismaResults = await prismaRepo.findByCriteria(searchCriteria);

            // // Display retrieved objects as JSON
            // console.log('\n📋 rawsql-ts Retrieved Objects:');
            // console.log(JSON.stringify(rawSqlResults, null, 2));

            // console.log('\n📋 Prisma Retrieved Objects:');
            // console.log(JSON.stringify(prismaResults, null, 2));

            // Get stats for summary
            const rawSqlStats = rawSqlLogger.getSimpleStats();
            const prismaStats = prismaLogger.getSimpleStats();

            // rawsql-ts section
            report += rawSqlLogger.formatForReport('rawsql-ts');

            // Add retrieved objects section
            report += '\n**Results:**\n';
            report += '```json\n';
            report += JSON.stringify(rawSqlResults, null, 2);
            report += '\n```\n\n';

            // Prisma section
            report += prismaLogger.formatForReport('Prisma');

            report += '\n**Results:**\n';
            report += '```json\n';
            report += JSON.stringify(prismaResults, null, 2);
            report += '\n```\n\n';            // Summary section
            report += '### Summary\n\n';
            report += `- **rawsql-ts:** ${rawSqlStats.queryCount} queries\n`;
            report += `- **Prisma:** ${prismaStats.queryCount} queries\n\n`;
        }

        // === MULTI-TABLE JOIN SEARCH COMPARISON ===
        if (rawSqlConnection && prismaConnection) {
            report += '## 🔗 Multi-Table JOIN Search Comparison\n\n';

            // Add test background explanation
            report += '### Test Background\n\n';
            report += 'This test simulates a **multi-table search functionality** that requires JOIN operations:\n\n'; report += '- **Use Case**: Search by attributes that exist only in related tables (not main entity)\n';
            report += '- **Search Method**: Mandatory JOIN-based filtering through foreign key relationships\n';
            report += '- **Technical Focus**: How each approach handles multi-table filtering\n';
            report += '- **Data Structure**: Results must include data from multiple related tables\n';
            report += '- **Performance Focus**: Efficient JOIN operations vs N+1 query strategies\n\n'; report += '**Request:** Get todos filtered by category color "#3498db" (attribute exists only in related category table)\n\n';

            const colorSearchCriteria: TodoSearchCriteria = {
                categoryColor: '#3498db'
            };

            // Clear logs before execution
            rawSqlLogger.clearLogs();
            prismaLogger.clearLogs();

            // Execute searches
            const rawSqlColorResults = await rawSqlRepo.findByCriteria(colorSearchCriteria);
            const prismaColorResults = await prismaRepo.findByCriteria(colorSearchCriteria);

            // Get stats for summary
            const rawSqlColorStats = rawSqlLogger.getSimpleStats();
            const prismaColorStats = prismaLogger.getSimpleStats();

            // rawsql-ts section
            report += rawSqlLogger.formatForReport('rawsql-ts');

            // Add retrieved objects section
            report += '\n**Results:**\n';
            report += '```json\n';
            report += JSON.stringify(rawSqlColorResults, null, 2);
            report += '\n```\n\n';

            // Prisma section
            report += prismaLogger.formatForReport('Prisma');

            report += '\n**Results:**\n';
            report += '```json\n';
            report += JSON.stringify(prismaColorResults, null, 2);
            report += '\n```\n\n';

            // Summary section
            report += '### Summary\n\n';
            report += `- **rawsql-ts:** ${rawSqlColorStats.queryCount} queries\n`;
            report += `- **Prisma:** ${prismaColorStats.queryCount} queries\n\n`;
        }// === ID SEARCH COMPARISON ===
        if (rawSqlConnection && prismaConnection) {
            report += '## 🎯 ID Search Comparison\n\n';

            // Add test background explanation
            report += '### Test Background\n\n';
            report += 'This test simulates a **detail view functionality** commonly found in enterprise applications:\n\n';
            report += '- **Use Case**: Single record retrieval for detail/edit screens\n';
            report += '- **Search Method**: Primary key-based lookup (most efficient database operation)\n';
            report += '- **Result Format**: Structured data with full object relationships\n';
            report += '- **Data Structure**: Complete entity with nested related objects\n';
            report += '- **Performance Focus**: Minimizing query count while retrieving complete data\n\n';

            // Get a test ID
            const allTodos = await rawSqlRepo.findByCriteria({});
            if (allTodos.length > 0) {
                const testId = allTodos[0].todo_id.toString();

                report += `**Request:** Retrieve todo with ID: ${testId}\n\n`;

                // Clear logs before ID search execution
                rawSqlLogger.clearLogs();
                prismaLogger.clearLogs();                // Execute searches
                const rawSqlDetail = await rawSqlRepo.findById(testId);
                const prismaDetail = await prismaRepo.findById(testId);

                // Display retrieved objects as JSON
                console.log(`\n📝 rawsql-ts Retrieved Object (ID: ${testId}):`);
                console.log(JSON.stringify(rawSqlDetail, null, 2));

                console.log(`\n📝 Prisma Retrieved Object (ID: ${testId}):`);
                console.log(JSON.stringify(prismaDetail, null, 2));

                // Get stats for summary
                const rawSqlIdStats = rawSqlLogger.getSimpleStats();
                const prismaIdStats = prismaLogger.getSimpleStats();

                // rawsql-ts section
                report += rawSqlLogger.formatForReport('rawsql-ts');

                report += `\n**Result**\n`;
                report += '```json\n';
                report += JSON.stringify(rawSqlDetail, null, 2);
                report += '\n```\n\n';

                // Prisma section
                report += prismaLogger.formatForReport('Prisma');
                report += `\n**Result**\n`;
                report += '```json\n';
                report += JSON.stringify(prismaDetail, null, 2);
                report += '\n```\n\n';                // Summary section
                report += '### Summary\n\n';
                report += `- **rawsql-ts:** ${rawSqlIdStats.queryCount} queries\n`;
                report += `- **Prisma:** ${prismaIdStats.queryCount} queries\n\n`;
            }
        }
    } catch (error) {
        report += `\n❌ **Error during comparison:** ${error instanceof Error ? error.message : String(error)}\n\n`;
        console.error('Demo failed:', error);
    } finally {
        // Clean up connections
        try {
            await rawSqlRepo.testConnection(); // Just to ensure cleanup
        } catch { }

        // Output to console
        console.log(report);        // Save report to file
        try {
            const filename = `prisma-vs-rawsql-comparison.md`;
            const reportPath = path.join(process.cwd(), 'reports', filename);

            // Create reports directory if it doesn't exist
            const reportsDir = path.dirname(reportPath);
            if (!fs.existsSync(reportsDir)) {
                fs.mkdirSync(reportsDir, { recursive: true });
            }

            // Write report to file
            fs.writeFileSync(reportPath, report, 'utf-8');

            console.log(`\n📄 Report saved to: ${reportPath}`);
            console.log(`📂 File size: ${(fs.statSync(reportPath).size / 1024).toFixed(2)} KB`);
        } catch (fileError) {
            console.error('❌ Failed to save report file:', fileError);
        }
    }
}

// Execute the comparison
runPrismaVsRawSqlComparison().catch(console.error);
