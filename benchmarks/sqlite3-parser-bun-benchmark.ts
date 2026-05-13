import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { SqlParser } from '../packages/core/src/parsers/SqlParser';

interface Competitor {
    label: string;
    parse: (sql: string) => unknown;
    version: string;
}

const requireFromCore = createRequire(path.resolve(import.meta.dir, '../packages/core/package.json'));
const mitata = await import(pathToFileURL(requireFromCore.resolve('mitata')).href) as typeof import('mitata');
const sqlite3Parser = await import(pathToFileURL(requireFromCore.resolve('sqlite3-parser')).href) as {
    parse(sql: string): { status: 'ok'; root: unknown } | { status: 'error'; errors: Array<{ message: string }> };
};
const sqlParserTs = await import(pathToFileURL(requireFromCore.resolve('@guanmingchiu/sqlparser-ts')).href) as typeof import('@guanmingchiu/sqlparser-ts');
const sqliteParser = requireFromCore('sqlite-parser') as (sql: string) => unknown;
const applandParse = requireFromCore('@appland/sql-parser') as (sql: string) => unknown;
const nodeSqlParserModule = requireFromCore('node-sql-parser') as {
    Parser: new () => { astify(sql: string, options: { database: string }): unknown };
};
const { parse: pgAstParse } = requireFromCore('pgsql-ast-parser') as { parse(sql: string): unknown };
const { bench, do_not_optimize, group, run, summary } = mitata;
const { Parser: NodeSqlParser } = nodeSqlParserModule;

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

const cases = [
    { label: 'tiny', sql: TINY },
    { label: 'small', sql: SMALL },
    { label: 'medium', sql: MEDIUM },
    { label: 'large (wide create table)', sql: LARGE },
    { label: 'deep (nested expr + subquery)', sql: DEEP },
] as const;

function packageVersion(packageName: string): string {
    const entryPath = requireFromCore.resolve(packageName);
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

function parseSqlite3(sql: string) {
    const result = sqlite3Parser.parse(sql);
    if (result.status !== 'ok') {
        throw new Error(result.errors.map(error => error.message).join('; ') || 'parse error');
    }
    return result.root;
}

await sqlParserTs.init();

const nodeSql = new NodeSqlParser();
const competitors: Competitor[] = [
    { label: 'sqlite3-parser', parse: parseSqlite3, version: packageVersion('sqlite3-parser') },
    { label: 'rawsql-ts', parse: sql => SqlParser.parse(sql, { mode: 'single' }), version: requireFromCore('./package.json').version },
    { label: 'sqlite-parser', parse: sqliteParser, version: packageVersion('sqlite-parser') },
    { label: '@appland/sql-parser', parse: applandParse, version: packageVersion('@appland/sql-parser') },
    { label: 'node-sql-parser', parse: sql => nodeSql.astify(sql, { database: 'sqlite' }), version: packageVersion('node-sql-parser') },
    { label: 'pgsql-ast-parser', parse: pgAstParse, version: packageVersion('pgsql-ast-parser') },
    { label: '@guanmingchiu/sqlparser-ts', parse: sql => sqlParserTs.Parser.parse(sql, 'sqlite'), version: packageVersion('@guanmingchiu/sqlparser-ts') },
];

const canHandle = new Map<string, Set<string>>();
const skipped: string[] = [];

function probe(label: string, sql: string): void {
    const ok = new Set<string>();
    for (const competitor of competitors) {
        try {
            competitor.parse(sql);
            ok.add(competitor.label);
        } catch (error) {
            if (competitor.label === 'sqlite3-parser') {
                throw error;
            }
            const reason = error instanceof Error ? error.message : String(error);
            skipped.push(`| ${competitor.label} | ${label} | ${reason.replace(/\s+/g, ' ')} |`);
        }
    }
    canHandle.set(label, ok);
}

for (const inputCase of cases) {
    probe(inputCase.label, inputCase.sql);
}

function groupFor(label: string, sql: string): void {
    const ok = canHandle.get(label) ?? new Set<string>();
    group(label, () => {
        summary(() => {
            for (const competitor of competitors) {
                if (!ok.has(competitor.label)) {
                    continue;
                }
                const candidate = bench(`${label} / ${competitor.label}`, () => do_not_optimize(competitor.parse(sql)));
                if (competitor.label === 'sqlite3-parser') {
                    candidate.baseline(true);
                }
            }
        });
    });
}

for (const inputCase of cases) {
    groupFor(inputCase.label, inputCase.sql);
}

const captured: string[] = [];
const result = await run({
    format: 'markdown',
    colors: false,
    print: (line: string) => captured.push(line),
});

const reportLines = [
    '# sqlite3-parser-js Style Benchmark Report',
    '',
    'This report runs the sqlite3-parser-js `bench:compare` input cases and competitor style with `rawsql-ts` added as another parser.',
    '',
    '```',
    `mitata under Bun ${Bun.version}, ${os.type()} ${os.release()}`,
    `${os.cpus()[0]?.model?.trim() ?? 'Unknown CPU'}, ${os.cpus().length} logical cores`,
    `Date ${new Date().toISOString().split('T')[0]}`,
    `Compared libraries: ${competitors.map(competitor => `${competitor.label} ${competitor.version}`).join(', ')}`,
    '```',
    '',
    'The upstream vendored `liteparser (wasm)` target is not included because it is built from sqlite3-parser-js repository-local vendor sources rather than an npm package.',
    '',
    ...captured,
    '',
];

if (skipped.length > 0) {
    reportLines.push('## Skipped Cases', '', '| Parser | Case | Reason |', '|--------|------|--------|', ...skipped, '');
}

const tmpDir = path.resolve(import.meta.dir, '../tmp');
fs.mkdirSync(tmpDir, { recursive: true });
const reportPath = path.join(tmpDir, `sqlite3-parser-bun-benchmark-report-${new Date().toISOString().replace(/[:]/g, '-')}.md`);
fs.writeFileSync(reportPath, `${reportLines.join('\n')}\n`, 'utf8');

process.stdout.write(`${reportLines.join('\n')}\n`);
process.stdout.write(`Report saved to ${path.relative(process.cwd(), reportPath)}\n`);

void result;
