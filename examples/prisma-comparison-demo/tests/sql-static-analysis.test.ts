/**
 * Simplified Static Analysis Test
 * 
 * Simple validation that runs static analysis and fails if there are any errors.
 * This is the kind of test you'd actually want in a real project.
 */

import { describe, it, expect, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { runComprehensiveStaticAnalysis } from '../../../packages/prisma-integration/src';
import * as path from 'path';

describe('SQL Static Analysis', () => {
    const prismaClient = new PrismaClient();

    afterAll(async () => {
        await prismaClient.$disconnect();
    });

    it('should validate all SQL files without errors', async () => {
        // Run analysis
        const report = await runComprehensiveStaticAnalysis({
            baseDir: path.join(__dirname, '..'),
            mappingDir: path.join(__dirname, '..', 'rawsql-ts'),
            prismaClient,
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

        // Note: String field protection issues are warnings, not errors
        // They won't fail the test but will be displayed for developer awareness

        console.log('🎉 **All SQL files validated successfully!**');

        if (report.stringFieldValidation.unprotectedFields > 0) {
            console.log(`⚠️  **Note**: ${report.stringFieldValidation.unprotectedFields} string field(s) lack protection - consider adding forceString: true`);
        } else {
            console.log('🔒 **All string fields are properly protected!**');
        }
    });
});
