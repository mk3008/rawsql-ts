import * as fs from 'fs';
import * as path from 'path';
import { SqlParser } from '../packages/core/src/parsers/SqlParser';
import { SqlTokenizer } from '../packages/core/src/parsers/SqlTokenizer';
import { SelectQueryParser } from '../packages/core/src/parsers/SelectQueryParser';
import { SqlFormatter } from '../packages/core/src/transformers/SqlFormatter';

type ProfileName = 'pr' | 'full';
type PhaseName = 'tokenizeOnly' | 'parseOnly' | 'parseAndFormat';

interface Scenario {
    name: string;
    sql: string;
    lines: number;
}

interface ProfileConfig {
    name: ProfileName;
    warmupIterations: number;
    measureIterations: number;
    scenarios: Scenario[];
}

interface PhaseStats {
    meanMs: number;
    p95Ms: number;
    stddevMs: number;
    minMs: number;
    maxMs: number;
    samples: number;
    heapDeltaKb: number;
}

interface PhaseResult {
    phase: PhaseName;
    stats: PhaseStats;
}

interface ScenarioResult {
    scenario: string;
    lines: number;
    tokenCount: number;
    phases: PhaseResult[];
}

interface BenchmarkReport {
    profile: ProfileName;
    nodeVersion: string;
    timestamp: string;
    results: ScenarioResult[];
}

const formatter = new SqlFormatter();

function createCteChainSql(targetLines: number): string {
    const cteCount = Math.max(2, targetLines - 2);
    const lines: string[] = ['WITH'];

    for (let i = 1; i <= cteCount; i++) {
        const cteName = `cte_${i.toString().padStart(4, '0')}`;
        if (i === 1) {
            lines.push(`  ${cteName} AS (SELECT 1 AS id)${i === cteCount ? '' : ','}`);
            continue;
        }

        const prevCteName = `cte_${(i - 1).toString().padStart(4, '0')}`;
        lines.push(`  ${cteName} AS (SELECT id + 1 AS id FROM ${prevCteName})${i === cteCount ? '' : ','}`);
    }

    lines.push(`SELECT id FROM cte_${cteCount.toString().padStart(4, '0')};`);
    return lines.join('\n');
}

function parseProfileArg(): ProfileName {
    const profileArg = process.argv.find((arg) => arg.startsWith('--profile='));
    if (!profileArg) {
        return 'pr';
    }

    const value = profileArg.split('=')[1];
    if (value === 'pr' || value === 'full') {
        return value;
    }

    throw new Error(`Unsupported profile: ${value}. Expected --profile=pr or --profile=full`);
}

function getProfileConfig(profile: ProfileName): ProfileConfig {
    const prScenarios: Scenario[] = [
        {
            name: 'cte-80-lines',
            sql: createCteChainSql(80),
            lines: 80,
        },
        {
            name: 'cte-200-lines',
            sql: createCteChainSql(200),
            lines: 200,
        },
    ];

    if (profile === 'pr') {
        return {
            name: 'pr',
            warmupIterations: 4,
            measureIterations: 16,
            scenarios: prScenarios,
        };
    }

    return {
        name: 'full',
        warmupIterations: 3,
        measureIterations: 12,
        scenarios: [
            ...prScenarios,
            {
                name: 'cte-1000-lines',
                sql: createCteChainSql(1000),
                lines: 1000,
            },
        ],
    };
}

function nowMs(): number {
    return Number(process.hrtime.bigint()) / 1_000_000;
}

function computeStats(values: number[], heapDeltaKb: number): PhaseStats {
    const sorted = [...values].sort((a, b) => a - b);
    const sum = values.reduce((acc, current) => acc + current, 0);
    const mean = sum / values.length;
    const variance = values.reduce((acc, current) => acc + (current - mean) ** 2, 0) / values.length;
    const p95Index = Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1);

    return {
        meanMs: round3(mean),
        p95Ms: round3(sorted[p95Index]),
        stddevMs: round3(Math.sqrt(variance)),
        minMs: round3(sorted[0]),
        maxMs: round3(sorted[sorted.length - 1]),
        samples: values.length,
        heapDeltaKb: round3(heapDeltaKb),
    };
}

function round3(value: number): number {
    return Math.round(value * 1000) / 1000;
}

function measurePhase(fn: () => void, warmupIterations: number, measureIterations: number): PhaseStats {
    for (let i = 0; i < warmupIterations; i++) {
        fn();
    }

    const startHeap = process.memoryUsage().heapUsed;
    const samples: number[] = [];

    for (let i = 0; i < measureIterations; i++) {
        const start = nowMs();
        fn();
        const end = nowMs();
        samples.push(end - start);
    }

    const endHeap = process.memoryUsage().heapUsed;
    const heapDeltaKb = (endHeap - startHeap) / 1024;

    return computeStats(samples, heapDeltaKb);
}

function runScenario(scenario: Scenario, config: ProfileConfig): ScenarioResult {
    const tokenizeResult = new SqlTokenizer(scenario.sql).readLexemes();
    const tokenCount = tokenizeResult.length;

    const phases: PhaseResult[] = [
        {
            phase: 'tokenizeOnly',
            stats: measurePhase(() => {
                new SqlTokenizer(scenario.sql).readLexemes();
            }, config.warmupIterations, config.measureIterations),
        },
        {
            phase: 'parseOnly',
            stats: measurePhase(() => {
                SqlParser.parse(scenario.sql, { mode: 'single' });
            }, config.warmupIterations, config.measureIterations),
        },
        {
            phase: 'parseAndFormat',
            stats: measurePhase(() => {
                const parsed = SelectQueryParser.parse(scenario.sql);
                formatter.format(parsed);
            }, config.warmupIterations, config.measureIterations),
        },
    ];

    return {
        scenario: scenario.name,
        lines: scenario.lines,
        tokenCount,
        phases,
    };
}

function printResults(report: BenchmarkReport): void {
    console.log(`Profile: ${report.profile}`);
    console.log(`Node: ${report.nodeVersion}`);
    console.log(`Timestamp: ${report.timestamp}`);
    console.log('');

    for (const result of report.results) {
        console.log(`Scenario: ${result.scenario} (${result.lines} lines, ${result.tokenCount} tokens)`);
        console.log('| Phase | mean(ms) | p95(ms) | stddev(ms) | min(ms) | max(ms) | heap delta(KB) |');
        console.log('|---|---:|---:|---:|---:|---:|---:|');

        for (const phase of result.phases) {
            console.log(`| ${phase.phase} | ${phase.stats.meanMs.toFixed(3)} | ${phase.stats.p95Ms.toFixed(3)} | ${phase.stats.stddevMs.toFixed(3)} | ${phase.stats.minMs.toFixed(3)} | ${phase.stats.maxMs.toFixed(3)} | ${phase.stats.heapDeltaKb.toFixed(3)} |`);
        }

        console.log('');
    }
}

function writeReport(report: BenchmarkReport): string {
    const tmpDir = path.resolve(__dirname, '../tmp');
    fs.mkdirSync(tmpDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:]/g, '-');
    const outputPath = path.join(tmpDir, `parser-phase-benchmark-${report.profile}-${timestamp}.json`);
    fs.writeFileSync(outputPath, JSON.stringify(report, null, 2), 'utf8');

    return outputPath;
}

function main(): void {
    const profile = parseProfileArg();
    const config = getProfileConfig(profile);
    const results = config.scenarios.map((scenario) => runScenario(scenario, config));

    const report: BenchmarkReport = {
        profile,
        nodeVersion: process.version,
        timestamp: new Date().toISOString(),
        results,
    };

    printResults(report);
    const reportPath = writeReport(report);
    console.log(`Report saved to ${path.relative(process.cwd(), reportPath)}`);
}

main();
