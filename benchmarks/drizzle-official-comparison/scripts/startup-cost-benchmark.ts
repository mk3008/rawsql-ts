import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { performance } from 'perf_hooks';
import { pathToFileURL } from 'url';
import { loadQueryCatalog } from '../src/rfba/features/_shared/queryCatalog';

type Phase =
  | 'sql-file-load'
  | 'rawsql-parser-import'
  | 'sql-parse'
  | 'catalog-preparation'
  | 'generated-mapper-import';

type Args = {
  runs: number;
  folder: string;
};

type StartupResult = {
  phase: Phase;
  run: number;
  durationMs: number;
};

type RawsqlParserModule = {
  SelectQueryParser: {
    parse(sql: string): unknown;
  };
};

const queryDefinitions = {
  customers: 'customers.sql',
  customerById: 'customer-by-id.sql',
  searchCustomer: 'search-customer.sql',
  employees: 'employees.sql',
  employeeWithRecipient: 'employee-with-recipient.sql',
  suppliers: 'suppliers.sql',
  supplierById: 'supplier-by-id.sql',
  products: 'products.sql',
  productWithSupplier: 'product-with-supplier.sql',
  searchProduct: 'search-product.sql',
  ordersWithDetails: 'orders-with-details.sql',
  orderWithDetails: 'order-with-details.sql',
  orderWithDetailsAndProducts: 'order-with-details-and-products.sql',
} as const;

const generatedMapperModules = [
  '../src/rfba/features/get-employee-with-recipient/generated/row-mapper.ts',
  '../src/rfba/features/get-product-with-supplier/generated/row-mapper.ts',
  '../src/rfba/features/get-order-with-details-and-products/generated/row-mapper.ts',
] as const;

const parseArgs = (): Args => {
  const options = new Map<string, string>();
  for (const arg of process.argv.slice(2)) {
    const [key, value = 'true'] = arg.replace(/^--/, '').split('=');
    options.set(key, value);
  }
  return {
    runs: Number(options.get('runs') ?? 20),
    folder: options.get('folder') ?? 'results-startup-cost',
  };
};

const measure = async (phase: Phase, run: number, operation: () => Promise<unknown> | unknown): Promise<StartupResult> => {
  const start = performance.now();
  await operation();
  return {
    phase,
    run,
    durationMs: performance.now() - start,
  };
};

const loadSqlFiles = (): Record<keyof typeof queryDefinitions, string> => {
  const sqlDir = path.resolve(__dirname, '../sql');
  return Object.fromEntries(
    Object.entries(queryDefinitions).map(([key, file]) => [key, fs.readFileSync(path.join(sqlDir, file), 'utf8')]),
  ) as Record<keyof typeof queryDefinitions, string>;
};

const loadRawsqlParser = async (run: number): Promise<RawsqlParserModule> => {
  const moduleName =
    process.env.RAWSQL_TS_IMPORT ??
    `${pathToFileURL(path.resolve(__dirname, '../../../packages/core/src/index.ts')).href}?startupRun=${run}`;
  return import(moduleName) as Promise<RawsqlParserModule>;
};

const importGeneratedMappers = async (run: number): Promise<void> => {
  await Promise.all(
    generatedMapperModules.map((specifier, index) =>
      import(`${specifier}?startupRun=${run}-${index}`),
    ),
  );
};

const percentile = (values: number[], percentileValue: number): number => {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((percentileValue / 100) * sorted.length) - 1);
  return sorted[index];
};

const summarize = (results: StartupResult[]) => {
  const groups = new Map<Phase, StartupResult[]>();
  for (const result of results) {
    const group = groups.get(result.phase) ?? [];
    group.push(result);
    groups.set(result.phase, group);
  }
  return [...groups.entries()].map(([phase, group]) => {
    const durations = group.map((value) => value.durationMs);
    return {
      phase,
      runs: group.length,
      meanMs: durations.reduce((acc, value) => acc + value, 0) / durations.length,
      p50Ms: percentile(durations, 50),
      p95Ms: percentile(durations, 95),
      minMs: Math.min(...durations),
      maxMs: Math.max(...durations),
    };
  });
};

const main = async (): Promise<void> => {
  const args = parseArgs();
  const outputDir = path.resolve(process.cwd(), args.folder);
  fs.mkdirSync(outputDir, { recursive: true });

  const results: StartupResult[] = [];
  for (let run = 1; run <= args.runs; run += 1) {
    const sqlFiles = loadSqlFiles();
    const parser = await loadRawsqlParser(run);

    results.push(await measure('sql-file-load', run, () => loadSqlFiles()));
    results.push(await measure('rawsql-parser-import', run, () => loadRawsqlParser(run + args.runs)));
    results.push(
      await measure('sql-parse', run, () => {
        for (const sql of Object.values(sqlFiles)) {
          parser.SelectQueryParser.parse(sql);
        }
      }),
    );
    results.push(await measure('catalog-preparation', run, () => loadQueryCatalog()));
    results.push(await measure('generated-mapper-import', run, () => importGeneratedMappers(run)));
  }

  const report = {
    generatedAt: new Date().toISOString(),
    command: process.argv.join(' '),
    config: {
      runs: args.runs,
      sqlFileCount: Object.keys(queryDefinitions).length,
      generatedMapperModuleCount: generatedMapperModules.length,
    },
    notes: [
      'This benchmark measures startup work only and does not execute DB queries.',
      'sql-parse isolates parser work after SQL files and parser module are already loaded.',
      'catalog-preparation measures the current RFBA loadQueryCatalog path, including parser load, SQL file load, parse, and descriptor creation.',
      'generated-mapper-import measures loading generated mapper modules separately from steady-state mapping.',
    ],
    summary: summarize(results),
    results,
  };

  const outputPath = path.join(outputDir, 'startup-cost-summary.json');
  fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`[startup-cost] wrote ${outputPath}`);
};

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
