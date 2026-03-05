import * as fs from 'fs';
import * as path from 'path';
import Benchmark = require('benchmark');
type BenchmarkCase = Benchmark;
import * as os from 'os';
import { Parser as NodeSqlParser } from 'node-sql-parser';
import { SqlParser } from '../packages/core/src/parsers/SqlParser';

interface BenchmarkResult {
    name: string;
    hz: number;
    stats: Benchmark.Stats;
    rme: number;
    mean: number;
    samples: number;
}

interface SystemInfo {
    cpuModel: string;
    logicalCores: number;
    osName: string;
    totalMem: number;
    nodeVersion: string;
}

interface ChartDataset {
    labels: string[];
    datasets: Array<{
        label: string;
        data: Array<number | null>;
    }>;
}

interface BenchmarkRunConfig {
    defaultMinSamples: number;
    defaultMaxTimeSec: number;
    heavyMinSamples: number;
    heavyMaxTimeSec: number;
}

const BENCHMARK_RUN_CONFIG: BenchmarkRunConfig = {
    defaultMinSamples: 10,
    defaultMaxTimeSec: 0.2,
    heavyMinSamples: 6,
    heavyMaxTimeSec: 0.12,
};

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

// Set of SQL queries for parse-only benchmarking
const queries = [
    {
        name: 'Tokens70',
        sql: `SELECT
                u.id, u.name, u.email, u.age, u.status, u.role,
                o.id AS order_id, o.total, o.order_date, o.status AS order_status
              FROM users AS u
              JOIN orders AS o ON u.id = o.user_id
              WHERE u.age > 1 AND o.status = 'completed'
              ORDER BY o.order_date DESC;`
    },
    {
        name: 'Tokens140',
        sql: `WITH recent_orders AS (
                SELECT user_id, MAX(order_date) AS last_order
                FROM orders
                GROUP BY user_id
              )
              SELECT
                u.id, u.name, u.email, u.age, u.status, u.role, u.created_at, u.updated_at,
                r.last_order, SUM(o.total) AS total_spent
              FROM users AS u
              JOIN orders AS o ON u.id = o.user_id
              JOIN recent_orders AS r ON u.id = r.user_id
              WHERE u.status = 'active'
              GROUP BY u.id, u.name, u.email, u.age, u.status, u.role, u.created_at, u.updated_at, r.last_order
              HAVING SUM(o.total) > 10
              ORDER BY total_spent DESC;`
    },
    {
        name: 'Tokens230',
        sql: `WITH
                detail AS (
                    SELECT
                        q.*,
                        TRUNC(q.price * (1 + q.tax_rate)) - q.price AS tax,
                        q.price * (1 + q.tax_rate) - q.price AS raw_tax
                    FROM
                        (
                            SELECT
                                dat.*,
                                (dat.unit_price * dat.quantity) AS price
                            FROM
                                dat
                        ) q
                ),
                tax_summary AS (
                    SELECT
                        d.tax_rate,
                        TRUNC(SUM(raw_tax)) AS total_tax
                    FROM
                        detail d
                    GROUP BY
                        d.tax_rate
                )
                SELECT
                    line_id,
                    name,
                    unit_price,
                    quantity,
                    tax_rate,
                    price,
                    price + tax AS tax_included_price,
                    tax
                FROM
                    (
                        SELECT
                            line_id,
                            name,
                            unit_price,
                            quantity,
                            tax_rate,
                            price,
                            tax + adjust_tax AS tax
                        FROM
                            (
                                SELECT
                                    q.*,
                                    CASE WHEN q.total_tax - q.cumulative >= q.priority THEN 1 ELSE 0 END AS adjust_tax
                                FROM
                                    (
                                        SELECT
                                            d.*,
                                            s.total_tax,
                                            SUM(d.tax) OVER (PARTITION BY d.tax_rate) AS cumulative,
                                            ROW_NUMBER() OVER (PARTITION BY d.tax_rate ORDER BY d.raw_tax % 1 DESC, d.line_id) AS priority
                                        FROM
                                            detail d
                                            INNER JOIN tax_summary s ON d.tax_rate = s.tax_rate
                                    ) q
                            ) q
                    ) q
                ORDER BY
                    line_id;`
    },
    {
        name: 'Tokens12000',
        sql: createCteChainSql(1000)
    }
];

const nodeSqlParser = new NodeSqlParser();
const suite = new Benchmark.Suite();
const reportLines: string[] = [];

const logLine = (line = '') => {
    console.log(line);
    reportLines.push(line);
};

function parseWithRawSql(sql: string) {
    return () => {
        SqlParser.parse(sql, { mode: 'single' });
    };
}

function parseWithNodeSqlParser(sql: string) {
    return () => {
        nodeSqlParser.astify(sql, { database: 'postgresql' });
    };
}

function getSystemInfo(): SystemInfo {
    const cpuModel = os.cpus()[0]?.model ?? 'Unknown CPU';
    const logicalCores = os.cpus().length;
    const osName = `${os.type()} ${os.release()}`;
    const totalMem = Math.round(os.totalmem() / (1024 * 1024 * 1024));
    const nodeVersion = process.version;

    return {
        cpuModel,
        logicalCores,
        osName,
        totalMem,
        nodeVersion
    };
}

function printHeader() {
    const info = getSystemInfo();
    const currentDate = new Date().toISOString().split('T')[0];
    const benchmarkVersion = require('benchmark/package.json').version;

    logLine('```');
    logLine(`benchmark.js v${benchmarkVersion}, ${info.osName}`);
    logLine(`${info.cpuModel.trim()}, ${info.logicalCores} logical cores`);
    logLine(`Node.js ${info.nodeVersion}`);
    logLine(`Date ${currentDate}`);
    logLine(`Benchmark config: default minSamples=${BENCHMARK_RUN_CONFIG.defaultMinSamples}, maxTime=${BENCHMARK_RUN_CONFIG.defaultMaxTimeSec}s; heavy minSamples=${BENCHMARK_RUN_CONFIG.heavyMinSamples}, maxTime=${BENCHMARK_RUN_CONFIG.heavyMaxTimeSec}s`);
    logLine('```');
    logLine('');
}

function printResults(results: BenchmarkResult[]) {
    const queryNames = queries.map(q => q.name);
    const groupedResults: Record<string, BenchmarkResult[]> = {};

    queryNames.forEach(name => {
        groupedResults[name] = results.filter(r => r.name.includes(name));
    });

    Object.keys(groupedResults).forEach(groupName => {
        logLine(`\n#### ${groupName}`);
        logLine('| Method                            | Mean (ms)  | Error (ms) | StdDev (ms) | Times slower vs rawsql-ts |');
        logLine('|---------------------------------- |-----------:|----------:|----------:|--------------------------:|');

        const groupResults = groupedResults[groupName];
        const rawsqlResult = groupResults.find(r => r.name.startsWith('rawsql-ts'));
        const rawsqlMean = rawsqlResult ? rawsqlResult.mean : null;

        groupResults.forEach(result => {
            const methodMatch = result.name.match(/^([^]+)\s+Tokens\d+$/);
            const methodName = methodMatch ? methodMatch[1] : result.name;
            const name = methodName.padEnd(30).substring(0, 30);

            const meanMs = result.mean * 1000;
            const mean = meanMs.toFixed(3).padStart(8);

            const errorMs = result.stats.deviation * 1000 * 1.96;
            const error = errorMs.toFixed(4).padStart(7);

            const stddevMs = result.stats.deviation * 1000;
            const stddev = stddevMs.toFixed(4).padStart(7);

            let ratioStr = '-';
            if (rawsqlMean && !result.name.startsWith('rawsql-ts')) {
                const ratio = result.mean / rawsqlMean;
                ratioStr = ratio >= 1.01 ? `${ratio.toFixed(1)}x` : '<1x';
            }

            logLine(`| ${name} | ${mean} | ${error} | ${stddev} | ${ratioStr.padStart(16)} |`);
        });
    });

    logLine('');
}

function buildChartDataset(results: BenchmarkResult[]): ChartDataset {
    const labels = queries.map(query => query.name);
    const methods = ['rawsql-ts', 'node-sql-parser'];

    const datasets = methods.map(label => {
        const data = labels.map(queryName => {
            const match = results.find(result => result.name.startsWith(label) && result.name.endsWith(queryName));
            if (!match) {
                return null;
            }

            const meanMs = match.mean * 1000;
            return parseFloat(meanMs.toFixed(3));
        });

        return {
            label,
            data
        };
    });

    return {
        labels,
        datasets
    };
}

function printChartDataset(results: BenchmarkResult[]) {
    const dataset = buildChartDataset(results);
    logLine('#### Chart Dataset');
    logLine('```json');
    logLine(JSON.stringify(dataset, null, 2));
    logLine('```');
    logLine('');
}

function writeReportFile(lines: string[]): string {
    const timestamp = new Date().toISOString().replace(/[:]/g, '-');
    const tmpDir = path.resolve(__dirname, '../tmp');
    fs.mkdirSync(tmpDir, { recursive: true });

    const filePath = path.join(tmpDir, `parse-benchmark-report-${timestamp}.md`);
    fs.writeFileSync(filePath, `${lines.join('\n')}\n`, 'utf8');

    return filePath;
}

function getBenchmarkOptions(queryName: string): Benchmark.Options {
    const isHeavy = queryName === 'Tokens12000';
    return {
        minSamples: isHeavy ? BENCHMARK_RUN_CONFIG.heavyMinSamples : BENCHMARK_RUN_CONFIG.defaultMinSamples,
        maxTime: isHeavy ? BENCHMARK_RUN_CONFIG.heavyMaxTimeSec : BENCHMARK_RUN_CONFIG.defaultMaxTimeSec,
    };
}

queries.forEach(query => {
    const options = getBenchmarkOptions(query.name);
    suite.add(`rawsql-ts ${query.name}`, parseWithRawSql(query.sql), options);
    suite.add(`node-sql-parser ${query.name}`, parseWithNodeSqlParser(query.sql), options);
});

suite.on('cycle', () => {
    // Suppress per-cycle output to keep the report concise.
});

suite.on('complete', function (this: Benchmark.Suite) {
    const results = this.filter('successful').map((benchmark: BenchmarkCase) => ({
        name: benchmark.name,
        hz: benchmark.hz,
        stats: benchmark.stats,
        rme: benchmark.stats.rme,
        mean: benchmark.stats.mean,
        samples: benchmark.stats.sample.length
    })) as BenchmarkResult[];

    printHeader();
    printResults(results);
    printChartDataset(results);

    const reportPath = writeReportFile(reportLines);
    console.log(`Report saved to ${path.relative(process.cwd(), reportPath)}`);
});

console.log('running...');
suite.run({ async: false });
