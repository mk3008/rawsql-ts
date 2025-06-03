/**
 * List Search Benchmark using benchmark.js library
 * 
 * Comparison of findByCriteria performance between rawsql-ts and Prisma
 */

import * as Benchmark from 'benchmark';
import * as os from 'os';
import { Client } from 'pg';
import { PrismaClient } from '@prisma/client';
import { PrismaTodoRepository } from '../../infrastructure/prisma-infrastructure.js';
import { RawSQLTodoRepository } from '../../infrastructure/rawsql-infrastructure.js';
import { TodoSearchCriteria } from '../../contracts/search-criteria.js';
import { TodoPriority, TodoStatus } from '../../domain/entities.js';
import * as fs from 'fs/promises';

interface BenchmarkContext {
    pgClient: Client;
    prismaClient: PrismaClient;
    rawSqlRepo: RawSQLTodoRepository;
    prismaRepo: PrismaTodoRepository;
}

export class ListSearchBenchmarkJS {
    private context: BenchmarkContext;
    private results: any[] = [];

    constructor(context: BenchmarkContext) {
        this.context = context;
    }    /**
     * Create test search criteria variants for comprehensive testing
     */
    private getTestCriteria(): { name: string; criteria: TodoSearchCriteria }[] {
        return [
            {
                name: "Simple Status Filter",
                criteria: {
                    status: 'in_progress' as TodoStatus
                }
            },
            {
                name: "Priority + Status Filter",
                criteria: {
                    status: 'pending' as TodoStatus,
                    priority: 'high' as TodoPriority
                }
            },
            {
                name: "Title Search",
                criteria: {
                    title: "test"
                }
            }, {
                name: "Category Color Filter",
                criteria: {
                    categoryColor: "#3498db"
                }
            },
            {
                name: "Complex Multi-filter",
                criteria: {
                    status: 'in_progress' as TodoStatus,
                    priority: 'medium' as TodoPriority,
                    title: "important",
                    categoryName: "work"
                }
            },
            {
                name: "Date Range Filter",
                criteria: {
                    fromDate: new Date('2024-01-01'),
                    toDate: new Date('2024-12-31')
                }
            }
        ];
    }

    /**
     * Calculate statistics from benchmark.js results
     * Converts from RME to mean, error, and standard deviation
     */
    private calculateStats(benchResult: any): { mean: number; error: number; stdDev: number } {
        const hz = benchResult.hz || 0;
        const rme = benchResult.stats?.rme || 0;

        // Calculate mean time per operation in milliseconds
        const mean = hz > 0 ? (1000 / hz) : 0;

        // Calculate error from RME (Relative Margin of Error)
        const error = (rme / 100) * mean;

        // Estimate standard deviation (approximation)
        const stdDev = error / 1.96; // Assuming 95% confidence interval

        return { mean, error, stdDev };
    }

    /**
     * Create a benchmark suite for a specific search criteria
     */
    private createBenchmarkSuite(testCase: { name: string; criteria: TodoSearchCriteria }): Promise<any[]> {
        return new Promise((resolve, reject) => {
            const suite = new Benchmark.Suite(`List Search Test (${testCase.name})`);
            const suiteResults: any[] = [];

            console.log(`\n🎯 Creating benchmark suite for: ${testCase.name}`);

            suite
                // Test 1: SQL Generation Only (rawsql-ts)
                .add(`rawsql-ts Generation (${testCase.name})`, {
                    defer: false,
                    fn: () => {
                        this.context.rawSqlRepo.buildSearchQuery(testCase.criteria);
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
                .add(`rawsql-ts Total (${testCase.name})`, {
                    defer: true,
                    fn: async function (deferred: any) {
                        try {
                            await (suite as any).context.rawSqlRepo.findByCriteria(testCase.criteria);
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
                .add(`Prisma Total (${testCase.name})`, {
                    defer: true,
                    fn: async function (deferred: any) {
                        try {
                            await (suite as any).context.prismaRepo.findByCriteria(testCase.criteria);
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
                    console.log(`🚀 Starting benchmark suite for: ${testCase.name}`);
                })
                .on('complete', () => {
                    console.log(`✅ Completed benchmark suite for: ${testCase.name}`);
                    resolve(suiteResults);
                })
                .on('error', (error: any) => {
                    console.error(`❌ Error in benchmark suite for ${testCase.name}:`, error);
                    reject(error);
                });

            // Pass context to the suite
            (suite as any).context = this.context;

            // Run the suite
            suite.run({ async: true });
        });
    }

    /**
     * Run all benchmark tests
     */
    async runBenchmarks(): Promise<void> {
        console.log('🚀 Starting List Search Benchmark Tests\n');

        const testCases = this.getTestCriteria();

        for (const testCase of testCases) {
            try {
                const suiteResults = await this.createBenchmarkSuite(testCase);
                this.results.push({
                    testCase: testCase.name,
                    criteria: testCase.criteria,
                    results: suiteResults
                });

                // Small delay between test suites
                await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (error) {
                console.error(`❌ Failed to run benchmark for ${testCase.name}:`, error);
            }
        }

        await this.generateReport();
        console.log('🎉 All benchmarks completed!');
    }

    /**
     * Generate comprehensive markdown report
     */
    private async generateReport(): Promise<void> {
        const reportPath = './reports/list-search-benchmark-report.md';

        let report = this.generateReportHeader();
        report += this.generateSystemInfo();
        report += this.generateDetailedResults();
        report += this.generateSummaryAnalysis();
        report += this.generateKeyInsights();

        await fs.writeFile(reportPath, report, 'utf8');
        console.log(`📊 Report generated: ${reportPath}`);
    }

    /**
     * Generate report header
     */
    private generateReportHeader(): string {
        const timestamp = new Date().toISOString();
        return `# List Search Performance Benchmark Report

**Generated:** ${timestamp}
**Test Type:** List Search Operations (findByCriteria)
**Library:** rawsql-ts vs Prisma ORM
**Database:** PostgreSQL

---

`;
    }

    /**
     * Generate system information section
     */
    private generateSystemInfo(): string {
        return `## System Information

| Property | Value |
|----------|-------|
| **OS** | ${os.platform()} ${os.release()} |
| **Architecture** | ${os.arch()} |
| **CPU** | ${os.cpus()[0]?.model || 'Unknown'} |
| **CPU Cores** | ${os.cpus().length} |
| **Total Memory** | ${Math.round(os.totalmem() / 1024 / 1024 / 1024)} GB |
| **Free Memory** | ${Math.round(os.freemem() / 1024 / 1024 / 1024)} GB |
| **Node.js Version** | ${process.version} |

---

`;
    }

    /**
     * Generate detailed results for each test case
     */
    private generateDetailedResults(): string {
        let report = `## Detailed Performance Results

`;

        this.results.forEach(testResult => {
            report += `### ${testResult.testCase}

**Search Criteria:**
\`\`\`json
${JSON.stringify(testResult.criteria, null, 2)}
\`\`\`

| Operation | Mean (ms) | Error (ms) | StdDev (ms) |
|-----------|-----------|------------|-------------|
`;

            testResult.results.forEach((benchResult: any) => {
                const stats = this.calculateStats(benchResult);
                report += `| ${benchResult.name} | ${stats.mean.toFixed(3)} | ${stats.error.toFixed(3)} | ${stats.stdDev.toFixed(3)} |\n`;
            });

            report += '\n';
        });

        report += '---\n\n';
        return report;
    }

    /**
     * Generate summary analysis across all test cases
     */
    private generateSummaryAnalysis(): string {
        let report = `## Summary Analysis

### Performance Comparison by Operation Type

| Test Case | rawsql-ts Generation (ms) | rawsql-ts Total (ms) | Prisma Total (ms) | Generation Overhead (%) |
|-----------|---------------------------|----------------------|-------------------|------------------------|
`;

        this.results.forEach(testResult => {
            const generation = testResult.results.find((r: any) => r.name.includes('Generation'));
            const rawsqlTotal = testResult.results.find((r: any) => r.name.includes('rawsql-ts Total'));
            const prismaTotal = testResult.results.find((r: any) => r.name.includes('Prisma Total'));

            if (generation && rawsqlTotal && prismaTotal) {
                const genStats = this.calculateStats(generation);
                const rawsqlStats = this.calculateStats(rawsqlTotal);
                const prismaStats = this.calculateStats(prismaTotal);

                const overhead = rawsqlStats.mean > 0 ? ((genStats.mean / rawsqlStats.mean) * 100) : 0;

                report += `| ${testResult.testCase} | ${genStats.mean.toFixed(3)} | ${rawsqlStats.mean.toFixed(3)} | ${prismaStats.mean.toFixed(3)} | ${overhead.toFixed(1)}% |\n`;
            }
        });

        report += '\n### Overall Performance Metrics\n\n';

        // Calculate averages
        let totalGenTime = 0, totalRawsqlTime = 0, totalPrismaTime = 0, validTests = 0;

        this.results.forEach(testResult => {
            const generation = testResult.results.find((r: any) => r.name.includes('Generation'));
            const rawsqlTotal = testResult.results.find((r: any) => r.name.includes('rawsql-ts Total'));
            const prismaTotal = testResult.results.find((r: any) => r.name.includes('Prisma Total'));

            if (generation && rawsqlTotal && prismaTotal) {
                totalGenTime += this.calculateStats(generation).mean;
                totalRawsqlTime += this.calculateStats(rawsqlTotal).mean;
                totalPrismaTime += this.calculateStats(prismaTotal).mean;
                validTests++;
            }
        });

        if (validTests > 0) {
            const avgGenTime = totalGenTime / validTests;
            const avgRawsqlTime = totalRawsqlTime / validTests;
            const avgPrismaTime = totalPrismaTime / validTests;
            const performanceGain = avgPrismaTime > 0 ? ((avgPrismaTime - avgRawsqlTime) / avgPrismaTime * 100) : 0;

            report += `| Metric | Value |
|--------|-------|
| **Average SQL Generation Time** | ${avgGenTime.toFixed(3)} ms |
| **Average rawsql-ts Total Time** | ${avgRawsqlTime.toFixed(3)} ms |
| **Average Prisma Total Time** | ${avgPrismaTime.toFixed(3)} ms |
| **Performance Gain vs Prisma** | ${performanceGain.toFixed(1)}% |
| **SQL Generation Overhead** | ${(avgGenTime / avgRawsqlTime * 100).toFixed(1)}% |

`;
        }

        report += '---\n\n';
        return report;
    }

    /**
     * Generate key insights section
     */
    private generateKeyInsights(): string {
        return `## Key Insights

### rawsql-ts Component Performance Analysis
- **SQL Generation:** Isolated measurement of query building and formatting performance
- **Total Operation:** Complete execution including database round-trip and result processing
- **Generation Overhead:** Percentage of total time spent on SQL generation vs database execution

### Performance Characteristics by Search Pattern
- **Simple Filters:** Basic status/priority filtering performance baseline
- **Text Search:** Impact of LIKE operations on query performance
- **Multi-criteria:** Complex filtering with multiple conditions
- **Date Ranges:** Temporal filtering performance characteristics

### Statistical Accuracy
- **Error Calculation:** Derived from Relative Margin of Error (RME) with 95% confidence
- **Standard Deviation:** Estimated from error margins to show result consistency
- **Mean Values:** Average execution time per operation across multiple iterations

### Technology Comparison
- **rawsql-ts Advantages:** Direct SQL control, predictable performance, minimal overhead
- **Prisma Considerations:** ORM abstraction layer, query optimization, type safety trade-offs
- **Use Case Optimization:** Performance characteristics vary by search complexity

*This benchmark provides insights into list search performance patterns to guide architectural decisions.*
`;
    }
}
