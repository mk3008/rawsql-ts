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

interface QueryBenchmarkCase {
    key: string;
    chartLabel: string;
    readerLabel: string;
    sql: string;
}

const BENCHMARK_RUN_CONFIG: BenchmarkRunConfig = {
    defaultMinSamples: 10,
    defaultMaxTimeSec: 0.2,
    heavyMinSamples: 6,
    heavyMaxTimeSec: 0.12,
};

function createLargeAnalyticsSql(sectionCount: number): string {
    const lines: string[] = [
        'WITH',
        '  orders_base AS (',
        '    SELECT',
        '      o.order_id,',
        '      o.customer_id,',
        '      o.product_id,',
        '      o.sales_region,',
        '      o.sales_channel,',
        '      o.order_date,',
        '      o.status,',
        '      o.quantity,',
        '      o.net_amount,',
        '      o.discount_amount,',
        '      o.tax_amount,',
        '      o.shipping_amount',
        '    FROM order_fact o',
        "    WHERE o.order_date >= DATE '2024-01-01'",
        '  ),',
        '  customers_base AS (',
        '    SELECT',
        '      c.customer_id,',
        '      c.customer_tier,',
        '      c.account_status,',
        '      c.market_segment',
        '    FROM customer_dim c',
        '  ),',
        '  products_base AS (',
        '    SELECT',
        '      p.product_id,',
        '      p.category_name,',
        '      p.brand_name,',
        '      p.catalog_group',
        '    FROM product_dim p',
        '  ),',
    ];

    for (let i = 1; i <= sectionCount; i++) {
        const month = ((i - 1) % 12) + 1;
        const padded = i.toString().padStart(4, '0');
        const sliceName = `report_slice_${padded}`;
        const rankedName = `ranked_slice_${padded}`;
        const channel = i % 3 === 0 ? 'partner' : i % 2 === 0 ? 'retail' : 'online';
        const tail = i === sectionCount ? '' : ',';

        lines.push(`  ${sliceName} AS (`);
        lines.push('    SELECT');
        lines.push("      DATE_TRUNC('month', ob.order_date) AS report_month,");
        lines.push('      cb.customer_tier,');
        lines.push('      cb.market_segment,');
        lines.push('      pb.category_name,');
        lines.push('      pb.brand_name,');
        lines.push('      ob.sales_region,');
        lines.push('      ob.sales_channel,');
        lines.push('      COUNT(*) AS order_count,');
        lines.push('      SUM(ob.quantity) AS unit_count,');
        lines.push('      SUM(ob.net_amount) AS net_revenue,');
        lines.push('      SUM(ob.discount_amount) AS total_discount,');
        lines.push('      SUM(ob.tax_amount + ob.shipping_amount) AS fulfillment_amount,');
        lines.push("      SUM(CASE WHEN ob.status = 'paid' THEN ob.net_amount ELSE 0 END) AS paid_revenue, SUM(CASE WHEN ob.status = 'shipped' THEN ob.net_amount ELSE 0 END) AS shipped_revenue,");
        lines.push("      SUM(CASE WHEN cb.customer_tier = 'enterprise' THEN ob.net_amount ELSE 0 END) AS enterprise_revenue, SUM(CASE WHEN cb.customer_tier = 'team' THEN ob.net_amount ELSE 0 END) AS team_revenue,");
        lines.push("      SUM(CASE WHEN pb.category_name = 'software' THEN ob.net_amount ELSE 0 END) AS software_revenue, SUM(CASE WHEN pb.category_name = 'services' THEN ob.net_amount ELSE 0 END) AS services_revenue,");
        lines.push('      AVG(ob.net_amount) AS avg_order_value, MAX(ob.net_amount) AS max_order_value,');
        lines.push('      MIN(ob.net_amount) AS min_order_value, AVG(ob.discount_amount) AS avg_discount_amount,');
        lines.push('      COUNT(DISTINCT ob.customer_id) AS customer_count, COUNT(DISTINCT ob.product_id) AS product_count,');
        lines.push("      SUM(CASE WHEN cb.market_segment = 'mid-market' THEN ob.quantity ELSE 0 END) AS mid_market_units, SUM(CASE WHEN cb.market_segment = 'enterprise' THEN ob.quantity ELSE 0 END) AS enterprise_units,");
        lines.push("      SUM(CASE WHEN pb.brand_name = 'alpha' THEN ob.net_amount ELSE 0 END) AS alpha_brand_revenue, SUM(CASE WHEN pb.brand_name = 'beta' THEN ob.net_amount ELSE 0 END) AS beta_brand_revenue");
        lines.push('    FROM orders_base ob');
        lines.push('    JOIN customers_base cb ON cb.customer_id = ob.customer_id');
        lines.push('    JOIN products_base pb ON pb.product_id = ob.product_id');
        lines.push("    WHERE ob.status IN ('paid', 'shipped', 'completed')");
        lines.push("      AND cb.account_status = 'active'");
        lines.push("      AND pb.catalog_group = 'standard'");
        lines.push(`      AND ob.sales_channel = '${channel}'`);
        lines.push(`      AND EXTRACT(MONTH FROM ob.order_date) = ${month}`);
        lines.push('    GROUP BY');
        lines.push("      DATE_TRUNC('month', ob.order_date),");
        lines.push('      cb.customer_tier,');
        lines.push('      cb.market_segment,');
        lines.push('      pb.category_name,');
        lines.push('      pb.brand_name,');
        lines.push('      ob.sales_region,');
        lines.push('      ob.sales_channel');
        lines.push('  ),');
        lines.push(`  ${rankedName} AS (`);
        lines.push('    SELECT');
        lines.push('      s.*,');
        lines.push('      ROW_NUMBER() OVER (');
        lines.push('        PARTITION BY s.report_month, s.sales_region, s.sales_channel');
        lines.push('        ORDER BY s.net_revenue DESC, s.order_count DESC');
        lines.push('      ) AS revenue_rank');
        lines.push(`    FROM ${sliceName} s`);
        lines.push(`  )${tail}`);
    }

    lines.push('SELECT');
    lines.push('  report_month,');
    lines.push('  sales_region,');
    lines.push('  sales_channel,');
    lines.push('  customer_tier,');
    lines.push('  market_segment,');
    lines.push('  category_name,');
    lines.push('  brand_name,');
    lines.push('  order_count,');
    lines.push('  unit_count,');
    lines.push('  net_revenue,');
    lines.push('  total_discount,');
    lines.push('  fulfillment_amount,');
    lines.push('  revenue_rank');
    lines.push(`FROM ranked_slice_${sectionCount.toString().padStart(4, '0')}`);
    lines.push('WHERE revenue_rank <= 5');
    lines.push('ORDER BY report_month DESC, sales_region, sales_channel, net_revenue DESC;');

    return lines.join('\n');
}

const queries: QueryBenchmarkCase[] = [
    {
        key: 'Tokens70',
        chartLabel: 'Small',
        readerLabel: 'Small query, about 8 lines (70 tokens)',
        sql: `SELECT
                u.id, u.name, u.email, u.age, u.status, u.role,
                o.id AS order_id, o.total, o.order_date, o.status AS order_status
              FROM users AS u
              JOIN orders AS o ON u.id = o.user_id
              WHERE u.age > 1 AND o.status = 'completed'
              ORDER BY o.order_date DESC;`
    },
    {
        key: 'Tokens140',
        chartLabel: 'Medium',
        readerLabel: 'Medium query, about 12 lines (140 tokens)',
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
        key: 'Tokens230',
        chartLabel: 'Large',
        readerLabel: 'Large query, about 20 lines (230 tokens)',
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
        key: 'Tokens12000',
        chartLabel: 'Very large',
        readerLabel: 'Very large query, about 1,000 lines (12,000 tokens)',
        sql: createLargeAnalyticsSql(24)
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
    const queryKeys = queries.map(q => q.key);
    const groupedResults: Record<string, BenchmarkResult[]> = {};

    queryKeys.forEach(key => {
        groupedResults[key] = results.filter(r => r.name.includes(key));
    });

    Object.keys(groupedResults).forEach(groupKey => {
        const query = queries.find(item => item.key === groupKey);
        logLine(`\n#### ${query?.readerLabel ?? groupKey}`);
        logLine('| Method                            | Mean (ms)  | Error (ms) | StdDev (ms) | Times slower vs rawsql-ts |');
        logLine('|---------------------------------- |-----------:|----------:|----------:|--------------------------:|');

        const groupResults = groupedResults[groupKey];
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
    const labels = queries.map(query => query.chartLabel);
    const methods = ['rawsql-ts', 'node-sql-parser'];

    const datasets = methods.map(label => {
        const data = queries.map(query => {
            const match = results.find(result => result.name.startsWith(label) && result.name.endsWith(query.key));
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

function getBenchmarkOptions(queryKey: string): Benchmark.Options {
    const isHeavy = queryKey === 'Tokens12000';
    return {
        minSamples: isHeavy ? BENCHMARK_RUN_CONFIG.heavyMinSamples : BENCHMARK_RUN_CONFIG.defaultMinSamples,
        maxTime: isHeavy ? BENCHMARK_RUN_CONFIG.heavyMaxTimeSec : BENCHMARK_RUN_CONFIG.defaultMaxTimeSec,
    };
}

queries.forEach(query => {
    const options = getBenchmarkOptions(query.key);
    suite.add(`rawsql-ts ${query.key}`, parseWithRawSql(query.sql), options);
    suite.add(`node-sql-parser ${query.key}`, parseWithNodeSqlParser(query.sql), options);
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
