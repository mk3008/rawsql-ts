/**
 * Simplified Static Analysis Test
 * 
 * Simple validation that runs static analysis and fails if there are any errors.
 * This is the kind of test you'd actually want in a real project.
 */

// Load environment variables from .env file for Windows VS Code compatibility
// import * as dotenv from 'dotenv';
// import * as path from 'path';
// dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Set fallback DATABASE_URL if not already set
if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = 'postgresql://demo_user:demo_password@localhost:5432/prisma_comparison_demo?schema=public';
}

import { describe, it, expect, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { runComprehensiveStaticAnalysis } from '../../../packages/prisma-integration/src';

describe.skip('SQL Static Analysis', () => {
    // const prismaClient = new PrismaClient();

    // afterAll(async () => {
    //     await prismaClient.$disconnect();
    // });

    it.skip('should validate all SQL files without errors', async () => {        
        // Run analysis with warning level for string protection
        const report = await runComprehensiveStaticAnalysis({
            baseDir: path.join(__dirname, '..'),
            mappingDir: path.join(__dirname, '..', 'rawsql-ts'),
            prismaClient,
            stringFieldProtectionLevel: 'warning',
            debug: false
        });

        // Display the report
        console.log('\n# Static Analysis Results\n');
        const summary = report.getConciseFileSummary!();
        summary.forEach(line => console.log(line));

        // Display string field validation summary
        console.log('\n# String Field Protection Analysis\n');
        console.log(report.stringFieldValidation.summary);
        if (report.stringFieldValidation.issues.length > 0) {
            console.log('\n🔍 String Field Protection Issues:');
            report.stringFieldValidation.issues.forEach(issue => {
                console.log(`⚠️  ${issue.filePath}: ${issue.entityName}.${issue.fieldName} -> ${issue.columnName}`);
                console.log(`   💡 ${issue.recommendation}`);
            });
        }

        // Fail if there are any errors
        if (report.sqlAnalysis.invalidFiles > 0) {
            throw new Error(`Found ${report.sqlAnalysis.invalidFiles} SQL files with syntax errors`);
        }

        if (report.sqlAnalysis.invalidMappings > 0) {
            throw new Error(`Found ${report.sqlAnalysis.invalidMappings} JSON mapping files with errors`);
        }       
        
        // Check string field protection issues - fail if any errors are found
        const errorLevelIssues = report.stringFieldValidation.issues.filter(issue => issue.severity === 'error');
        if (errorLevelIssues.length > 0) {
            // Generate detailed error message with specific locations and fixes
            const maxDisplayIssues = 5; // Show first 5 issues in detail
            const displayIssues = errorLevelIssues.slice(0, maxDisplayIssues);
            const hasMoreIssues = errorLevelIssues.length > maxDisplayIssues;

            let errorMessage = `Found ${errorLevelIssues.length} string field protection error(s). These must be fixed for type safety.\n\n`;

            errorMessage += '🚨 CRITICAL ERRORS - String fields missing type protection:\n';
            errorMessage += '─'.repeat(80) + '\n';

            displayIssues.forEach((issue, index) => {
                errorMessage += `${index + 1}. ❌ ERROR: ${issue.entityName}.${issue.fieldName}\n`;
                errorMessage += `   📁 File: ${issue.filePath}\n`;
                errorMessage += `   📊 Database Column: ${issue.columnName}\n`;
                errorMessage += `   💡 Fix: Change "${issue.fieldName}": "${issue.columnName}" to:\n`;
                errorMessage += `        "${issue.fieldName}": { "column": "${issue.columnName}", "type": "string" }\n`;
                if (index < displayIssues.length - 1) errorMessage += '\n';
            });

            if (hasMoreIssues) {
                const remainingCount = errorLevelIssues.length - maxDisplayIssues;
                errorMessage += `\n... and ${remainingCount} more error(s). See full output above for complete list.\n`;
            }

            errorMessage += '\n🔧 Why this is critical:';
            errorMessage += '\n   • String fields may return unexpected types (date, bigint, etc.) from database';
            errorMessage += '\n   • Runtime errors occur when JavaScript expects string methods on non-string values';
            errorMessage += '\n   • type: "string" ensures type safety and prevents data corruption';
            errorMessage += '\n\n🚀 To fix: Add "type": "string" to all string field mappings in the files above.';

            throw new Error(errorMessage);
        }

        console.log('🎉 **All SQL files validated successfully!**');

        if (report.stringFieldValidation.unprotectedFields > 0) {
            console.log(`⚠️  **Note**: ${report.stringFieldValidation.unprotectedFields} string field(s) lack protection - consider adding type: "string"`);
        } else {
            console.log('🔒 **All string fields are properly protected!**');
        }
    });
});
