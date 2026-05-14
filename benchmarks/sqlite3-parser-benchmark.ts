import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { createRequire } from 'module';
import { pathToFileURL } from 'url';
import Benchmark = require('benchmark');
type BenchmarkCase = Benchmark;
import { SqlParser } from '../packages/core/src/parsers/SqlParser';

interface BenchmarkResult {
    name: string;
    methodLabel: string;
    caseKey: string;
    hz: number;
    stats: Benchmark.Stats;
    mean: number;
    samples: number;
}

interface ParserMethod {
    label: string;
    parse: (sql: string) => void;
    borderColor: string;
    backgroundColor: string;
}

interface BenchmarkInputCase {
    key: string;
    label: string;
    description: string;
    sql: string;
}

interface SkippedBenchmarkCase {
    methodLabel: string;
    caseKey: string;
    reason: string;
}

type NativeDynamicImport = (specifier: string) => Promise<unknown>;
type Sqlite3ParserModule = {
    parse(sql: string): { status: 'ok'; root: unknown } | { status: 'error'; errors: Array<{ message: string }> };
};

interface ChartDataset {
    labels: string[];
    datasets: Array<{
        label: string;
        data: Array<number | null>;
        borderColor?: string;
        backgroundColor?: string;
        fill?: boolean;
        tension?: number;
    }>;
}

const BENCHMARK_RUN_CONFIG = {
    minSamples: 10,
    maxTimeSec: 0.2,
};

const corePackageRequire = createRequire(path.resolve(__dirname, '../packages/core/package.json'));
const nativeDynamicImport = new Function('specifier', 'return import(specifier)') as NativeDynamicImport;

const TINY = 'SELECT 1;';
const SMALL = 'CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE);';
const MEDIUM = `
WITH active AS (
  SELECT u.id, u.name, MAX(o.created_at) AS last_order
  FROM users u
  LEFT JOIN orders o ON o.user_id = u.id
  WHERE o.status IN ('paid', 'shipped')
  GROUP BY u.id, u.name
)
SELECT a.id,
       a.name,
       a.last_order,
       (SELECT COUNT(*) FROM orders o WHERE o.user_id = a.id) AS order_count,
       (SELECT COALESCE(SUM(o.total), 0) FROM orders o
        WHERE o.user_id = a.id AND o.status = 'paid') AS paid_total,
       CASE WHEN a.last_order > date('now', '-30 days') THEN 'active'
            ELSE 'dormant' END AS activity
FROM active a
WHERE a.last_order IS NOT NULL
ORDER BY a.last_order DESC
LIMIT 100;
`.trim();

const LARGE_METRICS = Array.from({ length: 96 }, (_, i) => {
    const suffix = String(i + 1).padStart(2, '0');
    const notNull = i % 8 === 0 ? ' NOT NULL' : '';
    return `metric_${suffix} REAL${notNull}`;
}).join(',\n  ');

const LARGE = `
CREATE TABLE analytics_events (
  id INTEGER PRIMARY KEY,
  account_id INTEGER NOT NULL,
  event_name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  payload TEXT,
  ${LARGE_METRICS}
);
`.trim();

const DEEP_EXPR = (() => {
    let expression = 'a';
    for (let i = 0; i < 16; i++) {
        expression = `(${expression} + ${i})`;
    }
    return expression;
})();

const DEEP_SUBQUERY = (() => {
    let query = `SELECT ${DEEP_EXPR} FROM t`;
    for (let i = 0; i < 4; i++) {
        query = `SELECT (${query}) FROM t`;
    }
    return query;
})();

const DEEP = `${DEEP_SUBQUERY};`;

const inputCases: BenchmarkInputCase[] = [
    {
        key: 'tiny',
        label: 'tiny',
        description: 'Single SELECT 1 statement.',
        sql: TINY,
    },
    {
        key: 'small',
        label: 'small',
        description: 'Single CREATE TABLE users statement.',
        sql: SMALL,
    },
    {
        key: 'medium',
        label: 'medium',
        description: 'CTE query with joins, aggregates, correlated subqueries, CASE, ordering, and LIMIT.',
        sql: MEDIUM,
    },
    {
        key: 'large',
        label: 'large (wide create table)',
        description: 'Wide CREATE TABLE analytics_events statement with 96 metric columns.',
        sql: LARGE,
    },
    {
        key: 'deep',
        label: 'deep (nested expr + subquery)',
        description: 'Nested expressions with a nested subquery.',
        sql: DEEP,
    },
];

const suite = new Benchmark.Suite();
const reportLines: string[] = [];
const skippedCases: SkippedBenchmarkCase[] = [];

const logLine = (line = '') => {
    console.log(line);
    reportLines.push(line);
};

function getPackageVersion(packageName: string): string {
    if (packageName === 'rawsql-ts') {
        return (corePackageRequire('./package.json') as { version?: string }).version ?? 'unknown';
    }

    const entryPath = corePackageRequire.resolve(packageName);
    let currentDir = path.dirname(entryPath);

    while (currentDir !== path.dirname(currentDir)) {
        const packageJsonPath = path.join(currentDir, 'package.json');
        if (fs.existsSync(packageJsonPath)) {
            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) as { name?: string; version?: string };
            if (packageJson.name === packageName) {
                return packageJson.version ?? 'unknown';
            }
        }
        currentDir = path.dirname(currentDir);
    }

    return 'unknown';
}

function parseRawSql(sql: string) {
    SqlParser.parse(sql, { mode: 'single' });
}

function createParserMethods(sqlite3Parser: Sqlite3ParserModule): ParserMethod[] {
    const nodeSqlParserModule = corePackageRequire('node-sql-parser') as {
        Parser: new () => { astify(sql: string, options: { database: string }): unknown };
    };
    const nodeSqlParser = new nodeSqlParserModule.Parser();

    return [
        {
            label: 'sqlite3-parser',
            parse: sql => {
                const result = sqlite3Parser.parse(sql);
                if (result.status !== 'ok') {
                    throw new Error(result.errors.map(error => error.message).join('; ') || 'parse error');
                }
            },
            borderColor: 'rgba(75,192,192,1)',
            backgroundColor: 'rgba(75,192,192,0.15)',
        },
        {
            label: 'rawsql-ts',
            parse: parseRawSql,
            borderColor: 'rgba(54,162,235,1)',
            backgroundColor: 'rgba(54,162,235,0.15)',
        },
        {
            label: 'node-sql-parser',
            parse: sql => { nodeSqlParser.astify(sql, { database: 'sqlite' }); },
            borderColor: 'rgba(255,206,86,1)',
            backgroundColor: 'rgba(255,206,86,0.15)',
        },
    ];
}

function printHeader(methods: ParserMethod[]) {
    const cpuModel = os.cpus()[0]?.model ?? 'Unknown CPU';
    const logicalCores = os.cpus().length;
    const osName = `${os.type()} ${os.release()}`;
    const currentDate = new Date().toISOString().split('T')[0];
    const comparedVersions = methods.map(method => `${method.label} ${getPackageVersion(method.label.split('/')[0])}`).join(', ');
    const benchmarkVersion = corePackageRequire('benchmark/package.json').version;

    logLine('```');
    logLine(`benchmark.js v${benchmarkVersion}, ${osName}`);
    logLine(`${cpuModel.trim()}, ${logicalCores} logical cores`);
    logLine(`Node.js ${process.version}`);
    logLine(`Date ${currentDate}`);
    logLine(`Benchmark config: minSamples=${BENCHMARK_RUN_CONFIG.minSamples}, maxTime=${BENCHMARK_RUN_CONFIG.maxTimeSec}s`);
    logLine(`Compared libraries: ${comparedVersions}`);
    logLine('```');
    logLine('');
    logLine('The input SQL cases are copied from sqlite3-parser-js `scripts/bench-common.ts`. The parser comparison is intentionally scoped to sqlite3-parser, rawsql-ts, and node-sql-parser.');
    logLine('');
}

function printResults(results: BenchmarkResult[], methods: ParserMethod[]) {
    inputCases.forEach(inputCase => {
        const groupResults = results.filter(result => result.caseKey === inputCase.key);
        const baseline = groupResults.find(result => result.methodLabel === 'sqlite3-parser');
        const baselineMean = baseline ? baseline.mean : null;

        logLine(`\n#### ${inputCase.label}`);
        logLine(inputCase.description);
        logLine('');
        logLine('| Parser | Mean (ms) | Error (ms) | StdDev (ms) | Times slower vs sqlite3-parser |');
        logLine('|--------|----------:|-----------:|------------:|-------------------------------:|');

        methods.forEach(method => {
            const result = groupResults.find(item => item.methodLabel === method.label);
            if (!result) {
                logLine(`| ${method.label} | n/a | n/a | n/a | n/a |`);
                return;
            }

            const meanMs = result.mean * 1000;
            const errorMs = result.stats.deviation * 1000 * 1.96;
            const stddevMs = result.stats.deviation * 1000;
            let ratio = '-';
            if (baselineMean && method.label !== 'sqlite3-parser') {
                const ratioValue = result.mean / baselineMean;
                ratio = ratioValue >= 1.01 ? `${ratioValue.toFixed(1)}x` : '<1x';
            }

            logLine(`| ${method.label} | ${meanMs.toFixed(3)} | ${errorMs.toFixed(4)} | ${stddevMs.toFixed(4)} | ${ratio} |`);
        });
    });

    if (skippedCases.length > 0) {
        logLine('');
        logLine('#### Skipped Cases');
        logLine('| Parser | Case | Reason |');
        logLine('|--------|------|--------|');
        skippedCases.forEach(skipped => {
            logLine(`| ${skipped.methodLabel} | ${skipped.caseKey} | ${skipped.reason.replace(/\s+/g, ' ')} |`);
        });
    }

    logLine('');
}

function buildChartDataset(results: BenchmarkResult[], methods: ParserMethod[]): ChartDataset {
    return {
        labels: inputCases.map(inputCase => inputCase.label),
        datasets: methods.map(method => ({
            label: method.label,
            data: inputCases.map(inputCase => {
                const match = results.find(result => result.methodLabel === method.label && result.caseKey === inputCase.key);
                return match ? parseFloat((match.mean * 1000).toFixed(3)) : null;
            }),
            borderColor: method.borderColor,
            backgroundColor: method.backgroundColor,
            fill: false,
            tension: 0.2,
        })),
    };
}

function printChartDataset(results: BenchmarkResult[], methods: ParserMethod[]) {
    logLine('#### Chart Dataset');
    logLine('```json');
    logLine(JSON.stringify(buildChartDataset(results, methods), null, 2));
    logLine('```');
    logLine('');
}

function writeReportFile(lines: string[]): string {
    const timestamp = new Date().toISOString().replace(/[:]/g, '-');
    const tmpDir = path.resolve(__dirname, '../tmp');
    fs.mkdirSync(tmpDir, { recursive: true });

    const filePath = path.join(tmpDir, `sqlite3-parser-benchmark-report-${timestamp}.md`);
    fs.writeFileSync(filePath, `${lines.join('\n')}\n`, 'utf8');

    return filePath;
}

function getSkipReason(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

function addBenchmarks(methods: ParserMethod[]) {
    inputCases.forEach(inputCase => {
        methods.forEach(method => {
            try {
                method.parse(inputCase.sql);
                suite.add(`${inputCase.key} / ${method.label}`, () => method.parse(inputCase.sql), {
                    minSamples: BENCHMARK_RUN_CONFIG.minSamples,
                    maxTime: BENCHMARK_RUN_CONFIG.maxTimeSec,
                    methodLabel: method.label,
                    caseKey: inputCase.key,
                } as Benchmark.Options & { methodLabel: string; caseKey: string });
            } catch (error) {
                skippedCases.push({
                    methodLabel: method.label,
                    caseKey: inputCase.key,
                    reason: getSkipReason(error),
                });
            }
        });
    });
}

async function main() {
    const sqlite3Parser = await nativeDynamicImport(pathToFileURL(corePackageRequire.resolve('sqlite3-parser')).href) as Sqlite3ParserModule;

    const methods = createParserMethods(sqlite3Parser);
    addBenchmarks(methods);

    suite.on('cycle', () => {
        // Suppress per-cycle output to keep the report concise.
    });

    suite.on('complete', function (this: Benchmark.Suite) {
        const results = this.filter('successful').map((benchmark: BenchmarkCase) => {
            const benchmarkName = benchmark.name ?? '';
            return {
            name: benchmarkName,
            methodLabel: (benchmark as BenchmarkCase & { methodLabel?: string }).methodLabel ?? benchmarkName.split('/').pop()?.trim() ?? benchmarkName,
            caseKey: (benchmark as BenchmarkCase & { caseKey?: string }).caseKey ?? benchmarkName.split('/')[0]?.trim() ?? '',
            hz: benchmark.hz,
            stats: benchmark.stats,
            mean: benchmark.stats.mean,
            samples: benchmark.stats.sample.length,
        };
        }) as BenchmarkResult[];

        printHeader(methods);
        printResults(results, methods);
        printChartDataset(results, methods);

        const reportPath = writeReportFile(reportLines);
        console.log(`Report saved to ${path.relative(process.cwd(), reportPath)}`);
    });

    console.log('running...');
    suite.run({ async: false });
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
