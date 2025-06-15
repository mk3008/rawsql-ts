/**
 * Unified Static Analysis Test
 * 
 * This test demonstrates the unified static analysis capabilities with clean,
 * markdown-formatted output using the StaticAnalysisOrchestrator.
 */

import { describe, it, expect, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import {
    StaticAnalysisOrchestrator,
    runComprehensiveStaticAnalysis
} from '../../../packages/prisma-integration/src';
import * as path from 'path';

describe('Static Analysis Tests', () => {
    const baseDir = path.join(__dirname, '..');
    const mappingDir = path.join(__dirname, '..', 'rawsql-ts');
    const prismaClient = new PrismaClient();

    // Clean up Prisma client after all tests
    afterAll(async () => {
        await prismaClient.$disconnect();
    });

    it('should run comprehensive static analysis with clean markdown output', async () => {
        // Act: Run comprehensive analysis
        const report = await runComprehensiveStaticAnalysis({
            baseDir,
            mappingDir,
            prismaClient,
            debug: false
        });

        // Assert: Report should be comprehensive
        expect(report).toBeDefined();
        expect(report.sqlAnalysis).toBeDefined();
        expect(report.domainModelAnalysis).toBeDefined();
        expect(report.overall).toBeDefined();
        expect(report.getConciseFileSummary).toBeDefined();

        // 🎯 CRITICAL ASSERTIONS: Fail test if there are SQL issues
        expect(report.sqlAnalysis.invalidFiles).toBe(0);
        expect(report.sqlAnalysis.invalidMappings).toBe(0);
        expect(report.sqlAnalysis.validFiles).toBe(report.sqlAnalysis.totalFiles);
        expect(report.sqlAnalysis.validMappings).toBe(report.sqlAnalysis.filesWithMapping);

        // Project-specific expectations
        expect(report.sqlAnalysis.totalFiles).toBe(2); // getTodoDetail.sql, searchTodos.sql
        expect(report.sqlAnalysis.validFiles).toBe(2);
        expect(report.sqlAnalysis.filesWithMapping).toBe(2);
        expect(report.sqlAnalysis.validMappings).toBe(2);

        // 🎯 OUTPUT: Use orchestrator's markdown summary (no duplication!)
        console.log('\n# Static Analysis Results\n');
        const markdownSummary = report.getConciseFileSummary!();
        markdownSummary.forEach(line => console.log(line));

        // Success message if no critical issues
        if (report.sqlAnalysis.invalidFiles === 0 && report.sqlAnalysis.invalidMappings === 0) {
            console.log('🎉 **All critical checks passed successfully!**');
        }
    });
});
