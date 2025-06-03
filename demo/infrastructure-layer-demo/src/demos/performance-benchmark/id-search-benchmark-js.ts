/**
 * ID Search Benchmark using benchmark.js library
 * 
 * Comparison with custom benchmark implementation
 */

import * as Benchmark from 'benchmark';
import * as os from 'os';
import { Client } from 'pg';
import { PrismaClient } from '@prisma/client';
import { PrismaTodoRepository } from '../../infrastructure/prisma-infrastructure.js';
import { RawSQLTodoRepository } from '../../infrastructure/rawsql-infrastructure.js';
import * as fs from 'fs/promises';

interface BenchmarkContext {
    pgClient: Client;
    prismaClient: PrismaClient;
    rawSqlRepo: RawSQLTodoRepository;
    prismaRepo: PrismaTodoRepository;
}

export class IdSearchBenchmarkJS {
    private context: BenchmarkContext;
    private results: any[] = [];

    constructor(context: BenchmarkContext) {
        this.context = context;
    }

    /**
     * Create a benchmark suite for a specific test ID
     */
    private createBenchmarkSuite(testId: string): Promise<any[]> {
        return new Promise((resolve, reject) => {
            const suite = new Benchmark.Suite(`ID Search Test (ID: ${testId})`);
            const suiteResults: any[] = []; console.log(`\n🎯 Creating benchmark suite for ID: ${testId}`);

            suite
                // Test 1: SQL Generation Only
                .add(`rawsql-ts Generation (ID: ${testId})`, {
                    defer: false,
                    fn: () => {
                        this.context.rawSqlRepo.generateFindByIdQuery(testId);
                    },
                    onComplete: function (event: any) {
                        suiteResults.push({
                            name: event.target.name,
                            hz: event.target.hz,
                            stats: event.target.stats,
                            times: event.target.times
                        });
                    }
                })

                // Test 2: rawsql-ts Total Operation
                .add(`rawsql-ts Total (ID: ${testId})`, {
                    defer: true,
                    fn: async function (deferred: any) {
                        try {
                            await (suite as any).context.rawSqlRepo.findById(testId);
                            deferred.resolve();
                        } catch (error) {
                            deferred.reject(error);
                        }
                    },
                    onComplete: function (event: any) {
                        suiteResults.push({
                            name: event.target.name,
                            hz: event.target.hz,
                            stats: event.target.stats,
                            times: event.target.times
                        });
                    }
                })

                // Test 3: Prisma Total Operation
                .add(`Prisma Total (ID: ${testId})`, {
                    defer: true,
                    fn: async function (deferred: any) {
                        try {
                            await (suite as any).context.prismaRepo.findById(testId);
                            deferred.resolve();
                        } catch (error) {
                            deferred.reject(error);
                        }
                    },
                    onComplete: function (event: any) {
                        suiteResults.push({
                            name: event.target.name,
                            hz: event.target.hz,
                            stats: event.target.stats,
                            times: event.target.times
                        });
                    }
                })

                // Configure suite
                .on('start', () => {
                    console.log(`🚀 Starting benchmark suite for ID: ${testId}`);
                })
                .on('cycle', (event: any) => {
                    console.log(`  ✅ ${event.target.toString()}`);
                })
                .on('complete', () => {
                    console.log(`🏁 Completed benchmark suite for ID: ${testId}\n`);
                    resolve(suiteResults);
                })
                .on('error', (error: any) => {
                    console.error(`❌ Benchmark error for ID ${testId}:`, error);
                    reject(error);
                });

            // Add context to suite
            (suite as any).context = this.context;

            // Run the suite
            suite.run({
                async: true,
                maxTime: 10, // Limit max time per test to 10 seconds
                minSamples: 20 // Minimum 20 samples per test
            });
        });
    }

    /**
     * Run benchmark.js based benchmarks
     */
    async runBenchmark(): Promise<void> {
        console.log('🎯 Starting ID Search Benchmark with benchmark.js\n');

        // Test only 2 IDs to avoid memory issues
        const testIds = ['1', '10'];

        for (const testId of testIds) {
            try {
                const suiteResults = await this.createBenchmarkSuite(testId);
                this.results.push(...suiteResults);

                // Force garbage collection if available
                if (global.gc) {
                    global.gc();
                }

                // Small delay between suites
                await new Promise(resolve => setTimeout(resolve, 1000));

            } catch (error) {
                console.error(`❌ Failed to run benchmark for ID ${testId}:`, error);
            }
        }

        // Generate report
        await this.generateReport();
    }    /**
     * Convert benchmark.js stats to milliseconds
     */
    private convertToMs(hz: number): number {
        return 1000 / hz; // Convert operations per second to milliseconds per operation
    }

    /**
     * Calculate statistics from benchmark.js results
     */
    private calculateStats(result: any): { mean: number; error: number; stdDev: number } {
        const mean = this.convertToMs(result.hz);
        // benchmark.js provides relative margin of error (RME) as percentage
        // Error = Mean * (RME / 100)
        const rme = result.stats.rme || 0;
        const error = mean * (rme / 100);

        // Standard deviation can be calculated from standard error of the mean (SEM)
        // SEM is typically error / sqrt(sample_size), but we'll use a reasonable approximation
        const stdDev = error * Math.sqrt(result.stats.sample?.length || 10);

        return { mean, error, stdDev };
    }

    /**
     * Generate detailed report
     */
    private async generateReport(): Promise<void> {
        const reportPath = `reports/id-search-benchmark-report.md`;

        let report = `# ID Search Benchmark Report (benchmark.js)\n\n`;
        report += `**Generated on:** ${new Date().toISOString()}\n\n`;
        report += `**Library:** benchmark.js\n\n`;
        report += `**Test Focus:** Single Record Retrieval Performance Analysis\n\n`;

        // System info
        report += `## 💻 System Information\n\n`;
        report += `\`\`\`\n`;
        report += `${os.type()} ${os.release()}\n`;
        report += `${os.cpus()[0].model}, ${os.cpus().length} logical cores\n`;
        report += `Node.js ${process.version}, ${Math.round(os.totalmem() / 1024 / 1024 / 1024)}GB RAM\n`;
        report += `\`\`\`\n\n`;        // Results tables with improved structure
        report += `## 📊 Benchmark Results\n\n`;

        // Group results by ID first
        const resultsByTest: { [key: string]: any[] } = {}; for (const result of this.results) {
            const match = result.name.match(/ID: (\d+)/);
            if (match) {
                const id = match[1];
                if (!resultsByTest[id]) {
                    resultsByTest[id] = [];
                }
                resultsByTest[id].push(result);
            }
        }

        for (const [testId, testResults] of Object.entries(resultsByTest)) {
            report += `### ID ${testId} Performance Breakdown\n\n`;

            const rawSqlTotal = testResults.find(r => r.name.includes('rawsql-ts Total'));
            const prismaTotal = testResults.find(r => r.name.includes('Prisma Total'));
            const rawSqlGeneration = testResults.find(r => r.name.includes('rawsql-ts Generation'));            // rawsql-ts component breakdown
            report += `#### rawsql-ts Components\n\n`;
            report += `| Component | Mean (ms) | Error (ms) | StdDev (ms) |\n`;
            report += `|-----------|-----------|------------|-------------|\n`;

            if (rawSqlGeneration) {
                const stats = this.calculateStats(rawSqlGeneration);
                report += `| SQL Generation | ${stats.mean.toFixed(3)} | ±${stats.error.toFixed(3)} | ${stats.stdDev.toFixed(3)} |\n`;
            }

            if (rawSqlTotal && rawSqlGeneration) {
                const totalStats = this.calculateStats(rawSqlTotal);
                const genStats = this.calculateStats(rawSqlGeneration);
                const execTime = totalStats.mean - genStats.mean;
                // For calculated execution time, we'll estimate error as combination of both
                const execError = Math.sqrt(totalStats.error ** 2 + genStats.error ** 2);
                const execStdDev = Math.sqrt(totalStats.stdDev ** 2 + genStats.stdDev ** 2);
                report += `| SQL Execution | ${execTime.toFixed(3)} | ±${execError.toFixed(3)} | ${execStdDev.toFixed(3)} |\n`;
            }

            if (rawSqlTotal) {
                const stats = this.calculateStats(rawSqlTotal);
                report += `| **Total Time** | **${stats.mean.toFixed(3)}** | **±${stats.error.toFixed(3)}** | **${stats.stdDev.toFixed(3)}** |\n`;
            }

            report += `\n`;            // Library comparison
            report += `#### Library Comparison\n\n`;
            report += `| Library | Mean (ms) | Error (ms) | StdDev (ms) | Speedup |\n`;
            report += `|---------|-----------|------------|-------------|----------|\n`;

            if (rawSqlTotal) {
                const stats = this.calculateStats(rawSqlTotal);
                report += `| rawsql-ts | ${stats.mean.toFixed(3)} | ±${stats.error.toFixed(3)} | ${stats.stdDev.toFixed(3)} | - |\n`;
            }

            if (prismaTotal) {
                const stats = this.calculateStats(prismaTotal);
                let speedupText = '-';

                if (rawSqlTotal) {
                    const rawSqlStats = this.calculateStats(rawSqlTotal);
                    const speedupRatio = stats.mean / rawSqlStats.mean;
                    speedupText = `${speedupRatio.toFixed(1)}x ${speedupRatio > 1 ? 'slower' : 'faster'}`;
                }

                report += `| Prisma | ${stats.mean.toFixed(3)} | ±${stats.error.toFixed(3)} | ${stats.stdDev.toFixed(3)} | ${speedupText} |\n`;
            }

            report += `\n`;
        }

        // Overall analysis
        report += `## 🔍 Overall Analysis\n\n`;

        // Calculate averages across all test IDs
        let avgGenTime = 0;
        let avgRawSqlTime = 0;
        let avgPrismaTime = 0;
        let testCount = 0;

        for (const [, testResults] of Object.entries(resultsByTest)) {
            const rawSqlTotal = testResults.find(r => r.name.includes('rawsql-ts Total'));
            const prismaTotal = testResults.find(r => r.name.includes('Prisma Total'));
            const rawSqlGeneration = testResults.find(r => r.name.includes('rawsql-ts Generation'));

            if (rawSqlTotal && prismaTotal && rawSqlGeneration) {
                avgGenTime += this.calculateStats(rawSqlGeneration).mean;
                avgRawSqlTime += this.calculateStats(rawSqlTotal).mean;
                avgPrismaTime += this.calculateStats(prismaTotal).mean;
                testCount++;
            }
        }

        if (testCount > 0) {
            avgGenTime /= testCount;
            avgRawSqlTime /= testCount;
            avgPrismaTime /= testCount;
            const avgExecutionTime = avgRawSqlTime - avgGenTime;
            const avgSpeedup = avgPrismaTime / avgRawSqlTime;

            report += `**Performance Summary (Average across ${testCount} test${testCount > 1 ? 's' : ''}):**\n\n`;
            report += `- **SQL Generation**: ${avgGenTime.toFixed(3)}ms (${(avgGenTime / avgRawSqlTime * 100).toFixed(1)}% of total time)\n`;
            report += `- **SQL Execution**: ${avgExecutionTime.toFixed(3)}ms (${(avgExecutionTime / avgRawSqlTime * 100).toFixed(1)}% of total time)\n`;
            report += `- **rawsql-ts Total**: ${avgRawSqlTime.toFixed(3)}ms\n`;
            report += `- **Prisma Total**: ${avgPrismaTime.toFixed(3)}ms\n`;
            report += `- **Overall Speedup**: ${avgSpeedup.toFixed(1)}x (rawsql-ts is ${avgSpeedup.toFixed(1)} times faster)\n\n`;
        }

        // Key insights
        report += `## 📈 Key Insights\n\n`;
        report += `1. **Statistical Accuracy**: Using Mean, Error (±), and Standard Deviation for precise measurements\n`;
        report += `2. **Clear Structure**: SQL Generation + SQL Execution = Total Time breakdown\n`;
        report += `3. **Library Used**: benchmark.js for industry-standard statistical accuracy\n`;
        report += `4. **Error Calculation**: Error margins calculated from benchmark.js relative margin of error (RME)\n`;
        report += `5. **Test Focus**: Focused on essential metrics without redundant tests\n\n`;

        // Save report
        try {
            await fs.writeFile(reportPath, report);
            console.log(`📄 Detailed report saved to: ${process.cwd()}\\${reportPath}`);
        } catch (error) {
            console.error('❌ Failed to save report:', error);
        }
    }
}
