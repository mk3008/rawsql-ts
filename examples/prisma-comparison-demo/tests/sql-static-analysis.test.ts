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

        // Fail if there are any errors
        if (report.sqlAnalysis.invalidFiles > 0) {
            throw new Error(`Found ${report.sqlAnalysis.invalidFiles} SQL files with syntax errors`);
        }

        if (report.sqlAnalysis.invalidMappings > 0) {
            throw new Error(`Found ${report.sqlAnalysis.invalidMappings} JSON mapping files with errors`);
        }

        console.log('🎉 **All SQL files validated successfully!**');
    });
});
